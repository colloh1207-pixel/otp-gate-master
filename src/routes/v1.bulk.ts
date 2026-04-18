import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, errorResponse, jsonResponse } from "@/lib/cors";
import { authenticateApiKey, logCall } from "@/server/v1-helpers.server";
import { upstreamFetch } from "@/lib/upstream.server";
import { bulkInput } from "@/lib/validators";

export const Route = createFileRoute("/v1/bulk")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return errorResponse(auth.error, auth.status);

        let raw: unknown;
        try { raw = await request.json(); } catch { return errorResponse("Invalid JSON body", 400); }
        const parsed = bulkInput.safeParse(raw);
        if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 400);
        if (!auth.upstreamToken) return errorResponse("Session not connected", 409);

        const start = Date.now();
        const up = await upstreamFetch("/api/messages/bulk", {
          method: "POST",
          body: JSON.stringify({ ...parsed.data, token: auth.upstreamToken }),
          timeoutMs: 60_000,
        });
        await logCall({
          userId: auth.userId,
          sessionId: auth.sessionId,
          apiKeyId: auth.apiKeyId,
          type: "bulk",
          recipient: `${parsed.data.numbers.length} recipients`,
          request: { ...parsed.data, numbers: parsed.data.numbers.length },
          response: up.data,
          status: up.status,
          durationMs: Date.now() - start,
          error: up.error,
        });
        return jsonResponse(
          { ok: up.ok, status: up.status, error: up.error, data: up.data },
          up.ok ? 200 : up.status || 502,
        );
      },
    },
  },
});
