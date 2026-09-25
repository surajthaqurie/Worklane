import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationsController } from './organizations.controller.js';
import type { OrganizationsService } from './organizations.service.js';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let service: Partial<OrganizationsService>;
  const mockUser: AuthenticatedUser = {
    id: 'user-1',
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      getMembers: vi.fn(),
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      getProjects: vi.fn(),
      getMyRole: vi.fn(),
    };

    controller = new OrganizationsController(service as OrganizationsService);
  });

  it('delegates findAll to service with user id', async () => {
    vi.mocked(service.findAll!).mockResolvedValue([]);
    await controller.findAll(mockUser);
    expect(service.findAll).toHaveBeenCalledWith('user-1');
  });

  it('delegates create to service with user id and dto', async () => {
    const dto = { name: 'Acme Org', description: 'Acme' };
    vi.mocked(service.create!).mockResolvedValue({ id: 'org-1', ...dto } as any);
    await controller.create(mockUser, dto);
    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates findOne to service with org id and user id', async () => {
    await controller.findOne(mockUser, 'org-1');
    expect(service.findOne).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('delegates update to service', async () => {
    const dto = { name: 'Updated Name' };
    await controller.update(mockUser, 'org-1', dto);
    expect(service.update).toHaveBeenCalledWith('org-1', 'user-1', dto);
  });

  it('delegates members actions to service', async () => {
    await controller.getMembers(mockUser, 'org-1');
    expect(service.getMembers).toHaveBeenCalledWith('org-1', 'user-1');

    const addDto = { email: 'test@example.com', role: 'MEMBER' as const };
    await controller.addMember(mockUser, 'org-1', addDto);
    expect(service.addMember).toHaveBeenCalledWith('org-1', 'user-1', addDto);

    await controller.updateMemberRole(mockUser, 'org-1', 'target-user', { role: 'ADMIN' });
    expect(service.updateMemberRole).toHaveBeenCalledWith('org-1', 'user-1', 'target-user', 'ADMIN');

    await controller.removeMember(mockUser, 'org-1', 'target-user');
    expect(service.removeMember).toHaveBeenCalledWith('org-1', 'user-1', 'target-user');
  });
});
