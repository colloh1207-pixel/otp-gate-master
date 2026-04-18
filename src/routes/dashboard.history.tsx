import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listMessageLogs } from "@/server/dashboard.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/dashboard/history")({ component: HistoryPage });

type Log = {
  id: string;
  type: string;
  recipient: string | null;
  status_code: number | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
  request_body: unknown;
  response_body: unknown;
};

function HistoryPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => { void listMessageLogs({ data: { limit: 100 } }).then((r) => setLogs(r.logs as never)); }, []);

  return (
    <div>
      <p className="font-mono text-xs text-primary">HISTORY</p>
      <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Message log</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last 100 calls to your API. Click a row for details.</p>

      <div className="mt-8 rounded-xl border bg-card overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No messages sent yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs font-mono text-muted-foreground uppercase">
              <tr>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3 hidden sm:table-cell">To</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3 hidden md:table-cell">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((l) => (
                <Sheet key={l.id}>
                  <SheetTrigger asChild>
                    <tr className="cursor-pointer hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-xs">{l.type}</td>
                      <td className="p-3 font-mono text-xs hidden sm:table-cell">{l.recipient ?? "—"}</td>
                      <td className="p-3">
                        <span className={`font-mono text-xs ${l.status_code && l.status_code >= 200 && l.status_code < 300 ? "text-success" : "text-destructive"}`}>
                          {l.status_code ?? "ERR"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                        {l.duration_ms ? `${l.duration_ms}ms` : "—"}
                      </td>
                    </tr>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader><SheetTitle className="font-mono text-sm">{l.type}</SheetTitle></SheetHeader>
                    <div className="mt-6 space-y-5">
                      <DetailRow label="When" value={new Date(l.created_at).toLocaleString()} />
                      <DetailRow label="Recipient" value={l.recipient ?? "—"} />
                      <DetailRow label="Status" value={String(l.status_code ?? "ERR")} />
                      <DetailRow label="Duration" value={l.duration_ms ? `${l.duration_ms}ms` : "—"} />
                      {l.error && <DetailRow label="Error" value={l.error} />}
                      <div>
                        <div className="text-xs font-mono text-muted-foreground mb-1">REQUEST</div>
                        <pre className="scrollbar-thin overflow-auto rounded-lg bg-background border p-3 text-xs font-mono">
                          {JSON.stringify(l.request_body, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs font-mono text-muted-foreground mb-1">RESPONSE</div>
                        <pre className="scrollbar-thin overflow-auto rounded-lg bg-background border p-3 text-xs font-mono">
                          {JSON.stringify(l.response_body, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="font-mono text-xs text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-xs text-right break-all">{value}</span>
    </div>
  );
}
