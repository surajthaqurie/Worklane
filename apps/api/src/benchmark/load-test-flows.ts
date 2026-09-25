import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/kysely.js';
import { sql } from 'kysely';

export interface FlowBenchmarkResult {
  flow: string;
  operations: number;
  totalTimeMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  opsPerSec: number;
  successRate: number;
}

export class LoadTestRunner {
  private jwtSecret = process.env.JWT_SECRET || 'super-secret-worklane-access-key-change-in-production';

  private calculatePercentiles(latencies: number[]): { p50: number; p95: number; p99: number; avg: number } {
    if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0 };
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    return {
      p50: Math.round(p50 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
      avg: Math.round(avg * 100) / 100,
    };
  }

  async runFlow(name: string, iterations: number, fn: () => Promise<void>): Promise<FlowBenchmarkResult> {
    const latencies: number[] = [];
    let successes = 0;

    // Warmup
    try {
      await fn();
    } catch {
      // ignore warmup failure
    }

    const startTotal = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      try {
        await fn();
        const elapsed = performance.now() - t0;
        latencies.push(elapsed);
        successes++;
      } catch (err) {
        console.error(`Flow ${name} iteration ${i} failed:`, err);
      }
    }
    const totalTimeMs = performance.now() - startTotal;
    const stats = this.calculatePercentiles(latencies);
    const opsPerSec = Math.round((successes / (totalTimeMs / 1000)) * 10) / 10;

    return {
      flow: name,
      operations: iterations,
      totalTimeMs: Math.round(totalTimeMs * 10) / 10,
      p50Ms: stats.p50,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
      avgMs: stats.avg,
      opsPerSec,
      successRate: Math.round((successes / iterations) * 100),
    };
  }

  async runAll(): Promise<FlowBenchmarkResult[]> {
    console.log('⚡ Starting Worklane Load Test for Core Flows...');
    const results: FlowBenchmarkResult[] = [];

    // Ensure test user, project, area, board, and work items exist
    const testUser = await db
      .selectFrom('users')
      .selectAll()
      .limit(1)
      .executeTakeFirst();

    if (!testUser) {
      throw new Error('No user found in database. Please run seed first.');
    }

    let testProject = await db
      .selectFrom('projects')
      .selectAll()
      .limit(1)
      .executeTakeFirst();

    if (!testProject) {
      testProject = await db
        .insertInto('projects')
        .values({
          name: 'Load Test Project',
          key: 'LOAD',
          organization_id: '00000000-0000-0000-0000-000000000000',
          created_by: testUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    let testArea = await db
      .selectFrom('areas')
      .where('project_id', '=', testProject.id)
      .selectAll()
      .limit(1)
      .executeTakeFirst();

    if (!testArea) {
      testArea = await db
        .insertInto('areas')
        .values({
          project_id: testProject.id,
          name: 'Core Area',
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    let testBoard = await db
      .selectFrom('boards')
      .where('project_id', '=', testProject.id)
      .selectAll()
      .limit(1)
      .executeTakeFirst();

    if (!testBoard) {
      testBoard = await db
        .insertInto('boards')
        .values({
          project_id: testProject.id,
          name: 'Kanban Board',
          swimlane: 'default',
          columns: JSON.stringify([{ id: 'todo', name: 'To Do', stateKey: 'PROPOSED' }]),
          card_fields: JSON.stringify(['seq_no', 'title', 'assigned_to']),
          filter_config: JSON.stringify({}),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    // Ensure project states exist
    let projectStates = await db
      .selectFrom('work_item_states')
      .where('project_id', '=', testProject.id)
      .selectAll()
      .execute();

    if (projectStates.length === 0) {
      await db
        .insertInto('work_item_states')
        .values([
          { project_id: testProject.id, name: 'To Do', key: 'TODO', color: '#94A3B8', sort_order: 0, is_done: false, is_default: true },
          { project_id: testProject.id, name: 'In Progress', key: 'IN_PROGRESS', color: '#3B82F6', sort_order: 1, is_done: false, is_default: false },
          { project_id: testProject.id, name: 'Done', key: 'DONE', color: '#22C55E', sort_order: 2, is_done: true, is_default: false },
        ])
        .execute();
      projectStates = await db
        .selectFrom('work_item_states')
        .where('project_id', '=', testProject.id)
        .selectAll()
        .execute();
    }

    const stateKey1 = projectStates[0]?.key || 'TODO';
    const stateKey2 = projectStates[1]?.key || projectStates[0]?.key || 'TODO';

    // Seed realistic batch of work items if count is small (< 50)
    const existingCountRes = await db
      .selectFrom('work_items')
      .where('project_id', '=', testProject.id)
      .select(sql<number>`count(*)::int`.as('cnt'))
      .executeTakeFirst();

    const existingCount = existingCountRes?.cnt || 0;
    if (existingCount < 50) {
      console.log(`Seeding realistic work items (current: ${existingCount})...`);
      const itemsToInsert = [];
      for (let i = 1; i <= 50; i++) {
        itemsToInsert.push({
          project_id: testProject.id,
          area_id: testArea.id,
          seq_no: existingCount + i,
          type: 'STORY' as const,
          title: `Load Test Work Item #${existingCount + i}: Production benchmark item`,
          description: `Comprehensive benchmark description for work item ${i} testing queries, fulltext search, and bulk operations.`,
          state: i % 2 === 0 ? stateKey2 : stateKey1,
          priority: 'MEDIUM' as const,
          created_by: testUser.id,
          backlog_order: i,
        });
      }
      await db.insertInto('work_items').values(itemsToInsert).execute();
    }

    const sampleWorkItems = await db
      .selectFrom('work_items')
      .where('project_id', '=', testProject.id)
      .select(['id', 'seq_no'])
      .limit(25)
      .execute();
    const sampleIds = sampleWorkItems.map((w) => w.id);

    // 1. Flow: Login
    console.log('Testing Flow: login...');
    const hashedPass = testUser.password_hash || (await bcrypt.hash('WorklaneAdmin2026!', 10));
    results.push(
      await this.runFlow('login', 50, async () => {
        // Authenticate password with bcrypt and sign token
        const match = await bcrypt.compare('WorklaneAdmin2026!', hashedPass);
        if (!match) throw new Error('Password mismatch in benchmark');
        jwt.sign({ sub: testUser.id, email: testUser.email }, this.jwtSecret, { expiresIn: '15m' });
      }),
    );

    // 2. Flow: Work-Item List
    console.log('Testing Flow: work-item list...');
    results.push(
      await this.runFlow('work-item list', 100, async () => {
        await db
          .selectFrom('work_items')
          .where('project_id', '=', testProject.id)
          .where('state', 'in', [stateKey1, stateKey2])
          .select(['id', 'seq_no', 'title', 'state', 'priority', 'assigned_to', 'created_at'])
          .orderBy('created_at', 'desc')
          .limit(50)
          .offset(0)
          .execute();
      }),
    );

    // 3. Flow: Backlog
    console.log('Testing Flow: backlog...');
    results.push(
      await this.runFlow('backlog', 100, async () => {
        await db
          .selectFrom('work_items as wi')
          .where('wi.project_id', '=', testProject.id)
          .where('wi.parent_id', 'is', null)
          .select([
            'wi.id',
            'wi.seq_no',
            'wi.title',
            'wi.state',
            'wi.priority',
            'wi.backlog_rank',
            sql<number>`(SELECT count(*)::int FROM work_items ch WHERE ch.parent_id = wi.id)`.as('child_count'),
          ])
          .orderBy('wi.backlog_rank', 'asc')
          .limit(100)
          .execute();
      }),
    );

    // 4. Flow: Board
    console.log('Testing Flow: board...');
    results.push(
      await this.runFlow('board', 100, async () => {
        const board = await db
          .selectFrom('boards')
          .where('id', '=', testBoard.id)
          .selectAll()
          .executeTakeFirst();
        if (!board) throw new Error('Board not found');

        await db
          .selectFrom('work_items')
          .where('project_id', '=', testProject.id)
          .select(['id', 'seq_no', 'title', 'state', 'priority', 'assigned_to', 'backlog_rank'])
          .orderBy('backlog_rank', 'asc')
          .limit(150)
          .execute();
      }),
    );

    // 5. Flow: Search
    console.log('Testing Flow: search...');
    results.push(
      await this.runFlow('search', 100, async () => {
        await db
          .selectFrom('work_items')
          .where('project_id', '=', testProject.id)
          .where((eb) =>
            eb.or([
              sql<boolean>`search_vector @@ plainto_tsquery('english', 'Production benchmark')`,
              eb('title', 'ilike', '%benchmark%'),
            ]),
          )
          .select(['id', 'seq_no', 'title', 'state'])
          .limit(50)
          .execute();
      }),
    );

    // 6. Flow: Bulk Update
    console.log('Testing Flow: bulk update...');
    results.push(
      await this.runFlow('bulk update', 50, async () => {
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable('work_items')
            .set({
              priority: 'HIGH',
              updated_at: new Date(),
            })
            .where('id', 'in', sampleIds)
            .execute();
        });
      }),
    );

    // 7. Flow: Comments
    console.log('Testing Flow: comments...');
    const targetItemId = sampleIds[0] || '00000000-0000-0000-0000-000000000001';
    results.push(
      await this.runFlow('comments', 50, async () => {
        // Fetch comments
        await db
          .selectFrom('work_item_comments')
          .where('work_item_id', '=', targetItemId)
          .where('deleted_at', 'is', null)
          .selectAll()
          .orderBy('created_at', 'asc')
          .execute();

        // Create comment
        await db
          .insertInto('work_item_comments')
          .values({
            work_item_id: targetItemId,
            user_id: testUser.id,
            content: `Automated load test comment ${Date.now()}`,
          })
          .returning('id')
          .executeTakeFirst();
      }),
    );

    // 8. Flow: Notifications
    console.log('Testing Flow: notifications...');
    results.push(
      await this.runFlow('notifications', 100, async () => {
        // Query unread count
        await db
          .selectFrom('notifications')
          .where('user_id', '=', testUser.id)
          .where('read_at', 'is', null)
          .select(sql<number>`count(*)::int`.as('unread_count'))
          .executeTakeFirst();

        // Query notification feed
        await db
          .selectFrom('notifications')
          .where('user_id', '=', testUser.id)
          .selectAll()
          .orderBy('created_at', 'desc')
          .limit(20)
          .execute();
      }),
    );

    return results;
  }
}

async function main() {
  const runner = new LoadTestRunner();
  const results = await runner.runAll();

  console.log('\n========================================================================================');
  console.log('🚀 WORKLANE PRODUCTION LOAD TEST RESULTS');
  console.log('========================================================================================');
  console.log(
    'Flow'.padEnd(18) +
      'Ops'.padEnd(8) +
      'Success'.padEnd(10) +
      'Total(ms)'.padEnd(12) +
      'P50(ms)'.padEnd(10) +
      'P95(ms)'.padEnd(10) +
      'P99(ms)'.padEnd(10) +
      'Throughput(req/s)',
  );
  console.log('-'.repeat(88));

  for (const r of results) {
    console.log(
      r.flow.padEnd(18) +
        String(r.operations).padEnd(8) +
        `${r.successRate}%`.padEnd(10) +
        String(r.totalTimeMs).padEnd(12) +
        String(r.p50Ms).padEnd(10) +
        String(r.p95Ms).padEnd(10) +
        String(r.p99Ms).padEnd(10) +
        `${r.opsPerSec} ops/s`,
    );
  }
  console.log('========================================================================================\n');
}

if (process.argv[1]?.includes('load-test-flows')) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Load test runner failed:', err);
      process.exit(1);
    });
}
