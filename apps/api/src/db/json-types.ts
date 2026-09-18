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

/**
 * Parses a jsonb value that may arrive as an already-parsed object/array or as
 * raw JSON text (legacy text columns). Returns `null` for empty values.
 */
export function parseJson<T>(value: T | string | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value;
}

export function parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
  const parsed = parseJson<T[]>(value);
  return Array.isArray(parsed) ? parsed : [];
}

export function parseJsonObject<T extends Record<string, unknown>>(
  value: T | Record<string, unknown> | string | null | undefined,
): T {
  return (parseJson<T | Record<string, unknown>>(value) ?? {}) as T;
}