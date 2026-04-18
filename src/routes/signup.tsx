import { useEffect, useState } from "react";
import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { emailSchema, passwordSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const schema = z.object({ email: emailSchema, password: passwordSchema });

function SignupPage() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && session) nav({ to: "/dashboard" });
  }, [session, loading, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 gradient-hero">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border bg-card p-8 elegant"
      >
        <Link to="/" className="font-mono text-xs text-muted-foreground hover:text-foreground">← back</Link>

        {sent ? (
          <div className="mt-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl">✓</div>
            <h1 className="mt-4 text-2xl font-bold">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a verification link to <span className="font-mono text-foreground">{email}</span>.
              Click it to activate your account.
            </p>
            <Link to="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Start sending WhatsApp OTPs in minutes</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required autoComplete="new-password" minLength={8}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">At least 8 characters. Avoid common passwords.</p>
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Creating..." : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
