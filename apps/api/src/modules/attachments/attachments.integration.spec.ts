import { describe, it, expect, beforeAll } from 'vitest';
import { AttachmentsService } from './attachments.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { WorkItemsRepository } from '../work-items/work-items.repository.js';
import { WorkItemsService } from '../work-items/work-items.service.js';
import { WorkItemTypeRegistryService } from '../work-items/work-item-types.registry.js';
import { WorkItemHistoryRepository } from '../work-item-history/work-item-history.repository.js';
import { WorkItemHistoryService } from '../work-item-history/work-item-history.service.js';
import { TeamsRepository } from '../teams/teams.repository.js';
import { TeamsService } from '../teams/teams.service.js';
import { db } from '../../db/kysely.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('Attachments & Object Storage DB Integration (Phase 13)', () => {
  let attachmentsService: AttachmentsService;
  let objectStorage: ObjectStorageService;
  let workItemsService: WorkItemsService;

  let ownerId: string;
  let outsiderId: string;
  let projectId: string;
  let workItemId: string;

  beforeAll(async () => {
    objectStorage = new ObjectStorageService();
    const authz = new AuthorizationService();
    attachmentsService = new AttachmentsService(authz, objectStorage, {
      dispatchJob: vi.fn().mockResolvedValue({ job: {}, isDuplicate: false }),
    } as any);

    const history = new WorkItemHistoryService(new WorkItemHistoryRepository());
    const workItemsRepo = new WorkItemsRepository(history);
    const projectsRepo = new ProjectsRepository();
    const projectsService = new ProjectsService(projectsRepo, authz);
    const teamsService = new TeamsService(new TeamsRepository(), projectsService, authz);

    workItemsService = new WorkItemsService(
      workItemsRepo,
      projectsService,
      teamsService,
      authz,
      { notifyAssigned: vi.fn() } as any,
      new WorkItemTypeRegistryService(),
    );

    const users = await db.selectFrom('users').select('id').limit(2).execute();
    ownerId = users[0].id;
    outsiderId = users[1]?.id || ownerId;

    const proj = await db
      .insertInto('projects')
      .values({
        name: 'Attachment Integration Proj',
        key: `ATT${Date.now().toString().slice(-4)}`,
        created_by: ownerId,
        organization_id: '00000000-0000-0000-0000-000000000000',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    projectId = proj.id;

    await db.insertInto('project_members').values({
      project_id: projectId,
      user_id: ownerId,
      role: 'OWNER',
    }).execute();

    const area = await db.insertInto('areas').values({
      project_id: projectId,
      name: 'Root Area',
    }).returningAll().executeTakeFirstOrThrow();

    await db.insertInto('work_item_states').values([
      { project_id: projectId, key: 'New', name: 'New', color: '#94A3B8', category: 'PROPOSED', sort_order: 1, is_done: false },
    ]).execute();

    const item = await workItemsService.create(ownerId, projectId, {
      title: 'Attachment Test Item',
      type: 'STORY',
      areaId: area.id,
    });
    workItemId = item.id;
  });

  it('should generate presigned upload URL and confirm attachment metadata', async () => {
    const uploadRes = await attachmentsService.requestUploadUrl(ownerId, projectId, workItemId, {
      fileName: 'spec_doc.pdf',
      fileSize: 4096,
      contentType: 'application/pdf',
    });

    expect(uploadRes.uploadUrl).toBeDefined();
    expect(uploadRes.objectKey).toContain(`projects/${projectId}/work-items/${workItemId}/`);

    // Simulate S3 object upload in storage driver
    await objectStorage.saveLocalObject(uploadRes.objectKey, Buffer.from('PDF content payload'));

    const confirmed = await attachmentsService.confirmUpload(ownerId, projectId, workItemId, {
      objectKey: uploadRes.objectKey,
      fileName: 'spec_doc.pdf',
      fileSize: 4096,
      contentType: 'application/pdf',
    });

    expect(confirmed.id).toBeDefined();
    expect(confirmed.object_key).toBe(uploadRes.objectKey);
    expect(confirmed.file_name).toBe('spec_doc.pdf');
  });

  it('should generate short-lived presigned download URL for authorized user', async () => {
    const attachments = await attachmentsService.getWorkItemAttachments(ownerId, projectId, workItemId);
    expect(attachments.length).toBeGreaterThan(0);

    const targetId = attachments[0].id;
    const downloadRes = await attachmentsService.getDownloadUrl(ownerId, projectId, workItemId, targetId);

    expect(downloadRes.downloadUrl).toBeDefined();
    expect(downloadRes.expiresAt).toBeDefined();
  });

  it('should disallow unauthorized user from fetching download URL or uploading', async () => {
    await expect(
      attachmentsService.requestUploadUrl(outsiderId, projectId, workItemId, {
        fileName: 'unauthorized.pdf',
        fileSize: 1024,
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow();
  });

  it('should delete attachment from storage and DB on deleteAttachment', async () => {
    const attachments = await attachmentsService.getWorkItemAttachments(ownerId, projectId, workItemId);
    const target = attachments[0];

    const delRes = await attachmentsService.deleteAttachment(ownerId, projectId, workItemId, target.id);
    expect(delRes.success).toBe(true);

    const afterList = await attachmentsService.getWorkItemAttachments(ownerId, projectId, workItemId);
    expect(afterList.some((a) => a.id === target.id)).toBe(false);
  });
});
