import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { db } from '../../db/kysely.js';

const INTEGRATION = process.env.INTEGRATION === '1';

describe.skipIf(!INTEGRATION)('Notifications, Followers & Mentions DB Integration (Phase 14)', () => {
  let service: NotificationsService;
  let repo: NotificationsRepository;
  let gateway: NotificationsGateway;

  let ownerId: string;
  let memberId: string;
  let outsiderId: string;
  let projectId: string;
  let workItemId: string;

  beforeAll(async () => {
    repo = new NotificationsRepository();
    gateway = {
      sendNotificationToUser: vi.fn(),
    } as any;
    const authz = new AuthorizationService();

    service = new NotificationsService(repo, gateway, authz);

    const users = await db.selectFrom('users').select(['id', 'email', 'name']).limit(3).execute();
    ownerId = users[0].id;
    memberId = users[1]?.id || ownerId;
    outsiderId = users[2]?.id || '00000000-0000-0000-0000-000000000000';

    const proj = await db
      .insertInto('projects')
      .values({
        name: 'Notification Integration Proj',
        key: `NOTIF${Date.now().toString().slice(-4)}`,
        created_by: ownerId,
        organization_id: '00000000-0000-0000-0000-000000000000',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    projectId = proj.id;

    await db.insertInto('project_members').values([
      { project_id: projectId, user_id: ownerId, role: 'OWNER' },
      { project_id: projectId, user_id: memberId, role: 'MEMBER' },
    ]).execute();

    const area = await db.insertInto('areas').values({
      project_id: projectId,
      name: 'Root Area',
    }).returningAll().executeTakeFirstOrThrow();

    await db.insertInto('work_item_states').values([
      { project_id: projectId, key: 'New', name: 'New', color: '#94A3B8', category: 'PROPOSED', sort_order: 1, is_done: false },
    ]).execute();

    const wi = await db
      .insertInto('work_items')
      .values({
        project_id: projectId,
        seq_no: 1,
        title: 'Followers Test Work Item',
        type: 'STORY',
        state: 'New',
        created_by: ownerId,
        area_id: area.id,
        backlog_order: 1,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    workItemId = wi.id;
  });

  it('should manage follow / unfollow status correctly', async () => {
    const followRes = await service.followWorkItem(memberId, projectId, workItemId);
    expect(followRes.isFollowing).toBe(true);

    const status = await service.getFollowStatus(memberId, projectId, workItemId);
    expect(status.isFollowing).toBe(true);
    expect(status.followerCount).toBeGreaterThanOrEqual(1);

    const followers = await service.getWorkItemFollowers(memberId, projectId, workItemId);
    expect(followers.some((f) => f.userId === memberId)).toBe(true);

    const unfollowRes = await service.unfollowWorkItem(memberId, projectId, workItemId);
    expect(unfollowRes.isFollowing).toBe(false);
  });

  it('should parse mentions and validate project membership (reject arbitrary targets)', async () => {
    // Mention memberId (valid) and outsiderId (not a project member)
    const text = `Hey @${memberId} and @${outsiderId}, please review!`;

    const verifiedMentions = await service.parseAndValidateMentions(projectId, text);

    expect(verifiedMentions).toContain(memberId);
    expect(verifiedMentions).not.toContain(outsiderId);
  });

  it('should create and retrieve user notification preferences', async () => {
    const initialPrefs = await service.getUserPreferences(memberId);
    expect(initialPrefs.channelInApp).toBe(true);

    const updated = await service.updateUserPreferences(memberId, {
      notifyFollowed: false,
    });

    expect(updated.notifyFollowed).toBe(false);
  });
});
