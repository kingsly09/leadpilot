import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { api, type WorkflowRun } from "../lib/api";
import { useAuth } from "../lib/auth";
import { EVENT_LABEL, dateTime } from "../lib/format";
import { Empty, ErrorBox, Loading, PageHeader, StateLabel } from "../components/ui";

function RetryButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: () => api<WorkflowRun>(`/workflow-runs/${id}/retry`, { method: "POST" }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["workflow-runs"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
  return (
    <button className="btn btn-ghost" disabled={retry.isPending} onClick={() => retry.mutate()}>
      <RotateCcw size={14} className={retry.isPending ? "animate-spin" : ""} aria-hidden /> Retry
    </button>
  );
}

export function Automations() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const runs = useQuery({
    queryKey: ["workflow-runs", status],
    queryFn: () => api<WorkflowRun[]>(`/workflow-runs?take=100${status ? `&status=${status}` : ""}`),
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Every event sent to n8n (sales alerts by email and Telegram), and whether it was delivered"
        actions={
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by result">
            <option value="">All results</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="RUNNING">Running</option>
          </select>
        }
      />
      {runs.isLoading && <Loading />}
      {runs.error && <ErrorBox error={runs.error} />}
      {runs.data?.length === 0 && <Empty title="No automation runs" hint="Events appear here when leads arrive, turn hot, or book meetings." />}
      {!!runs.data?.length && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="muted text-xs uppercase tracking-wide">
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Tries</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {runs.data.map((r) => (
                <tr key={r.id} className="border-b align-top last:border-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 font-medium">{EVENT_LABEL[r.event] ?? r.event}</td>
                  <td className="secondary px-4 py-3">{r.payload.lead?.name || r.payload.lead?.email || "—"}</td>
                  <td className="px-4 py-3">
                    <StateLabel state={r.status} />
                    {r.error && (
                      <div className="muted mt-1 line-clamp-2 max-w-[360px] break-words text-xs" title={r.error}>
                        {r.error}
                      </div>
                    )}
                  </td>
                  <td className="secondary px-4 py-3 tabular-nums">{r.attempts}</td>
                  <td className="muted px-4 py-3">{dateTime(r.startedAt)}</td>
                  <td className="px-4 py-3 text-right">{r.status === "FAILED" && can("ADMIN") && <RetryButton id={r.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
