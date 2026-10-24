import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";
import { Flame, CalendarCheck, Users, ShieldCheck, Hand, AlertTriangle } from "lucide-react";
import { api, type Stats } from "../lib/api";
import { CHANNEL_LABEL, STATUS_LABEL, percent } from "../lib/format";
import { ErrorBox, Loading, PageHeader } from "../components/ui";

function StatTile({ label, value, sub, icon: Icon, to }: { label: string; value: string | number; sub?: string; icon: typeof Flame; to?: string }) {
  const body = (
    <div className="card h-full transition hover:shadow-sm">
      <div className="secondary flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        <Icon size={14} aria-hidden /> {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="muted mt-0.5 text-xs">{sub}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--text-primary)", fontWeight: 600 },
  itemStyle: { color: "var(--text-secondary)" },
  cursor: { fill: "var(--surface-2)" },
};
const axis = { stroke: "var(--text-muted)", fontSize: 11, tickLine: false, axisLine: false };

/** One horizontal bar per category, single series, value labelled at the bar end. */
function CategoryBars({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 32, top: 0, bottom: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={110} {...axis} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Leads"]} />
          <Bar isAnimationActive={false} dataKey="value" name="Leads" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={20}>
            <LabelList dataKey="value" position="right" style={{ fill: "var(--text-secondary)", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Overview() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/stats") });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const t = data.totals;

  const perDay = data.perDay.map((d) => ({
    ...d,
    label: new Date(d.day + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  const pipeline = Object.keys(STATUS_LABEL).map((s) => ({ name: STATUS_LABEL[s], value: data.byStatus[s] ?? 0 }));
  const sources = Object.entries(data.bySource)
    .map(([k, v]) => ({ name: CHANNEL_LABEL[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const aiMessages = data.messages.assistant ?? 0;
  const humanMessages = data.messages.human_agent ?? 0;

  return (
    <>
      <PageHeader title="Overview" subtitle="How the AI assistant is doing across every channel" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Leads" value={t.leads} sub={`${t.warm} warm · ${t.cold} cold`} icon={Users} to="/leads" />
        <StatTile label="Hot leads" value={t.hot} sub={t.leads ? `${percent(t.hot / t.leads)} of all leads` : undefined} icon={Flame} to="/leads?tier=HOT" />
        <StatTile label="Meetings" value={t.meetingsBooked} sub={`${percent(t.bookingRate)} booking rate`} icon={CalendarCheck} />
        <StatTile label="To approve" value={t.pendingApprovals} sub="AI actions waiting" icon={ShieldCheck} to="/approvals" />
        <StatTile label="Need a human" value={t.handedOff} sub="AI paused in chat" icon={Hand} to="/inbox?handedOff=true" />
        <StatTile label="Failed alerts" value={t.failedRuns} sub="last 14 days" icon={AlertTriangle} to="/automations" />
      </div>

      <div className="card mt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">New leads per day, by tier</h2>
          <span className="muted text-xs">last 14 days</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={perDay} margin={{ left: -20, right: 8, top: 4, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip {...tooltipStyle} />
            <Legend
              iconType="square"
              iconSize={10}
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value: string) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>}
            />
            {/* Stacked cold → warm → hot; a 2px surface stroke separates the segments. */}
            <Bar isAnimationActive={false} dataKey="COLD" name="Cold" stackId="t" fill="var(--tier-cold)" stroke="var(--surface-1)" strokeWidth={2} maxBarSize={28} />
            <Bar isAnimationActive={false} dataKey="WARM" name="Warm" stackId="t" fill="var(--tier-warm)" stroke="var(--surface-1)" strokeWidth={2} maxBarSize={28} />
            <Bar isAnimationActive={false} dataKey="HOT" name="Hot" stackId="t" fill="var(--tier-hot)" stroke="var(--surface-1)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CategoryBars title="Pipeline by status" data={pipeline} />
        <CategoryBars title="Leads by channel" data={sources} />
      </div>

      <div className="card mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <div className="muted text-xs uppercase tracking-wide">AI replies</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{aiMessages}</div>
        </div>
        <div>
          <div className="muted text-xs uppercase tracking-wide">Human replies</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{humanMessages}</div>
        </div>
        <div>
          <div className="muted text-xs uppercase tracking-wide">AI tokens used</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{(data.tokens.in + data.tokens.out).toLocaleString()}</div>
        </div>
      </div>
    </>
  );
}
