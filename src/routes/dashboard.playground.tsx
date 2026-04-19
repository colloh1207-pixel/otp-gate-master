import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Play, Terminal } from "lucide-react";
import { toast } from "sonner";
import { listSessions, playgroundCall } from "@/server/dashboard.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/playground")({ component: PlaygroundPage });

const ENDPOINTS = {
  otp:    { method: "POST", path: "/v1/otp",    sample: { to: "254712345678", otp: "1234", app_name: "MyApp" } },
  send:   { method: "POST", path: "/v1/send",   sample: { to: "254712345678", message: "Hello from WAGate!" } },
  bulk:   { method: "POST", path: "/v1/bulk",   sample: { numbers: ["254712345678"], message: "Hi", delay_ms: 1000 } },
  status: { method: "GET",  path: "/v1/status", sample: {} },
} as const;
type EpKey = keyof typeof ENDPOINTS;

function PlaygroundPage() {
  const [sessions, setSessions] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [endpoint, setEndpoint] = useState<EpKey>("otp");
  const [body, setBody] = useState<string>(JSON.stringify(ENDPOINTS.otp.sample, null, 2));
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<{ status: number; ok: boolean; data: string; durationMs: number; error: string | null } | null>(null);

  useEffect(() => {
    void listSessions().then((r) => {
      const list = r.sessions as Array<{ id: string; name: string; status: string }>;
      setSessions(list);
      if (list[0]) setSessionId(list[0].id);
    });
  }, []);

  useEffect(() => { setBody(JSON.stringify(ENDPOINTS[endpoint].sample, null, 2)); }, [endpoint]);

  const ep = ENDPOINTS[endpoint];

  async function run() {
    if (!sessionId) { toast.error("Pick a session first"); return; }
    let parsed: unknown = {};
    if (ep.method === "POST") {
      try { parsed = JSON.parse(body); } catch { toast.error("Body is not valid JSON"); return; }
    }
    setBusy(true); setResp(null);
    try {
      const r = await playgroundCall({ data: { sessionId, endpoint, body: parsed } });
      setResp({
        status: r.status,
        ok: r.ok,
        data: typeof r.data === "string" ? r.data : JSON.stringify(r.data ?? null, null, 2),
        durationMs: r.duration_ms,
        error: r.error,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  const prettyResp = useMemo(() => {
    if (!resp) return "";
    try { return JSON.stringify(JSON.parse(resp.data), null, 2); } catch { return resp.data; }
  }, [resp]);

  return (
    <div>
      <p className="font-mono text-xs text-primary">PLAYGROUND</p>
      <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">API Explorer</h1>
      <p className="mt-2 text-sm text-muted-foreground">Fire requests directly from the dashboard. Calls are logged to your history.</p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Session</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger><SelectValue placeholder="Pick session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} · {s.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Select value={endpoint} onValueChange={(v) => setEndpoint(v as EpKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENDPOINTS) as EpKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{ENDPOINTS[k].method} {ENDPOINTS[k].path}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {ep.method === "POST" && (
            <div className="space-y-2">
              <Label>Request body (JSON)</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs min-h-48" spellCheck={false} />
            </div>
          )}

          <Button onClick={run} disabled={busy || !sessionId} className="w-full gap-2">
            <Play className="h-4 w-4" /> {busy ? "Running…" : `Send ${ep.method} ${ep.path}`}
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Response</h3>
            </div>
            {resp && (
              <div className="font-mono text-xs">
                <span className={resp.ok ? "text-success" : "text-destructive"}>{resp.status || "ERR"}</span>
                <span className="text-muted-foreground ml-2">{resp.durationMs}ms</span>
              </div>
            )}
          </div>
          <pre className="scrollbar-thin overflow-auto rounded-lg bg-background border p-4 text-xs min-h-48 max-h-96 font-mono">
            {resp ? (resp.error ? `// ${resp.error}\n${prettyResp}` : prettyResp) : "// run a request to see the response"}
          </pre>
        </div>
      </div>
    </div>
  );
}
