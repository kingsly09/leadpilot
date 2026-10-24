import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, CalendarClock, Mail } from "lucide-react";
import { api, type PendingAction } from "../lib/api";
import { useAuth } from "../lib/auth";
import { TOOL_LABEL, dateTime, timeAgo } from "../lib/format";
import { Empty, ErrorBox, Loading, PageHeader, StateLabel } from "../components/ui";

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v));

function PendingCard({ a }: { a: PendingAction }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const isMeeting = a.tool === "book_meeting";
  // Reviewers can adjust the action before it runs.
  const [confirmedTime, setConfirmedTime] = useState(str(a.payload.preferredTime));
  const [subject, setSubject] = useState(str(a.payload.subject));
  const [body, setBody] = useState(str(a.payload.body));

  const done = () => {
    qc.invalidateQueries({ queryKey: ["approvals"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };
  const approve = useMutation({
    mutationFn: () =>
      api(`/approvals/${a.id}/approve`, {
        method: "POST",
        json: { edits: isMeeting ? { confirmedTime } : { subject, body } },
      }),
    onSuccess: done,
  });
  const reject = useMutation({ mutationFn: () => api(`/approvals/${a.id}/reject`, { method: "POST" }), onSuccess: done });
  const busy = approve.isPending || reject.isPending;
  const editable = can("ADMIN", "AGENT");

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--surface-2)" }}>
            {isMeeting ? <CalendarClock size={16} aria-hidden /> : <Mail size={16} aria-hidden />}
          </span>
          <div>
            <div className="font-semibold">{TOOL_LABEL[a.tool] ?? a.tool}</div>
            <div className="muted text-xs">{a.reason} · requested {timeAgo(a.createdAt)}</div>
          </div>
        </div>
        <StateLabel state="PENDING" />
      </div>

      {isMeeting ? (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="muted text-xs">Customer</div>
            <div>
              {str(a.payload.name) || "—"} · {str(a.payload.email)}
            </div>
          </div>
          <div>
            <div className="muted text-xs">About</div>
            <div>{str(a.payload.notes) || "—"}</div>
          </div>
          <label className="sm:col-span-2">
            <span className="muted mb-1 block text-xs">Meeting time to confirm (customer asked for: “{str(a.payload.preferredTime) || "any time"}”)</span>
            <input className="input" value={confirmedTime} onChange={(e) => setConfirmedTime(e.target.value)} disabled={!editable} />
          </label>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="muted text-xs">To: {str(a.payload.to)}</div>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} aria-label="Subject" />
          <textarea className="input min-h-[100px]" value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable} aria-label="Body" />
        </div>
      )}

      {(approve.error || reject.error) && <ErrorBox error={approve.error ?? reject.error} />}
      {editable && (
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={busy || (isMeeting && !confirmedTime.trim())} onClick={() => approve.mutate()}>
            <Check size={15} aria-hidden /> Approve{isMeeting ? " & send confirmation" : " & send"}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => reject.mutate()}>
            <X size={15} aria-hidden /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function Approvals() {
  const [tab, setTab] = useState<"PENDING" | "HISTORY">("PENDING");
  const actions = useQuery({ queryKey: ["approvals"], queryFn: () => api<PendingAction[]>("/approvals"), refetchInterval: 15_000 });
  const pending = actions.data?.filter((a) => a.status === "PENDING") ?? [];
  const history = actions.data?.filter((a) => a.status !== "PENDING") ?? [];

  return (
    <>
      <PageHeader title="Approvals" subtitle="The AI never books meetings or sends emails on its own. You decide here." />
      <div className="mb-4 inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }} role="tablist">
        {(["PENDING", "HISTORY"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={tab === t ? { background: "var(--surface-2)" } : { color: "var(--text-secondary)" }}
          >
            {t === "PENDING" ? `Waiting (${pending.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {actions.isLoading && <Loading />}
      {actions.error && <ErrorBox error={actions.error} />}

      {tab === "PENDING" &&
        actions.data &&
        (pending.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {pending.map((a) => (
              <PendingCard key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <Empty title="Nothing waiting for approval" hint="When the AI wants to book a meeting or send an email, it shows up here." />
        ))}

      {tab === "HISTORY" &&
        actions.data &&
        (history.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="muted text-xs uppercase tracking-wide">
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Outcome</th>
                  <th className="px-4 py-3 font-medium">Decided by</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{TOOL_LABEL[a.tool] ?? a.tool}</div>
                      <div className="muted text-xs">{a.reason}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StateLabel state={a.status} />
                      {a.status === "FAILED" && <div className="muted mt-1 text-xs">{str(a.result?.error)}</div>}
                    </td>
                    <td className="secondary px-4 py-3">{a.approvedBy?.name ?? "—"}</td>
                    <td className="muted px-4 py-3">{a.decidedAt ? dateTime(a.decidedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No decisions yet" />
        ))}
    </>
  );
}
