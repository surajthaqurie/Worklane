import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5434/todoapp';

  console.log(`[Migrations] Connecting to database: ${connectionString.replace(/:[^:@]+@/, ':***@')}...`);
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Fetch applied migrations
    const res = await client.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY id ASC');
    const applied = new Set(res.rows.map((r) => r.name));

    // Migration directory
    let migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.resolve(__dirname, '../../db/migrations');
    }

    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[Migrations] No migrations directory found at ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // If schema_migrations is empty but tables already exist, bootstrap baseline
    if (applied.size === 0) {
      const existingTables = await client.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects', 'users', 'work_items')"
      );
      if (existingTables.rows.length >= 2) {
        console.log('[Migrations] Pre-existing schema detected. Synchronizing baseline in schema_migrations...');
        for (const file of files) {
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
          applied.add(file);
        }
      }
    }

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      console.log(`[Migrations] Applying ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migrations] ✓ Successfully applied ${file}`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrations] ✗ Failed to apply ${file}:`, err);
        throw err;
      }
    }

    if (count === 0) {
      console.log(`[Migrations] Database schema is up to date (${files.length} migrations applied).`);
    } else {
      console.log(`[Migrations] Successfully applied ${count} new migrations.`);
    }
  } finally {
    await client.end();
  }
}

// Allow running directly via tsx
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migrations] Fatal error:', err);
      process.exit(1);
    });
}
