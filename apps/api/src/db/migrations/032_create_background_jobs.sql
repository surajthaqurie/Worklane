-- Worklane Phase 15 — Background Job Infrastructure
-- Create background_jobs table for tracking background processing, retries, idempotency, and DLQ handling.

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_idempotency ON background_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
