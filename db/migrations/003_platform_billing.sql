-- Only encrypted reusable tokens and masked card metadata; never PAN/CVV or raw provider payloads.
CREATE TABLE IF NOT EXISTS platform_billing_accounts (
  store_id BIGINT NOT NULL, environment TEXT NOT NULL CHECK (environment IN ('sandbox','production')),
  state JSONB NOT NULL DEFAULT '{"cards":[]}', operation_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(store_id, environment)
);
CREATE TABLE IF NOT EXISTS platform_billing_operations (
  store_id BIGINT NOT NULL, environment TEXT NOT NULL, request_id UUID NOT NULL,
  actor_id TEXT NOT NULL, action TEXT NOT NULL, fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','done','failed')), error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(store_id, environment, request_id)
);
CREATE TABLE IF NOT EXISTS platform_billing_events (
  environment TEXT NOT NULL, event_id TEXT NOT NULL, event_type TEXT NOT NULL,
  resource_id TEXT, received_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(environment,event_id)
);
