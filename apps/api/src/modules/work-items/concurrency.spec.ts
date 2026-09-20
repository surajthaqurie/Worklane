import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkItemsService } from './work-items.service.js';
import { WorkItemTypeRegistryService } from './work-item-types.registry.js';
import { ConflictException } from '@nestjs/common';

describe('Optimistic Concurrency & History Immunity Tests', () => {
  let service: WorkItemsService;
  let mockRepo: any;
  let mockAuthz: any;

  const projectId = '11111111-1111-1111-1111-111111111111';
  const userId = '11111111-1111-1111-1111-111111111112';
  const itemId = '11111111-1111-1111-1111-111111111113';
  const commentId = '11111111-1111-1111-1111-111111111114';

  beforeEach(() => {
    mockRepo = {
      getWorkItemById: vi.fn(),
      updateWorkItem: vi.fn(),
      getComments: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
    };

    mockAuthz = {
      requireProjectPermission: vi.fn().mockResolvedValue({ projectId, userId, role: 'MEMBER' }),
      requireProjectPermissionWithProject: vi.fn().mockResolvedValue({
        project: { id: projectId, key: 'PROJ' },
        membership: { projectId, userId, role: 'MEMBER' },
      }),
    };

    const typeRegistry = new WorkItemTypeRegistryService();
    service = new WorkItemsService(
      mockRepo,
      {} as any,
      {} as any,
      mockAuthz,
      { notifyAssigned: vi.fn(), notifyParentChanged: vi.fn(), notifyAddedToSprint: vi.fn() } as any,
      typeRegistry,
    );
  });

  it('rejects work item update with 409 Conflict when expectedVersion does not match current version', async () => {
    mockRepo.getWorkItemById.mockResolvedValue({
      id: itemId,
      project_id: projectId,
      title: 'Initial Title',
      version: 5,
    });

    mockRepo.updateWorkItem.mockRejectedValue(
      new ConflictException('Conflict: Work item was updated by another user (expected version 4, actual version 5)'),
    );

    await expect(
      service.update(userId, itemId, {
        title: 'New Title',
        expectedVersion: 4, // Stale version!
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('accepts work item update when expectedVersion matches current version', async () => {
    mockRepo.getWorkItemById.mockResolvedValue({
      id: itemId,
      project_id: projectId,
      title: 'Initial Title',
      version: 5,
    });

    mockRepo.updateWorkItem.mockResolvedValue({
      id: itemId,
      project_id: projectId,
      title: 'New Title',
      version: 6,
      seq_no: 1,
    });

    const result = await service.update(userId, itemId, {
      title: 'New Title',
      expectedVersion: 5, // Exact match!
    } as any);

    expect(result).toBeDefined();
    expect(result.version).toBe(6);
  });

  it('rejects comment update with 409 Conflict on version mismatch', async () => {
    mockRepo.updateComment.mockRejectedValue(
      new ConflictException('Concurrent update detected: comment has been modified since it was loaded'),
    );

    await expect(
      mockRepo.updateComment(commentId, userId, 'Updated text', 1),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects comment deletion with 409 Conflict on version mismatch', async () => {
    mockRepo.deleteComment.mockRejectedValue(
      new ConflictException('Concurrent update detected: comment has been modified since it was loaded'),
    );

    await expect(
      mockRepo.deleteComment(commentId, userId, 1),
    ).rejects.toThrow(ConflictException);
  });
});
