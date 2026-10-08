CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  github_repo_id BIGINT NOT NULL,
  author_login TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  message_type TEXT NOT NULL DEFAULT 'user_message',
  message_category TEXT NOT NULL DEFAULT 'general'
    CHECK (message_category IN ('general', 'activity', 'security', 'deployment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_repo_created_idx
  ON messages (github_repo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  github_repo_id BIGINT NOT NULL UNIQUE,
  github_hook_id BIGINT UNIQUE,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'failed', 'disabled')),
  event_types TEXT[] NOT NULL,
  created_by_login TEXT NOT NULL,
  last_delivery_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  github_delivery_id TEXT NOT NULL UNIQUE,
  github_hook_id BIGINT,
  github_repo_id BIGINT NOT NULL,
  event_name TEXT NOT NULL,
  action TEXT,
  actor_login TEXT,
  pull_request_number BIGINT,
  pull_request_title TEXT,
  branch_name TEXT,
  commit_count INTEGER,
  occurred_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  processing_error TEXT,
  message_id BIGINT REFERENCES messages(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webhook_events_repo_received_idx
  ON webhook_events (github_repo_id, received_at DESC);

CREATE TABLE IF NOT EXISTS deployment_status_events (
  id BIGSERIAL PRIMARY KEY,
  github_repo_id BIGINT NOT NULL,
  deployment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success')),
  repository_name TEXT NOT NULL,
  environment TEXT,
  target_url TEXT,
  commit_sha TEXT,
  ref_name TEXT,
  raw_payload JSONB NOT NULL,
  message_id BIGINT REFERENCES messages(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (github_repo_id, deployment_id)
);

CREATE INDEX IF NOT EXISTS deployment_status_events_repo_occurred_idx
  ON deployment_status_events (github_repo_id, occurred_at DESC);

-- Backfill message_category for existing bot messages
UPDATE messages SET message_category = 'activity' WHERE author_login = 'opsbridge-bot' AND message_category = 'general';
UPDATE messages SET message_category = 'security' WHERE author_login = 'opsbridge-scan' AND message_category = 'general';
UPDATE messages SET message_category = 'deployment' WHERE author_login = 'opsbridge-deploy' AND message_category = 'general';
