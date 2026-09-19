import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkItemsService } from './work-items.service.js';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('WorkItemsService Parent Validation & Boundary Checks', () => {
  let service: WorkItemsService;
  let mockRepo: any;
  let mockAuthz: any;

  const projectIdA = '11111111-1111-1111-1111-111111111111';
  const projectIdB = '22222222-2222-2222-2222-222222222222';
  const userId = 'user-1';

  beforeEach(() => {
    mockRepo = {
      getWorkItemById: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
    };
    mockAuthz = {
      requireProjectPermission: vi.fn().mockResolvedValue({ projectId: projectIdA, userId, role: 'MEMBER' }),
      requireProjectPermissionWithProject: vi.fn().mockResolvedValue({
        project: { id: projectIdA, key: 'PROJ' },
        membership: { projectId: projectIdA, userId, role: 'MEMBER' },
      }),
    };

    service = new WorkItemsService(
      mockRepo,
      {} as any,
      {} as any,
      mockAuthz,
      { notifyAssigned: vi.fn(), notifyParentChanged: vi.fn() } as any,
    );
  });

  it('allows null parent when creating a work item', async () => {
    mockRepo.createWorkItem.mockResolvedValue({
      id: 'item-1',
      project_id: projectIdA,
      seq_no: 1,
      type: 'EPIC',
      title: 'Root Epic',
      state: 'TODO',
      created_by: userId,
    });

    const result = await service.create(userId, projectIdA, {
      title: 'Root Epic',
      type: 'EPIC',
      parentId: null,
    } as any);

    expect(result).toBeDefined();
    expect(result.id).toBe('item-1');
  });

  it('allows valid parent in same project with correct type hierarchy (FEATURE parent of STORY)', async () => {
    mockRepo.getWorkItemById.mockResolvedValue({
      id: 'parent-feature',
      project_id: projectIdA,
      type: 'FEATURE',
    });

    mockRepo.createWorkItem.mockResolvedValue({
      id: 'child-story',
      project_id: projectIdA,
      seq_no: 2,
      type: 'STORY',
      title: 'Child Story',
      parent_id: 'parent-feature',
      state: 'TODO',
      created_by: userId,
    });

    const result = await service.create(userId, projectIdA, {
      title: 'Child Story',
      type: 'STORY',
      parentId: 'parent-feature',
    } as any);

    expect(result).toBeDefined();
    expect(result.parentId).toBe('parent-feature');
  });

  it('rejects cross-project parent assignment', async () => {
    mockRepo.getWorkItemById.mockResolvedValue({
      id: 'parent-in-proj-b',
      project_id: projectIdB, // different project!
      type: 'FEATURE',
    });

    await expect(
      service.create(userId, projectIdA, {
        title: 'Child Story',
        type: 'STORY',
        parentId: 'parent-in-proj-b',
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects non-existent parent', async () => {
    mockRepo.getWorkItemById.mockResolvedValue(null);

    await expect(
      service.create(userId, projectIdA, {
        title: 'Child Story',
        type: 'STORY',
        parentId: 'non-existent-id',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid hierarchy type (TASK parent of EPIC)', async () => {
    mockRepo.getWorkItemById.mockResolvedValue({
      id: 'parent-task',
      project_id: projectIdA,
      type: 'TASK',
    });

    await expect(
      service.create(userId, projectIdA, {
        title: 'Epic Item',
        type: 'EPIC',
        parentId: 'parent-task',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects self-parent when updating a work item', async () => {
    mockRepo.getWorkItemById.mockResolvedValue({
      id: 'item-1',
      project_id: projectIdA,
      type: 'STORY',
    });

    await expect(
      service.update(userId, 'item-1', {
        parentId: 'item-1',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects circular dependency (A -> B -> A)', async () => {
    // Updating item-A to have parent item-B, but item-B already has parent item-A
    mockRepo.getWorkItemById.mockImplementation(async (id: string) => {
      if (id === 'item-A') {
        return { id: 'item-A', project_id: projectIdA, type: 'STORY', parent_id: null };
      }
      if (id === 'item-B') {
        return { id: 'item-B', project_id: projectIdA, type: 'FEATURE', parent_id: 'item-A' };
      }
      return null;
    });

    await expect(
      service.update(userId, 'item-A', {
        parentId: 'item-B',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
