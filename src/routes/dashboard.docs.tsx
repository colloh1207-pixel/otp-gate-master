import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Book, Terminal, Shield } from "lucide-react";
import { CodeBlock } from "@/components/ui-bits";

export const Route = createFileRoute("/dashboard/docs")({ component: DocsPage });

function DocsPage() {
  const [base, setBase] = useState("");
  useEffect(() => { setBase(window.location.origin); }, []);

  return (
    <div className="max-w-3xl">
      <p className="font-mono text-xs text-primary">API REFERENCE</p>
      <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Integrate WAGate</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Call these endpoints from <strong>your backend</strong> (never the browser — your API key is a secret).
        All responses are JSON. CORS is open for testing but production traffic should be server-to-server.
      </p>

      <Section icon={Shield} title="Authentication">
        <p className="text-sm text-muted-foreground mb-3">
          Send your API key as a Bearer token. Each key is tied to one connected WhatsApp number.
        </p>
        <CodeBlock code={`Authorization: Bearer wak_live_xxxxxxxxxxxxxxxxxxxx`} />
      </Section>

      <Section icon={Terminal} title="Base URL">
        <CodeBlock code={base ? `${base}/v1` : "/v1"} />
      </Section>

      <Endpoint method="POST" path="/v1/otp" description="Send a one-time password to a WhatsApp number.">
        <CodeBlock code={`curl -X POST ${base}/v1/otp \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "254712345678",
    "otp": "1234",
    "app_name": "MyApp"
  }'`} />
      </Endpoint>

      <Endpoint method="POST" path="/v1/send" description="Send a free-text message.">
        <CodeBlock code={`curl -X POST ${base}/v1/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "254712345678",
    "message": "Hello from WAGate"
  }'`} />
      </Endpoint>

      <Endpoint method="POST" path="/v1/bulk" description="Send the same message to multiple numbers (max 100).">
        <CodeBlock code={`curl -X POST ${base}/v1/bulk \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "numbers": ["254712345678","254700000000"],
    "message": "Sale starts now",
    "delay_ms": 1000
  }'`} />
      </Endpoint>

      <Endpoint method="GET" path="/v1/status" description="Check the connection status of the session tied to your key.">
        <CodeBlock code={`curl ${base}/v1/status \\
  -H "Authorization: Bearer YOUR_API_KEY"`} />
      </Endpoint>

      <Section icon={Book} title="Node.js example">
        <CodeBlock code={`const res = await fetch("${base}/v1/otp", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.WAGATE_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ to, otp, app_name: "MyApp" }),
});
const data = await res.json();`} />
      </Section>

      <Section icon={Shield} title="Phone format">
        <p className="text-sm text-muted-foreground">
          Country code + number, digits only, no <code className="font-mono bg-muted px-1 rounded">+</code> or spaces.
          Example: <code className="font-mono bg-muted px-1 rounded">254712345678</code>.
        </p>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Book; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Endpoint({ method, path, description, children }: {
  method: string; path: string; description: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-10 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">{method}</span>
        <code className="font-mono text-sm">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {children}
    </section>
  );
}
