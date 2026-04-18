// Webhook receiver — upstream gateway POSTs events here. We verify session ownership by id.
import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, jsonResponse } from "@/lib/cors";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/v1/webhook/$sessionId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request, params }) => {
        const sessionId = String(params.sessionId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
          return jsonResponse({ ok: false }, 400);
        }

        const { data: sess } = await supabaseAdmin
          .from("sessions")
          .select("id, user_id")
          .eq("id", sessionId)
          .maybeSingle();
        if (!sess) return jsonResponse({ ok: false }, 404);

        let body: Record<string, unknown> = {};
        try { body = (await request.json()) as Record<string, unknown>; } catch { /* keep empty */ }

        const eventType = String(body.event ?? body.type ?? "unknown");
        const payload = (body.data ?? body.payload ?? body) as Record<string, unknown>;

        await supabaseAdmin.from("webhook_events").insert({
          user_id: sess.user_id,
          session_id: sess.id,
          event_type: eventType,
          payload: payload as never,
        });

        // Update derived session state
        if (eventType === "connected") {
          await supabaseAdmin
            .from("sessions")
            .update({
              status: "connected",
              phone_number: typeof payload?.phone_number === "string" ? (payload.phone_number as string) : undefined,
              last_connected_at: new Date().toISOString(),
            })
            .eq("id", sess.id);
        } else if (eventType === "disconnected" || eventType === "logout") {
          await supabaseAdmin.from("sessions").update({ status: eventType }).eq("id", sess.id);
        }

        return jsonResponse({ ok: true });
      },
    },
  },
});
