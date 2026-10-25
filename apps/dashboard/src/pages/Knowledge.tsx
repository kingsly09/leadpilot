import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, FileText } from "lucide-react";
import { api, type KbDocument, type KbHit } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDemoConfig } from "../lib/demo";
import { timeAgo } from "../lib/format";
import { Empty, ErrorBox, Loading, PageHeader } from "../components/ui";

function AddDocument({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const add = useMutation({
    mutationFn: () => api("/kb/documents", { method: "POST", json: { title, content } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb"] });
      onDone();
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }
  return (
    <form className="card mb-4 space-y-3" onSubmit={submit}>
      <h2 className="text-sm font-semibold">Add business information</h2>
      <input className="input" placeholder="Title, e.g. Refund policy" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea
        className="input min-h-[160px]"
        placeholder="Paste text: services, prices, FAQs, policies… The AI will answer customers from this."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        minLength={20}
      />
      {add.error && <ErrorBox error={add.error} />}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={add.isPending}>
          {add.isPending ? "Processing…" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Knowledge() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const demoMode = useDemoConfig().data?.demoMode === true;
  const canEdit = can("ADMIN") && !demoMode; // the public demo keeps its knowledge base intact
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const docs = useQuery({ queryKey: ["kb"], queryFn: () => api<KbDocument[]>("/kb/documents") });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/kb/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb"] }),
  });
  const search = useMutation({ mutationFn: (q: string) => api<KbHit[]>("/kb/search", { method: "POST", json: { query: q } }) });

  return (
    <>
      <PageHeader
        title="Knowledge base"
        subtitle={
          demoMode
            ? "What the AI knows about the business. Read-only in the demo, but you can test questions."
            : "What the AI knows about the business. It answers only from this."
        }
        actions={
          canEdit && !adding ? (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden /> Add information
            </button>
          ) : undefined
        }
      />
      {adding && <AddDocument onDone={() => setAdding(false)} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Documents</h2>
          {docs.isLoading && <Loading />}
          {docs.error && <ErrorBox error={docs.error} />}
          {docs.data?.length === 0 && <Empty title="No documents yet" />}
          <div className="space-y-2">
            {docs.data?.map((d) => (
              <div key={d.id} className="card flex items-center gap-3">
                <FileText size={18} className="muted shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.title}</div>
                  <div className="muted text-xs">
                    {d._count.chunks} passages · added {timeAgo(d.createdAt)}
                  </div>
                </div>
                {canEdit && (
                  <button
                    className="btn btn-ghost px-2"
                    aria-label={`Delete ${d.title}`}
                    disabled={remove.isPending}
                    onClick={() => confirm(`Delete "${d.title}"? The AI will stop using it.`) && remove.mutate(d.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold">Test a question</h2>
          <form
            className="card space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) search.mutate(query.trim());
            }}
          >
            <p className="secondary text-sm">See which passages the AI would read before answering a customer.</p>
            <div className="flex gap-2">
              <input className="input" placeholder="e.g. Do you offer support after launch?" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="btn btn-primary" disabled={search.isPending}>
                <Search size={15} aria-hidden /> Search
              </button>
            </div>
            {search.error && <ErrorBox error={search.error} />}
            {search.data?.map((h, i) => (
              <div key={h.id} className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)" }}>
                <div className="muted mb-1 text-xs">
                  #{i + 1} · match {Math.round(Number(h.similarity) * 100)}%{Number(h.similarity) < 0.3 && " (too weak, the AI ignores it)"}
                </div>
                <p className="line-clamp-5 whitespace-pre-wrap">{h.content}</p>
              </div>
            ))}
          </form>
        </div>
      </div>
    </>
  );
}
