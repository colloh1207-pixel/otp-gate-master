import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, LogOut as LogOutIcon, Trash2, Plus, KeyRound, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  getSession, getSessionQr, getSessionStatus, requestPairing,
  reconnectSession, logoutSession, deleteSession,
  listApiKeys, createApiKeyFn, revokeApiKey,
} from "@/server/dashboard.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, CopyButton } from "@/components/ui-bits";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/sessions/$id")({ component: SessionDetail });

type Sess = { id: string; name: string; phone_number: string | null; status: string };
type ApiKey = { id: string; label: string; key_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string };

function SessionDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [sess, setSess] = useState<Sess | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<{ label: string; plaintext: string } | null>(null);
  const [keyLabel, setKeyLabel] = useState("");
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);

  const refreshAll = useCallback(async () => {
    const [s, k] = await Promise.all([
      getSession({ data: { id } }),
      listApiKeys({ data: { sessionId: id } }),
    ]);
    setSess(s.session as never);
    setKeys(k.keys as never);
  }, [id]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  // Poll status + QR while not connected
  useEffect(() => {
    if (!sess || sess.status === "connected") return;
    const t = setInterval(async () => {
      try {
        const [st, q] = await Promise.all([
          getSessionStatus({ data: { id } }),
          getSessionQr({ data: { id } }),
        ]);
        if (q.qr) setQr(q.qr);
        setSess((p) => p ? { ...p, status: st.status, phone_number: st.phone_number ?? p.phone_number } : p);
        if (st.status === "connected") {
          toast.success("WhatsApp connected!");
          setQr(null);
        }
      } catch { /* ignore */ }
    }, 3500);
    return () => clearInterval(t);
  }, [sess, id]);

  async function onPair(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await requestPairing({ data: { id, phone: phone.trim() } });
      setPairing(r.pairing_code ?? null);
      toast.success("Pairing code generated");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Pairing failed"); }
  }

  async function onCreateKey(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await createApiKeyFn({ data: { sessionId: id, label: keyLabel.trim() } });
      setNewKey({ label: keyLabel.trim(), plaintext: r.plaintext });
      setKeyLabel(""); setKeyDialogOpen(false);
      await refreshAll();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  if (!sess) return <div className="font-mono text-xs text-muted-foreground">loading…</div>;

  return (
    <div>
      <Link to="/dashboard/sessions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All sessions
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{sess.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={sess.status} />
            {sess.phone_number && <span className="font-mono text-sm text-muted-foreground">{sess.phone_number}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={async () => { await reconnectSession({ data: { id } }); toast.info("Reconnecting"); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Reconnect
          </Button>
          <Button variant="outline" size="sm" onClick={async () => { await logoutSession({ data: { id } }); await refreshAll(); }}>
            <LogOutIcon className="h-4 w-4 mr-1" /> Logout
          </Button>
          <Button variant="destructive" size="sm" onClick={async () => {
            if (!confirm("Delete this session? This cannot be undone.")) return;
            await deleteSession({ data: { id } }); nav({ to: "/dashboard/sessions" });
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sess.status !== "connected" && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Scan QR code</h2>
            </div>
            <div className="aspect-square rounded-lg bg-background border flex items-center justify-center overflow-hidden">
              {qr ? (
                <img src={qr} alt="WhatsApp QR" className="h-full w-full object-contain p-4" />
              ) : (
                <div className="text-center text-xs text-muted-foreground font-mono">
                  generating QR…<br />
                  <span className="opacity-50">open WhatsApp → Linked Devices → Link a Device</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold mb-1">Or pair with phone number</h2>
            <p className="text-xs text-muted-foreground mb-4">Get an 8-character code to enter in WhatsApp.</p>
            <form onSubmit={onPair} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (with country code, no +)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="254712345678" inputMode="numeric" pattern="[0-9]*" />
              </div>
              <Button type="submit" variant="secondary" className="w-full">Get pairing code</Button>
            </form>
            {pairing && (
              <div className="mt-4 rounded-lg border-2 border-primary/40 bg-primary/5 p-4 text-center">
                <div className="text-xs font-mono text-muted-foreground">YOUR PAIRING CODE</div>
                <div className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-primary">{pairing}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Keys */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">API Keys</h2>
            <p className="text-sm text-muted-foreground">Use these to call the WAGate API from your backend.</p>
          </div>
          <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create API key</DialogTitle></DialogHeader>
              <form onSubmit={onCreateKey} className="space-y-4">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder="e.g. Production backend" required maxLength={80} />
                </div>
                <Button type="submit" className="w-full">Generate</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {newKey && (
          <div className="mb-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Save this key — it won't be shown again</h3>
            </div>
            <div className="font-mono text-sm break-all bg-background border rounded p-3">{newKey.plaintext}</div>
            <div className="mt-3 flex gap-2">
              <CopyButton text={newKey.plaintext} label="Copy key" />
              <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Dismiss</Button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No API keys yet
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-4 gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{k.label}</div>
                  <div className="font-mono text-xs text-muted-foreground truncate">
                    {k.key_prefix}…{k.revoked_at ? " · revoked" : ""}
                  </div>
                </div>
                {!k.revoked_at && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm("Revoke this API key?")) return;
                    await revokeApiKey({ data: { id: k.id } }); await refreshAll();
                  }}>Revoke</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
