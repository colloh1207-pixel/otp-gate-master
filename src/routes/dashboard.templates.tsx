import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { listTemplates, upsertTemplate, deleteTemplate } from "@/server/dashboard.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/templates")({ component: TemplatesPage });

type Template = { id: string; name: string; body: string; variables: string[] };

function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");

  async function load() {
    const r = await listTemplates();
    setTemplates(r.templates as never);
  }
  useEffect(() => { void load(); }, []);

  function openNew() { setEditing(null); setName(""); setBody(""); setOpen(true); }
  function openEdit(t: Template) { setEditing(t); setName(t.name); setBody(t.body); setOpen(true); }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsertTemplate({ data: { id: editing?.id, name: name.trim(), body: body.trim() } });
      setOpen(false); await load();
      toast.success("Saved");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="font-mono text-xs text-primary">TEMPLATES</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Message templates</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{"{{variable}}"}</code> for dynamic placeholders.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit template" : "Create template"}</DialogTitle></DialogHeader>
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)}
                  rows={6} required maxLength={4096}
                  placeholder="Hi {{name}}, your code is {{code}}." />
              </div>
              <Button type="submit" className="w-full">{editing ? "Save changes" : "Create"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No templates yet</h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <button onClick={() => openEdit(t)} className="text-left flex-1 min-w-0">
                  <div className="font-semibold">{t.name}</div>
                  <div className="mt-2 text-sm text-muted-foreground line-clamp-3">{t.body}</div>
                  {t.variables?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {t.variables.map((v) => (
                        <span key={v} className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Delete template?")) return;
                  await deleteTemplate({ data: { id: t.id } }); await load();
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
