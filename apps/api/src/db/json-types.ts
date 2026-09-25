import type {
  BoardColumn,
  CardFields,
  FilterConfig,
} from '../modules/boards/dto/boards.dto.js';
import type { QueryDefinition } from '../modules/queries/dto/queries.dto.js';
import type { NotificationMetadata } from '../modules/notifications/dto/notifications.dto.js';

/** Default team board layout configuration stored in `team_configurations.board_config`. */
export interface TeamBoardConfig {
  collapsedCategories: boolean;
  hideEmptyColumns: boolean;
}

/** Team backlog configuration stored in `team_configurations.backlog_config`. */
export interface TeamBacklogConfig {
  showInProgressItems: boolean;
}

export type BoardColumnsJson = BoardColumn[];
export type BoardCardFieldsJson = CardFields;
export type BoardFilterConfigJson = FilterConfig;
export type QueryDefinitionJson = QueryDefinition;
export type NotificationMetadataJson = NotificationMetadata;

export type WidgetType =
  | 'SPRINT_SUMMARY'
  | 'BURNDOWN'
  | 'VELOCITY'
  | 'MY_WORK_ITEMS'
  | 'BLOCKED_ITEMS'
  | 'ACTIVITY'
  | 'TEAM_PROGRESS';

export interface DashboardWidgetLayoutItem {
  id: string;
  type: WidgetType;
  position: number;
  colSpan: number;
  rowSpan?: number;
  visible: boolean;
  settings?: Record<string, unknown>;
}