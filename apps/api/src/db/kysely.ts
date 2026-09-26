import { Kysely, PostgresDialect, Generated, ColumnType } from 'kysely';
import { Pool } from 'pg';
import type {
  BoardCardFieldsJson,
  BoardColumnsJson,
  BoardFilterConfigJson,
  QueryDefinitionJson,
  TeamBacklogConfig,
  TeamBoardConfig,
  NotificationMetadataJson,
  DashboardWidgetLayoutItem,
} from './json-types.js';

export interface Database {
  organizations: {
    id: Generated<string>;
    name: string;
    description: string | null;
    created_by: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  organization_members: {
    id: Generated<string>;
    organization_id: string;
    user_id: string;
    role: Generated<'OWNER' | 'ADMIN' | 'MEMBER'>;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  users: {
    id: Generated<string>;
    name: string;
    email: string;
    password_hash: string | null;
    avatar_url: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  refresh_tokens: {
    id: Generated<string>;
    user_id: string;
    token_hash: string;
    expires_at: ColumnType<Date, string | Date, string | Date>;
    revoked: Generated<boolean>;
    created_at: ColumnType<Date, string | undefined, never>;
    replaced_by_token_id: string | null;
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
    role: Generated<'OWNER' | 'ADMIN' | 'MEMBER'>;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  teams: {
    id: Generated<string>;
    project_id: string;
    name: string;
    description: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  team_members: {
    team_id: string;
    user_id: string;
    role: Generated<'ADMIN' | 'MEMBER'>;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  team_configurations: {
    team_id: string;
    board_config: ColumnType<
      TeamBoardConfig | Record<string, unknown>,
      TeamBoardConfig | Record<string, unknown> | string,
      TeamBoardConfig | Record<string, unknown> | string
    >;
    backlog_config: ColumnType<
      TeamBacklogConfig | Record<string, unknown>,
      TeamBacklogConfig | Record<string, unknown> | string,
      TeamBacklogConfig | Record<string, unknown> | string
    >;
    default_iteration_id: string | null;
    default_area_id: string | null;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  team_iterations: {
    team_id: string;
    iteration_id: string;
  };
  team_areas: {
    team_id: string;
    area_id: string;
  };
  delivery_plans: {
    id: Generated<string>;
    project_id: string;
    name: string;
    description: string | null;
    created_by: string;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  delivery_plan_teams: {
    plan_id: string;
    team_id: string;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  work_item_links: {
    id: Generated<string>;
    project_id: string;
    source_work_item_id: string;
    target_work_item_id: string;
    link_type: Generated<'DEPENDS_ON' | 'RELATED'>;
    created_by: string;
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
    search_vector: ColumnType<never, never, never>;
    severity: ColumnType<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null | undefined, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null | undefined>;
    remaining_work: number | null;
    completed_work: number | null;
    start_date: ColumnType<Date | null, string | Date | null | undefined, string | Date | null | undefined>;
    target_date: ColumnType<Date | null, string | Date | null | undefined, string | Date | null | undefined>;
    custom_fields: ColumnType<Record<string, unknown>, Record<string, unknown> | string | undefined, Record<string, unknown> | string | undefined>;
    backlog_order: number;
    backlog_rank: Generated<number>;
    version: Generated<number>;
  };
  work_item_states: {
    id: Generated<string>;
    project_id: string;
    name: string;
    key: string;
    color: string;
    sort_order: number;
    category: Generated<'PROPOSED' | 'IN_PROGRESS' | 'RESOLVED' | 'COMPLETED'>;
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
    definition: ColumnType<
      QueryDefinitionJson | string,
      QueryDefinitionJson | string,
      QueryDefinitionJson | string
    >;
    sort_order: Generated<number>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  query_runs: {
    id: Generated<string>;
    project_id: string;
    query_id: string | null;
    user_id: string;
    definition: ColumnType<
      QueryDefinitionJson | string | null,
      QueryDefinitionJson | string | null,
      QueryDefinitionJson | string | null
    >;
    ran_at: ColumnType<Date, string | undefined, never>;
  };
  work_item_comments: {
    id: Generated<string>;
    work_item_id: string;
    user_id: string;
    content: string;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
    deleted_at: ColumnType<Date | null, string | undefined | null, string | Date | null>;
    version: Generated<number>;
  };
  work_item_history: {
    id: Generated<string>;
    work_item_id: string;
    user_id: string;
    action: string;
    field: string | null;
    old_value: string | null;
    new_value: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
    inserted_at: ColumnType<Date, string | undefined, never>;
  };
  work_item_attachments: {
    id: Generated<string>;
    work_item_id: string;
    user_id: string;
    file_name: string;
    file_size: number;
    content_type: string;
    url: string;
    object_key: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  notifications: {
    id: Generated<string>;
    user_id: string;
    type: string;
    work_item_id: string | null;
    actor_id: string;
    metadata: ColumnType<
      NotificationMetadataJson | string,
      NotificationMetadataJson | string,
      NotificationMetadataJson | string
    >;
    read_at: ColumnType<Date | null, string | undefined | null, string | Date | null>;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  boards: {
    id: Generated<string>;
    project_id: string;
    team_id: string | null;
    name: string;
    description: string | null;
    is_default: Generated<boolean>;
    swimlane: ColumnType<string, string, string>;
    columns: ColumnType<BoardColumnsJson | string, BoardColumnsJson | string, BoardColumnsJson | string>;
    card_fields: ColumnType<BoardCardFieldsJson | string, BoardCardFieldsJson | string, BoardCardFieldsJson | string>;
    filter_config: ColumnType<BoardFilterConfigJson | string, BoardFilterConfigJson | string, BoardFilterConfigJson | string>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
    version: Generated<number>;
  };
  security_audit_logs: {
    id: Generated<string>;
    event_type: string;
    user_id: string | null;
    project_id: string | null;
    ip_address: string | null;
    details: ColumnType<
      Record<string, unknown> | string,
      Record<string, unknown> | string,
      Record<string, unknown> | string
    >;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  idempotency_keys: {
    id: Generated<string>;
    key: string;
    user_id: string;
    path: string;
    response_status: number;
    response_body: ColumnType<
      Record<string, unknown> | string,
      Record<string, unknown> | string,
      Record<string, unknown> | string
    >;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  work_item_followers: {
    work_item_id: string;
    user_id: string;
    created_at: ColumnType<Date, string | undefined, never>;
  };
  user_notification_preferences: {
    user_id: string;
    channel_in_app: Generated<boolean>;
    channel_email: Generated<boolean>;
    notify_mentions: Generated<boolean>;
    notify_assigned: Generated<boolean>;
    notify_followed: Generated<boolean>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  background_jobs: {
    id: Generated<string>;
    job_type: string;
    idempotency_key: string | null;
    status: Generated<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER'>;
    payload: ColumnType<Record<string, unknown>, Record<string, unknown> | string, Record<string, unknown> | string>;
    result: ColumnType<Record<string, unknown> | null, Record<string, unknown> | string | null, Record<string, unknown> | string | null>;
    error_message: string | null;
    attempts: Generated<number>;
    max_retries: Generated<number>;
    progress: Generated<number>;
    created_at: ColumnType<Date, string | undefined, never>;
    started_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
    completed_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  };
  analytics_snapshots: {
    id: Generated<string>;
    project_id: string;
    kind: string;
    scope_key: string;
    scope: ColumnType<Record<string, unknown> | string, Record<string, unknown> | string, Record<string, unknown> | string>;
    data: ColumnType<Record<string, unknown> | string, Record<string, unknown> | string, Record<string, unknown> | string>;
    item_count: Generated<number>;
    job_id: string | null;
    computed_at: Generated<Date>;
  };
  dashboard_layouts: {
    id: Generated<string>;
    user_id: string;
    project_id: string | null;
    widgets: ColumnType<DashboardWidgetLayoutItem[], DashboardWidgetLayoutItem[] | string, DashboardWidgetLayoutItem[] | string>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
  saved_reports: {
    id: Generated<string>;
    project_id: string;
    created_by: string;
    name: string;
    description: string | null;
    report_type: string;
    filters: ColumnType<Record<string, unknown>, Record<string, unknown> | string, Record<string, unknown> | string>;
    is_shared: Generated<boolean>;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, string | Date>;
  };
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:root@localhost:5434/todoapp',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT_MS || '5000', 10),
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool] Unexpected error on idle client:', err);
});

const dialect = new PostgresDialect({
  pool,
});

export const db = new Kysely<Database>({
  dialect,
});
