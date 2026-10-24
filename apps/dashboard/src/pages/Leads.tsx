import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, MessagesSquare, Mail, Phone } from "lucide-react";
import { api, LEAD_STATUSES, type Lead, type LeadStatus, type User } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CHANNEL_LABEL, STATUS_LABEL, displayName, timeAgo } from "../lib/format";
import { Empty, ErrorBox, Loading, PageHeader, StatusPill, TierBadge } from "../components/ui";

type LeadDetail = Lead & {
  contact: Lead["contact"] & { conversations: Array<{ id: string; channel: string; messages: Array<{ role: string; content: string }> }> };
};

function LeadPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const lead = useQuery({ queryKey: ["lead", id], queryFn: () => api<LeadDetail>(`/leads/${id}`) });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users"), enabled: can("ADMIN", "AGENT") });
  const update = useMutation({
    mutationFn: (data: { status?: LeadStatus; assignedToId?: string | null }) => api(`/leads/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const l = lead.data;
  const editable = can("ADMIN", "AGENT");

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l p-5"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Lead details"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{l ? displayName(l.contact) : "Lead"}</h2>
          <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {lead.isLoading && <Loading />}
        {lead.error && <ErrorBox error={lead.error} />}
        {l && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={l.tier} score={l.score} />
              <StatusPill status={l.status} />
              <span className="muted text-xs">via {CHANNEL_LABEL[l.source] ?? l.source}</span>
            </div>

            <div className="space-y-1">
              {l.contact.email && (
                <a className="flex items-center gap-2 hover:underline" href={`mailto:${l.contact.email}`}>
                  <Mail size={14} aria-hidden /> {l.contact.email}
                </a>
              )}
              {l.contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} aria-hidden /> {l.contact.phone}
                </div>
              )}
            </div>

            <dl className="grid grid-cols-[90px_1fr] gap-y-2">
              <dt className="muted">Need</dt>
              <dd>{l.fields.need ?? "—"}</dd>
              <dt className="muted">Budget</dt>
              <dd>{l.fields.budget ?? "—"}</dd>
              <dt className="muted">Timeline</dt>
              <dd>{l.fields.timeline ?? "—"}</dd>
              <dt className="muted">Intent</dt>
              <dd>{l.fields.intent ?? "—"}</dd>
              <dt className="muted">Created</dt>
              <dd>{timeAgo(l.createdAt)}</dd>
            </dl>

            {editable && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="secondary mb-1 block text-xs font-medium">Status</span>
                  <select
                    className="input"
                    value={l.status}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ status: e.target.value as LeadStatus })}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="secondary mb-1 block text-xs font-medium">Assigned to</span>
                  <select
                    className="input"
                    value={l.assignedToId ?? ""}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ assignedToId: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {users.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {update.error && <ErrorBox error={update.error} />}

            {l.contact.conversations.map((c) => (
              <div key={c.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Conversation · {CHANNEL_LABEL[c.channel] ?? c.channel}</h3>
                  <Link className="btn btn-ghost" to={`/inbox?c=${c.id}`}>
                    <MessagesSquare size={14} aria-hidden /> Open in inbox
                  </Link>
                </div>
                <div className="space-y-1.5 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
                  {c.messages.slice(-6).map((m, i) => (
                    <p key={i} className={m.role === "user" ? "" : "secondary"}>
                      <span className="font-medium">{m.role === "user" ? "Customer" : m.role === "assistant" ? "AI" : "Team"}:</span>{" "}
                      {m.content}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

export function Leads() {
  const [params, setParams] = useSearchParams();
  const tier = params.get("tier") ?? "";
  const status = params.get("status") ?? "";
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const query = new URLSearchParams({ take: "100", ...(tier && { tier }), ...(status && { status }) });
  const leads = useQuery({ queryKey: ["leads", tier, status], queryFn: () => api<Lead[]>(`/leads?${query}`) });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return leads.data ?? [];
    return (leads.data ?? []).filter((l) =>
      [l.contact.name, l.contact.email, l.fields.need].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [leads.data, q]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Leads" subtitle="Everyone who has talked to the assistant, best leads first" />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input className="input pl-9" placeholder="Search name, email or need" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={tier} onChange={(e) => setFilter("tier", e.target.value)} aria-label="Tier">
          <option value="">All tiers</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
        </select>
        <select className="input w-auto" value={status} onChange={(e) => setFilter("status", e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {leads.isLoading && <Loading />}
      {leads.error && <ErrorBox error={leads.error} />}
      {leads.data && rows.length === 0 && <Empty title="No leads match" hint="Try clearing the filters." />}

      {rows.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="muted text-xs uppercase tracking-wide">
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Need</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="table-row cursor-pointer border-b last:border-0"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => setOpenId(l.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{displayName(l.contact)}</div>
                    <div className="muted text-xs">
                      {l.contact.email || "no email yet"} · {CHANNEL_LABEL[l.source] ?? l.source}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={l.tier} score={l.score} />
                  </td>
                  <td className="secondary max-w-[220px] truncate px-4 py-3">{l.fields.need ?? "—"}</td>
                  <td className="secondary whitespace-nowrap px-4 py-3">{l.fields.budget ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={l.status} />
                  </td>
                  <td className="secondary whitespace-nowrap px-4 py-3">{l.assignedTo?.name ?? "—"}</td>
                  <td className="muted whitespace-nowrap px-4 py-3">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <LeadPanel id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
