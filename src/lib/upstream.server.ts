// Server-only client for the upstream WhatsApp gateway.
// The base URL is stored as a secret and NEVER exposed to the browser.

const getBase = () => {
  const url = process.env.UPSTREAM_BASE_URL;
  if (!url) throw new Error("UPSTREAM_BASE_URL is not configured");
  return url.replace(/\/$/, "");
};

export type UpstreamResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  durationMs: number;
};

export async function upstreamFetch<T = unknown>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<UpstreamResult<T>> {
  const base = getBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 25_000);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text as unknown;
    }
    return {
      ok: res.ok,
      status: res.status,
      data: data as T,
      error: res.ok ? null : (typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `Upstream error ${res.status}`),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "Network error",
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}
