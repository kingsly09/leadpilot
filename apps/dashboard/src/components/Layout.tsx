import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, MessagesSquare, ShieldCheck, Workflow, BookOpen, LogOut, Menu, X, Plane } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api, type Stats } from "../lib/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/inbox", label: "Inbox", icon: MessagesSquare, badge: "handedOff" as const },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, badge: "pendingApprovals" as const },
  { to: "/automations", label: "Automations", icon: Workflow, badge: "failedRuns" as const },
  { to: "/knowledge", label: "Knowledge base", icon: BookOpen },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  // Counts for the little badges next to menu items; refreshed every 30s.
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/stats"), refetchInterval: 30_000 });

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end, badge }) => {
        const count = badge ? stats.data?.totals[badge] : 0;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? "bg-[var(--surface-2)] text-[var(--text-primary)]" : "secondary hover:bg-[var(--surface-2)]"
              }`
            }
          >
            <Icon size={17} aria-hidden />
            <span className="flex-1">{label}</span>
            {count ? (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-semibold text-white">{count}</span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2 px-3 font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-white">
        <Plane size={15} aria-hidden />
      </span>
      LeadPilot
    </div>
  );

  const userBox = (
    <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
      <div className="px-3 text-sm font-medium">{user?.name}</div>
      <div className="muted px-3 text-xs">
        {user?.email} · {user?.role.toLowerCase()}
      </div>
      <button className="btn btn-ghost mt-2 w-full" onClick={logout}>
        <LogOut size={15} aria-hidden /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r p-3 lg:flex"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="pt-2">{brand}</div>
        <div className="flex-1">{nav}</div>
        {userBox}
      </aside>

      {/* Mobile top bar + drawer */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 lg:hidden"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        {brand}
        <button className="btn btn-ghost" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[57px] z-10 flex flex-col gap-4 border-b p-3 lg:hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          {nav}
          {userBox}
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
