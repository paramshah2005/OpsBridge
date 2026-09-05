CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  github_repo_id BIGINT NOT NULL,
  author_login TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  message_type TEXT NOT NULL DEFAULT 'user_message',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_repo_created_idx
  ON messages (github_repo_id, created_at DESC);
