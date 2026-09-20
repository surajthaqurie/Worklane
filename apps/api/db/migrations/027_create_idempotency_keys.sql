-- db/migrations/027_create_idempotency_keys.sql

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL,
  path VARCHAR(255) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_idempotency_key_user UNIQUE (key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key_user ON idempotency_keys(key, user_id);
