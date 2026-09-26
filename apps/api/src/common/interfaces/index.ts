/**
 * Central system interfaces for the Worklane API application.
 * Defines standard contract shapes for API responses, pagination, and request contexts.
 */

export interface PaginationQueryParams {
  page?: number;
  limit?: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMetadata;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  details?: ApiErrorDetail[];
  timestamp: string;
  path?: string;
}

export interface AuthenticatedUserPayload {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  roles?: string[];
}

export interface BaseEntity {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
