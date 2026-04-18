import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Globe, Code2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui-bits";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { session } = useAuth();
  const [base, setBase] = useState("");
  useEffect(() => { setBase(window.location.origin); }, []);

  const snippet = `curl -X POST ${base || "https://wagate.app"}/v1/otp \\
  -H "Authorization: Bearer wak_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"254712345678","otp":"4521","app_name":"MyApp"}'`;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md gradient-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">WAGate</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#code" className="hover:text-foreground transition">API</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild size="sm"><Link to="/dashboard">Dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
                <Button asChild size="sm"><Link to="/signup">Get started</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-32 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 font-mono text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Live · v1 API
            </span>
            <h1 className="mt-6 text-4xl md:text-7xl font-bold tracking-tight text-gradient leading-[1.05]">
              WhatsApp OTPs<br />in 60 seconds.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base md:text-lg text-muted-foreground">
              Connect your WhatsApp number, grab an API key, send OTPs and messages from your backend.
              No Twilio. No business verification. Just code.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="gap-2 glow">
                <Link to={session ? "/dashboard" : "/signup"}>
                  {session ? "Open dashboard" : "Start free"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#code">View API docs</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Code preview */}
      <section id="code" className="mx-auto max-w-3xl px-4 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-center font-mono text-xs text-muted-foreground mb-3">SEND AN OTP</p>
          <CodeBlock code={snippet} className="elegant" />
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 border-t">
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight">Built for developers.</h2>
        <p className="mt-3 text-center text-muted-foreground">Everything you need, nothing you don't.</p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          <Feature icon={Zap} title="Instant OTPs" desc="Send 4-8 digit codes in under a second. Phone format validated server-side." />
          <Feature icon={Shield} title="Server-side keys" desc="API keys hashed at rest. Never expose your key in the browser." />
          <Feature icon={Globe} title="Bring your number" desc="Scan a QR code or pair by phone — your WhatsApp account, your control." />
          <Feature icon={Code2} title="Drop-in REST API" desc="Single Bearer token. No SDK required. Works from any backend." />
          <Feature icon={CheckCircle2} title="Full delivery logs" desc="Every call logged with status, duration, and full request/response." />
          <Feature icon={Zap} title="Installable PWA" desc="Manage sessions from your phone. Works offline once installed." />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-4xl px-4 py-20 border-t">
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight">Three steps to live.</h2>
        <div className="mt-12 space-y-6">
          <Step n="01" title="Create a session" desc="Give it a name. We provision a WhatsApp gateway for you." />
          <Step n="02" title="Connect your number" desc="Scan the QR or use the 8-character pairing code. Stays connected automatically." />
          <Step n="03" title="Generate an API key & call /v1/otp" desc="From your backend. Logs and templates included." />
        </div>
        <div className="mt-12 text-center">
          <Button asChild size="lg" className="gap-2">
            <Link to={session ? "/dashboard" : "/signup"}>Get started <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground font-mono">
        © {new Date().getFullYear()} WAGate · built for developers
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Zap; title: string; desc: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      className="rounded-xl border bg-card p-6 hover:border-primary/40 transition">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </motion.div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
      className="flex gap-5 rounded-xl border bg-card p-5">
      <div className="font-mono text-2xl font-bold text-primary">{n}</div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
    </motion.div>
  );
}
