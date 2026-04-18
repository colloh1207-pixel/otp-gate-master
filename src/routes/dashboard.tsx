import { useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation, createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, Smartphone, FlaskConical, History, FileText, BookOpen, LogOut, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({ component: DashboardLayout });

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/sessions", label: "Sessions", icon: Smartphone },
  { to: "/dashboard/playground", label: "Playground", icon: FlaskConical },
  { to: "/dashboard/history", label: "History", icon: History },
  { to: "/dashboard/templates", label: "Templates", icon: FileText },
  { to: "/dashboard/docs", label: "API Docs", icon: BookOpen },
] as const;

function DashboardLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-mono text-xs text-muted-foreground">loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 border-b">
          <div className="h-7 w-7 rounded-md gradient-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">WAGate</span>
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="px-2 py-2 text-xs text-muted-foreground truncate font-mono">{user?.email}</div>
          <button
            onClick={() => { void signOut().then(() => navigate({ to: "/" })); }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed inset-x-0 top-0 z-30 border-b bg-sidebar/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md gradient-primary flex items-center justify-center">
              <Zap className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">WAGate</span>
          </Link>
          <button onClick={() => { void signOut().then(() => navigate({ to: "/" })); }}
            className="text-xs text-muted-foreground">Sign out</button>
        </div>
        <nav className="scrollbar-thin overflow-x-auto flex gap-1 px-3 pb-2">
          {nav.map((item) => {
            const active = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to}
                className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-xs",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground")}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 md:ml-0 mt-24 md:mt-0 px-4 md:px-8 py-6 md:py-10 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
