import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Plane, Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";

// Optional: set VITE_DEMO_PASSWORD on a public demo deployment to show one-click demo logins.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
const DEMO_USERS = [
  { email: "admin@leadpilot.test", label: "Admin", hint: "sees and does everything" },
  { email: "agent@leadpilot.test", label: "Agent", hint: "only their own leads" },
  { email: "viewer@leadpilot.test", label: "Viewer", hint: "read-only" },
];

export function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent, creds = { email, password }) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(creds.email, creds.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-white">
            <Plane size={17} aria-hidden />
          </span>
          LeadPilot
        </div>
        <form className="card space-y-3" onSubmit={submit}>
          <h1 className="text-base font-semibold">Sign in</h1>
          <label className="block text-sm">
            <span className="secondary mb-1 block">Email</span>
            <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="secondary mb-1 block">Password</span>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy && <Loader2 size={15} className="animate-spin" aria-hidden />} Sign in
          </button>
        </form>

        {DEMO_PASSWORD && (
          <div className="card mt-4">
            <p className="mb-2 text-sm font-medium">Try the demo as…</p>
            <div className="grid gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  className="btn btn-ghost justify-between"
                  disabled={busy}
                  onClick={(e) => submit(e, { email: u.email, password: DEMO_PASSWORD })}
                >
                  <span>{u.label}</span>
                  <span className="muted text-xs font-normal">{u.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
