import { Client } from 'pg';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL || 'postgres://postgres:root@localhost:5434/todoapp';

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function upsertUser(
  client: Client,
  { id, name, email }: { id: string; name: string; email: string },
): Promise<void> {
  await client.query(
    `INSERT INTO users (id, name, email) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, email],
  );
}

async function disableHistoryMutation(client: Client): Promise<void> {
  await client.query('ALTER TABLE work_item_history DISABLE TRIGGER work_item_history_immutable');
}

async function enableHistoryMutation(client: Client): Promise<void> {
  await client.query('ALTER TABLE work_item_history ENABLE TRIGGER work_item_history_immutable');
}

/**
 * Deletes an E2E project (cascading to work items, iterations, boards, etc.)
 * and the dedicated interactive users. The audit log is immutable, so the
 * history trigger must be temporarily disabled for the user cascade to apply.
 */
export async function deleteE2EProject(
  client: Client,
  projectId: string,
  userIds: string[],
): Promise<void> {
  await disableHistoryMutation(client);
  try {
    await client.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await client.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
  } finally {
    await enableHistoryMutation(client);
  }
}