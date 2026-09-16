import { Kysely, PostgresDialect, Generated, ColumnType } from 'kysely';
import { Pool } from 'pg';

export interface Database {
  organizations: {
    id: Generated<string>;
    name: string;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  users: {
    id: Generated<string>;
    name: string;
    email: string;
    avatar_url: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  projects: {
    id: Generated<string>;
    organization_id: string;
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
  teams: {
    id: Generated<string>;
    project_id: string;
    name: string;
    description: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  areas: {
    id: Generated<string>;
    project_id: string;
    name: string;
    parent_id: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  tags: {
    id: Generated<string>;
    project_id: string;
    name: string;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  work_item_tags: {
    work_item_id: string;
    tag_id: string;
  };
  iterations: {
    id: Generated<string>;
    project_id: string;
    name: string;
    goal: string | null;
    start_date: ColumnType<Date, string | Date, string | Date>;
    end_date: ColumnType<Date, string | Date, string | Date>;
    state: Generated<'PLANNED' | 'ACTIVE' | 'COMPLETED'>;
    parent_id: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  work_items: {
    id: Generated<string>;
    project_id: string;
    iteration_id: string | null;
    area_id: string;
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
    completed_at: ColumnType<Date | null, string | undefined | null, string | Date | null>;
    closed_at: ColumnType<Date | null, string | undefined | null, string | Date | null>;
    search_vector: ColumnType<any, never, never>;
    backlog_order: number;
    backlog_rank: Generated<number>;
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
  iteration_history: {
    id: Generated<string>;
    iteration_id: string | null;
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
  work_item_attachments: {
    id: Generated<string>;
    work_item_id: string;
    user_id: string;
    file_name: string;
    file_size: number;
    content_type: string;
    url: string;
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
