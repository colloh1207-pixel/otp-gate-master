import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({ text, className, label = "Copy" }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-2 font-mono text-xs", className)}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <div className={cn("group relative overflow-hidden rounded-lg border bg-background", className)}>
      <pre className="scrollbar-thin overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
      <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "unknown").toLowerCase();
  const map: Record<string, string> = {
    connected: "bg-success/15 text-success border-success/30",
    awaiting_qr: "bg-warning/15 text-warning border-warning/30",
    pending: "bg-muted text-muted-foreground border-border",
    disconnected: "bg-destructive/15 text-destructive border-destructive/30",
    logout: "bg-destructive/15 text-destructive border-destructive/30",
    logged_out: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono",
      map[s] ?? "bg-muted text-muted-foreground border-border")}>
      <span className={cn("h-1.5 w-1.5 rounded-full",
        s === "connected" ? "bg-success animate-pulse" : "bg-current opacity-60")} />
      {s.replace(/_/g, " ")}
    </span>
  );
}
