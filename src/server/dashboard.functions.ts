// Server functions used by the authenticated dashboard.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upstreamFetch } from "@/lib/upstream.server";
import { generateApiKey } from "@/lib/api-keys.server";
import {
  sessionNameSchema,
  apiKeyLabelSchema,
  templateNameSchema,
  templateBodySchema,
  phoneSchema,
} from "@/lib/validators";
import { z } from "zod";

const idSchema = z.string().uuid();

type SessionRow = {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
  upstream_session_id: string | null;
  upstream_token: string | null;
};

type ClientSession = Pick<
  SessionRow,
  "id" | "name" | "phone_number" | "status" | "last_connected_at" | "created_at"
>;

type UpstreamSession = {
  id?: string;
  session_id?: string;
  token?: string;
  status?: string;
  live_status?: string | null;
  phone_number?: string | null;
  name?: string | null;
  connected_at?: number | null;
  has_qr?: boolean;
};

function normalizeSessionStatus(status: string | null | undefined, hasQr = false) {
  const value = (status ?? "unknown").toLowerCase();
  if (value === "qr" || (value === "pending" && hasQr)) return "awaiting_qr";
  if (value === "open" || value === "connected") return "connected";
  if (value === "close" || value === "closed" || value === "disconnected") return "disconnected";
  return value;
}

function getUpstreamSessionId(session: UpstreamSession) {
  return session.session_id ?? session.id ?? null;
}

function unixSecondsToIso(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : undefined;
}

function toClientSession(session: SessionRow): ClientSession {
  return {
    id: session.id,
    name: session.name,
    phone_number: session.phone_number,
    status: session.status,
    last_connected_at: session.last_connected_at,
    created_at: session.created_at,
  };
}

async function fetchUpstreamSessions() {
  const up = await upstreamFetch<UpstreamSession[]>("/api/sessions");
  return up.ok && Array.isArray(up.data) ? up.data : [];
}

function matchUpstreamSession(row: SessionRow, upstreamSessions: UpstreamSession[]) {
  const byId = upstreamSessions.find((session) => getUpstreamSessionId(session) === row.upstream_session_id);
  if (byId) return byId;

  const byToken = upstreamSessions.find((session) => session.token && session.token === row.upstream_token);
  if (byToken) return byToken;

  const nameMatches = upstreamSessions.filter(
    (session) => session.name?.trim().toLowerCase() === row.name.trim().toLowerCase(),
  );
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

async function syncSessionRows(rows: SessionRow[]) {
  if (rows.length === 0) return rows;

  const upstreamSessions = await fetchUpstreamSessions();

  return Promise.all(rows.map(async (row) => {
    const matched = matchUpstreamSession(row, upstreamSessions);
    const rowAgeMs = Date.now() - new Date(row.updated_at ?? row.created_at).getTime();
    const nextStatus = matched
      ? normalizeSessionStatus(matched.status ?? matched.live_status, matched.has_qr)
      : rowAgeMs > 60_000 && row.status !== "logged_out"
        ? "disconnected"
        : row.status;

    const updates: Partial<SessionRow> = {};
    const nextUpstreamSessionId = matched ? (getUpstreamSessionId(matched) ?? row.upstream_session_id) : row.upstream_session_id;
    const nextUpstreamToken = matched?.token ?? row.upstream_token;
    const nextPhoneNumber = matched && typeof matched.phone_number !== "undefined" ? matched.phone_number : row.phone_number;
    const nextLastConnectedAt = matched && nextStatus === "connected"
      ? (unixSecondsToIso(matched.connected_at) ?? row.last_connected_at)
      : row.last_connected_at;

    if (nextUpstreamSessionId !== row.upstream_session_id) updates.upstream_session_id = nextUpstreamSessionId;
    if (nextUpstreamToken !== row.upstream_token) updates.upstream_token = nextUpstreamToken;
    if (nextStatus !== row.status) updates.status = nextStatus;
    if (nextPhoneNumber !== row.phone_number) updates.phone_number = nextPhoneNumber;
    if (nextLastConnectedAt !== row.last_connected_at) updates.last_connected_at = nextLastConnectedAt;

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from("sessions").update(updates).eq("id", row.id);
    }

    return { ...row, ...updates };
  }));
}

// ============= SESSIONS =============

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => ({ name: sessionNameSchema.parse(input.name) }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Build webhook URL from request origin
    const origin = process.env.PUBLIC_APP_URL ?? "";
    // Step 1: insert pending row to get our internal ID
    const { data: row, error: insErr } = await supabaseAdmin
      .from("sessions")
      .insert({ user_id: userId, name: data.name, status: "pending" })
      .select()
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Failed to create session");

    const webhookUrl = origin ? `${origin}/v1/webhook/${row.id}` : undefined;

    // Step 2: call upstream
    const up = await upstreamFetch<{ token: string; session_id: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        user_id: row.id,
        name: data.name,
        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
      }),
    });

    if (!up.ok || !up.data?.token || !up.data?.session_id) {
      await supabaseAdmin.from("sessions").delete().eq("id", row.id);
      throw new Error(up.error ?? "Upstream rejected session creation");
    }

    const { data: updated } = await supabaseAdmin
      .from("sessions")
      .update({
        upstream_session_id: up.data.session_id,
        upstream_token: up.data.token,
        status: "awaiting_qr",
      })
      .eq("id", row.id)
      .select("id, name, phone_number, status, last_connected_at, created_at")
      .single();

    return { session: updated };
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select("id, name, phone_number, status, last_connected_at, created_at, updated_at, upstream_session_id, upstream_token")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const synced = await syncSessionRows((data ?? []) as SessionRow[]);
    return { sessions: synced.map(toClientSession) };
  });

export const getSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("id, name, phone_number, status, last_connected_at, created_at, updated_at, upstream_session_id, upstream_token")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Session not found");
    const [synced] = await syncSessionRows([row as SessionRow]);
    return { session: toClientSession(synced) };
  });

async function loadOwnedSession(userId: string, sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id, name, phone_number, status, last_connected_at, created_at, updated_at, upstream_session_id, upstream_token")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Session not found");
  const [synced] = await syncSessionRows([data as SessionRow]);
  return synced;
}

export const getSessionQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const sess = await loadOwnedSession(context.userId, data.id);
    if (!sess.upstream_session_id) return { qr: null, status: sess.status, ok: true };
    const up = await upstreamFetch<{ qr?: string; status?: string }>(
      `/api/sessions/${sess.upstream_session_id}/qr`,
    );
    if (!up.ok && up.status === 404) {
      await supabaseAdmin.from("sessions").update({ status: "disconnected" }).eq("id", data.id);
      return { qr: null, status: "disconnected", ok: false };
    }
    return {
      qr: up.data?.qr ?? null,
      status: normalizeSessionStatus(up.data?.status, Boolean(up.data?.qr)),
      ok: up.ok,
    };
  });

export const getSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const sess = await loadOwnedSession(context.userId, data.id);
    if (!sess.upstream_session_id) return { status: "pending", phone_number: null };
    const up = await upstreamFetch<{ status?: string; phone_number?: string }>(
      `/api/sessions/${sess.upstream_session_id}/status`,
    );
    if (!up.ok && up.status === 404) {
      await supabaseAdmin.from("sessions").update({ status: "disconnected" }).eq("id", data.id);
      return { status: "disconnected", phone_number: sess.phone_number ?? null };
    }
    const normalizedStatus = up.ok
      ? normalizeSessionStatus(up.data?.status)
      : sess.status;
    if (up.ok && up.data?.status) {
      await supabaseAdmin
        .from("sessions")
        .update({
          status: normalizedStatus,
          phone_number: up.data.phone_number ?? undefined,
          last_connected_at: normalizedStatus === "connected" ? new Date().toISOString() : undefined,
        })
        .eq("id", data.id);
    }
    return { status: normalizedStatus, phone_number: up.data?.phone_number ?? sess.phone_number ?? null };
  });

export const requestPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; phone: string }) => ({
    id: idSchema.parse(input.id),
    phone: phoneSchema.parse(input.phone),
  }))
  .handler(async ({ data, context }) => {
    const sess = await loadOwnedSession(context.userId, data.id);
    if (!sess.upstream_session_id) throw new Error("Session not initialised");
    const up = await upstreamFetch<{ pairing_code?: string }>(
      `/api/sessions/${sess.upstream_session_id}/pair`,
      { method: "POST", body: JSON.stringify({ phone_number: data.phone }) },
    );
    if (!up.ok) throw new Error(up.error ?? "Pairing failed");
    return { pairing_code: up.data?.pairing_code ?? null };
  });

export const reconnectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const sess = await loadOwnedSession(context.userId, data.id);
    if (!sess.upstream_session_id) throw new Error("Session not initialised");
    const up = await upstreamFetch(`/api/sessions/${sess.upstream_session_id}/reconnect`, { method: "POST" });
    return { ok: up.ok };
  });

export const logoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const sess = await loadOwnedSession(context.userId, data.id);
    if (sess.upstream_session_id) {
      await upstreamFetch(`/api/sessions/${sess.upstream_session_id}/logout`, { method: "POST" });
    }
    await supabaseAdmin.from("sessions").update({ status: "logged_out" }).eq("id", data.id);
    return { ok: true };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const sess = await loadOwnedSession(context.userId, data.id);
    if (sess.upstream_session_id) {
      await upstreamFetch(`/api/sessions/${sess.upstream_session_id}`, { method: "DELETE" });
    }
    await supabaseAdmin.from("sessions").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

// ============= API KEYS =============

export const listApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => ({ sessionId: idSchema.parse(input.sessionId) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, label, key_prefix, last_used_at, revoked_at, created_at")
      .eq("user_id", context.userId)
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { keys: rows ?? [] };
  });

export const createApiKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; label: string }) => ({
    sessionId: idSchema.parse(input.sessionId),
    label: apiKeyLabelSchema.parse(input.label),
  }))
  .handler(async ({ data, context }) => {
    // Ensure session belongs to user
    await loadOwnedSession(context.userId, data.sessionId);
    const { plaintext, prefix, hash } = generateApiKey();
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        user_id: context.userId,
        session_id: data.sessionId,
        label: data.label,
        key_prefix: prefix,
        key_hash: hash,
      })
      .select("id, label, key_prefix, created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to create key");
    return { key: row, plaintext };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= TEMPLATES =============

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; name: string; body: string }) => ({
    id: input.id ? idSchema.parse(input.id) : undefined,
    name: templateNameSchema.parse(input.name),
    body: templateBodySchema.parse(input.body),
  }))
  .handler(async ({ data, context }) => {
    const variables = Array.from(new Set([...data.body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1])));
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("templates")
        .update({ name: data.name, body: data.body, variables })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("templates")
        .insert({ user_id: context.userId, name: data.name, body: data.body, variables });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: idSchema.parse(input.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("templates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= MESSAGE LOGS =============

export const listMessageLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; sessionId?: string }) => ({
    limit: Math.min(Math.max(input.limit ?? 50, 1), 200),
    sessionId: input.sessionId ? idSchema.parse(input.sessionId) : undefined,
  }))
  .handler(async ({ data, context }) => {
    let q = supabaseAdmin
      .from("message_logs")
      .select("id, session_id, type, recipient, status_code, duration_ms, error, created_at, request_body, response_body")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.sessionId) q = q.eq("session_id", data.sessionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });

export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: total }, { count: success }, { count: sessions }] = await Promise.all([
      supabaseAdmin
        .from("message_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", since),
      supabaseAdmin
        .from("message_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", since)
        .gte("status_code", 200)
        .lt("status_code", 300),
      supabaseAdmin
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", context.userId),
    ]);
    return {
      messages_24h: total ?? 0,
      success_24h: success ?? 0,
      sessions: sessions ?? 0,
    };
  });

// ============= PLAYGROUND =============
// Lets the user fire any of our /v1 endpoints from the dashboard, authenticated.
const playgroundEndpoint = z.enum(["otp", "send", "bulk", "status"]);

export const playgroundCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; endpoint: string; body: unknown }) => ({
    sessionId: idSchema.parse(input.sessionId),
    endpoint: playgroundEndpoint.parse(input.endpoint),
    body: input.body,
  }))
  .handler(async ({ data, context }) => {
    const sess = await loadOwnedSession(context.userId, data.sessionId);
    if (!sess.upstream_session_id || !sess.upstream_token) throw new Error("Session not connected");

    const start = Date.now();
    let upstreamPath = "";
    let payload: Record<string, unknown> = {};
    let method: "GET" | "POST" = "POST";

    if (data.endpoint === "otp") {
      upstreamPath = "/api/messages/otp";
      payload = { ...(data.body as Record<string, unknown>), token: sess.upstream_token };
    } else if (data.endpoint === "send") {
      upstreamPath = "/api/messages/send";
      payload = { ...(data.body as Record<string, unknown>), token: sess.upstream_token };
    } else if (data.endpoint === "bulk") {
      upstreamPath = "/api/messages/bulk";
      payload = { ...(data.body as Record<string, unknown>), token: sess.upstream_token };
    } else if (data.endpoint === "status") {
      upstreamPath = `/api/sessions/${sess.upstream_session_id}/status`;
      method = "GET";
    }

    const up = await upstreamFetch(upstreamPath, {
      method,
      ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
    });

    // Log it (without exposing token)
    const safeBody = { ...(data.body as Record<string, unknown>) };
    await supabaseAdmin.from("message_logs").insert([{
      user_id: context.userId,
      session_id: data.sessionId,
      direction: "outbound",
      type: `playground.${data.endpoint}`,
      recipient: typeof safeBody?.to === "string" ? (safeBody.to as string) : null,
      request_body: safeBody as never,
      response_body: (up.data ?? null) as never,
      status_code: up.status,
      duration_ms: Date.now() - start,
      error: up.error,
    }]);

    return {
      status: up.status,
      ok: up.ok,
      data_json: JSON.stringify(up.data ?? null),
      error: up.error,
      durationMs: up.durationMs,
    };
  });
