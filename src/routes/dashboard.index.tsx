import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Smartphone, ArrowRight } from "lucide-react";
import { getStats, listSessions } from "@/server/dashboard.functions";
import { StatusBadge } from "@/components/ui-bits";

export const Route = createFileRoute("/dashboard/")({ component: OverviewPage });

function OverviewPage() {
  const [stats, setStats] = useState<{ messages_24h: number; success_24h: number; sessions: number } | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; name: string; status: string; phone_number: string | null }>>([]);

  useEffect(() => {
    void getStats().then(setStats);
    void listSessions().then((r) => setSessions(r.sessions as never));
  }, []);

  const successRate = stats && stats.messages_24h > 0
    ? Math.round((stats.success_24h / stats.messages_24h) * 100)
    : null;

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-xs text-primary">DASHBOARD</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Overview</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard icon={Smartphone} label="Connected numbers" value={stats?.sessions ?? "—"} />
        <StatCard icon={Activity} label="Messages (24h)" value={stats?.messages_24h ?? "—"} />
        <StatCard icon={CheckCircle2} label="Success rate" value={successRate !== null ? `${successRate}%` : "—"} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-mono text-muted-foreground">YOUR SESSIONS</h2>
          <Link to="/dashboard/sessions" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {sessions.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No WhatsApp numbers connected yet.</p>
            <Link to="/dashboard/sessions"
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Connect your first number
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {sessions.slice(0, 5).map((s) => (
              <Link key={s.id} to="/dashboard/sessions/$id" params={{ id: s.id }}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {s.phone_number ?? "no number yet"}
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string | number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </motion.div>
  );
}
