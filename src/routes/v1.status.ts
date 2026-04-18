import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, errorResponse, jsonResponse } from "@/lib/cors";
import { authenticateApiKey } from "@/server/v1-helpers.server";
import { upstreamFetch } from "@/lib/upstream.server";

export const Route = createFileRoute("/v1/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if ("error" in auth) return errorResponse(auth.error, auth.status);
        if (!auth.upstreamSessionId) return jsonResponse({ status: "pending" });
        const up = await upstreamFetch(`/api/sessions/${auth.upstreamSessionId}/status`);
        return jsonResponse(
          { ok: up.ok, status: up.status, error: up.error, data: up.data },
          up.ok ? 200 : up.status || 502,
        );
      },
    },
  },
});
