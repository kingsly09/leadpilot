import type { ReactNode } from "react";
import { Flame, Snowflake, Sun, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Tier } from "../lib/api";
import { STATUS_LABEL } from "../lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="secondary mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TIER_STYLE: Record<Tier, { icon: typeof Flame; cls: string }> = {
  HOT: { icon: Flame, cls: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900" },
  WARM: { icon: Sun, cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900" },
  COLD: { icon: Snowflake, cls: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700" },
};

/** Tier always shows icon + word, never colour alone. */
export function TierBadge({ tier, score }: { tier: Tier; score?: number }) {
  const { icon: Icon, cls } = TIER_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      <Icon size={12} aria-hidden />
      {tier}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const RUN_STYLE = {
  SUCCESS: { icon: CheckCircle2, cls: "text-green-700 dark:text-green-400", label: "Success" },
  FAILED: { icon: XCircle, cls: "text-red-700 dark:text-red-400", label: "Failed" },
  RUNNING: { icon: Clock, cls: "text-amber-700 dark:text-amber-400", label: "Running" },
  PENDING: { icon: Clock, cls: "text-amber-700 dark:text-amber-400", label: "Pending" },
  EXECUTED: { icon: CheckCircle2, cls: "text-green-700 dark:text-green-400", label: "Executed" },
  APPROVED: { icon: CheckCircle2, cls: "text-green-700 dark:text-green-400", label: "Approved" },
  REJECTED: { icon: XCircle, cls: "text-slate-600 dark:text-slate-400", label: "Rejected" },
} as const;

/** Status always pairs an icon with a label. */
export function StateLabel({ state }: { state: keyof typeof RUN_STYLE }) {
  const { icon: Icon, cls, label } = RUN_STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="muted flex items-center gap-2 py-10 text-sm justify-center">
      <Loader2 size={16} className="animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="card flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      {error instanceof Error ? error.message : "Something went wrong."}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="muted mt-1 text-sm">{hint}</p>}
    </div>
  );
}
