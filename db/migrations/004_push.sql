-- Persistent, tenant-scoped Push state. Apply before enabling the channel in production.
CREATE TABLE IF NOT EXISTS push_state (
  store_id BIGINT PRIMARY KEY,
  state JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
