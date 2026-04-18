// Shared logic for /v1 endpoints: validate API key, load session, log calls.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashApiKey, isValidKeyShape } from "@/lib/api-keys.server";

export type AuthedKey = {
  apiKeyId: string;
  userId: string;
  sessionId: string;
  upstreamSessionId: string | null;
  upstreamToken: string | null;
};

export async function authenticateApiKey(req: Request): Promise<AuthedKey | { error: string; status: number }> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: "Missing Authorization: Bearer <api_key> header", status: 401 };
  const key = m[1].trim();
  if (!isValidKeyShape(key)) return { error: "Invalid API key format", status: 401 };

  const hash = hashApiKey(key);
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, session_id, revoked_at, sessions:session_id(id, upstream_session_id, upstream_token)")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error) return { error: "Auth lookup failed", status: 500 };
  if (!data) return { error: "Invalid API key", status: 401 };
  if (data.revoked_at) return { error: "API key revoked", status: 401 };

  // Touch last_used_at fire-and-forget
  void supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  const sess = (data.sessions ?? null) as { id: string; upstream_session_id: string | null; upstream_token: string | null } | null;
  return {
    apiKeyId: data.id,
    userId: data.user_id,
    sessionId: data.session_id,
    upstreamSessionId: sess?.upstream_session_id ?? null,
    upstreamToken: sess?.upstream_token ?? null,
  };
}

export async function logCall(args: {
  userId: string;
  sessionId: string;
  apiKeyId: string;
  type: string;
  recipient: string | null;
  request: unknown;
  response: unknown;
  status: number;
  durationMs: number;
  error: string | null;
}) {
  await supabaseAdmin.from("message_logs").insert({
    user_id: args.userId,
    session_id: args.sessionId,
    api_key_id: args.apiKeyId,
    direction: "outbound",
    type: args.type,
    recipient: args.recipient,
    request_body: args.request as never,
    response_body: args.response as never,
    status_code: args.status,
    duration_ms: args.durationMs,
    error: args.error,
  });
}
