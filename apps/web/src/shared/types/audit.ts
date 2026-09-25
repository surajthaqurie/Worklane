export interface AuditRecordDiff {
  field: string;
  before: string | null;
  after: string | null;
  target?: string | null;
}

export interface AuditRecordActor {
  id: string | null;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface AuditRecord {
  id: string;
  eventType: string;
  actor: AuditRecordActor;
  projectId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown>;
  summary: string;
  diff?: AuditRecordDiff;
  createdAt: string;
}

export interface PaginatedAuditLog {
  items: AuditRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  actorId?: string;
  eventType?: string;
  from?: string;
  to?: string;
}
