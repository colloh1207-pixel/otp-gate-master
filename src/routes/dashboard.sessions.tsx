import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { listSessions, createSession } from "@/server/dashboard.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui-bits";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/sessions")({ component: SessionsList });

type Session = { id: string; name: string; status: string; phone_number: string | null; created_at: string };

function SessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await listSessions();
    setSessions(r.sessions as never);
  }
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createSession({ data: { name: name.trim() } });
      setName(""); setOpen(false); await load();
      toast.success("Session created — connect your number next");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="font-mono text-xs text-primary">SESSIONS</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Connected numbers</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New session</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a new session</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Label</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production OTP" maxLength={80} required />
                <p className="text-xs text-muted-foreground">A friendly name. You can connect the actual phone number on the next screen.</p>
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Creating..." : "Create session"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No sessions yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a session to connect your WhatsApp number.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => (
            <Link key={s.id} to="/dashboard/sessions/$id" params={{ id: s.id }}
              className="rounded-xl border bg-card p-5 hover:border-primary/40 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">
                    {s.phone_number ?? "not connected"}
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
