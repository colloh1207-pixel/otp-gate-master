
-- Helper function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== sessions =====
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  upstream_session_id TEXT,
  upstream_token TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users can read own sessions, but the upstream_token column is exposed.
-- We keep RLS owner-scoped; server functions use admin client for token reads.
CREATE POLICY "Users view own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public-safe view that hides upstream_token from the browser
CREATE VIEW public.sessions_public
WITH (security_invoker = true)
AS
SELECT id, user_id, name, phone_number, status, last_connected_at, created_at, updated_at
FROM public.sessions;

-- ===== api_keys =====
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_session_id ON public.api_keys(session_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api_keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own api_keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own api_keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own api_keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Hide key_hash from the browser
CREATE VIEW public.api_keys_public
WITH (security_invoker = true)
AS
SELECT id, user_id, session_id, label, key_prefix, last_used_at, revoked_at, created_at
FROM public.api_keys;

-- ===== message_logs =====
CREATE TABLE public.message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  type TEXT NOT NULL,
  recipient TEXT,
  request_body JSONB,
  response_body JSONB,
  status_code INTEGER,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_logs_user_id ON public.message_logs(user_id);
CREATE INDEX idx_message_logs_session_id ON public.message_logs(session_id);
CREATE INDEX idx_message_logs_created_at ON public.message_logs(created_at DESC);
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own message_logs"
  ON public.message_logs FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own message_logs"
  ON public.message_logs FOR DELETE
  USING (auth.uid() = user_id);
-- inserts only via server (admin client)

-- ===== templates =====
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_user_id ON public.templates(user_id);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own templates"
  ON public.templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own templates"
  ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own templates"
  ON public.templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own templates"
  ON public.templates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== webhook_events =====
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_events_session_id ON public.webhook_events(session_id);
CREATE INDEX idx_webhook_events_received_at ON public.webhook_events(received_at DESC);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own webhook_events"
  ON public.webhook_events FOR SELECT
  USING (auth.uid() = user_id);
-- inserts only via server (admin client)
