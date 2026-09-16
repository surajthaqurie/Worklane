import { Kysely, PostgresDialect, Generated, ColumnType } from 'kysely';
import { Pool } from 'pg';

export interface Database {
  users: {
    id: Generated<string>;
    name: string;
    email: string;
    avatar_url: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  projects: {
    id: Generated<string>;
    name: string;
    description: string | null;
    key: string;
    created_by: string;
    archived: Generated<boolean>;
    next_work_item_seq: Generated<number>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  project_members: {
    id: Generated<string>;
    project_id: string;
    user_id: string;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  sprints: {
    id: Generated<string>;
    project_id: string;
    name: string;
    goal: string | null;
    start_date: ColumnType<Date, string | Date, string | Date>;
    end_date: ColumnType<Date, string | Date, string | Date>;
    state: Generated<'PLANNED' | 'ACTIVE' | 'COMPLETED'>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  work_items: {
    id: Generated<string>;
    project_id: string;
    sprint_id: string | null;
    seq_no: number;
    parent_id: string | null;
    type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
    title: string;
    description: string | null;
    state: string;
    priority: Generated<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>;
    points: number | null;
    assigned_to: string | null;
    created_by: string;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
    completed_at: ColumnType<
      Date | null,
      string | undefined | null,
      string | Date | null
    >;
    search_vector: ColumnType<any, never, never>;
  };
  work_item_states: {
    id: Generated<string>;
    project_id: string;
    name: string;
    key: string;
    color: string;
    sort_order: number;
    is_done: Generated<boolean>;
    is_default: Generated<boolean>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  sprint_history: {
    id: Generated<string>;
    sprint_id: string | null;
    user_id: string;
    action: string;
    field: string | null;
    old_value: string | null;
    new_value: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  saved_queries: {
    id: Generated<string>;
    project_id: string;
    name: string;
    description: string | null;
    is_shared: Generated<boolean>;
    created_by: string;
    folder: string | null;
    definition: any;
    sort_order: Generated<number>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  work_item_comments: {
    id: Generated<string>;
    work_item_id: string;
    user_id: string;
    content: string;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  work_item_history: {
    id: Generated<string>;
    work_item_id: string | null;
    user_id: string;
    action: string;
    field: string | null;
    old_value: string | null;
    new_value: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5434/todoapp',
    max: 10,
  }),
});

export const db = new Kysely<Database>({
  dialect,
});
