export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

const TOKEN_KEY = "leadpilot_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the session just won't survive a reload */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Fetch wrapper: adds the login token, parses JSON, and turns HTTP errors into ApiError. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.json !== undefined) headers.set("content-type", "application/json");

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  if (res.status === 401 && path !== "/auth/login") {
    setToken(null);
    window.dispatchEvent(new Event("leadpilot:logout"));
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/* ---------- Types returned by the API ---------- */

export type Role = "ADMIN" | "AGENT" | "VIEWER";
export type Tier = "HOT" | "WARM" | "COLD";
export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "MEETING_BOOKED" | "WON" | "LOST";
export type Channel = "web" | "facebook" | "instagram" | "linkedin" | "whatsapp" | "email";

export const LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "MEETING_BOOKED", "WON", "LOST"];

export type User = { id: string; name: string; email: string; role: Role };

export type Contact = { id: string; name: string | null; email: string | null; phone: string | null };

export type LeadFields = { need?: string; budget?: string; timeline?: string; intent?: string; name?: string };

export type Lead = {
  id: string;
  source: Channel;
  score: number;
  tier: Tier;
  status: LeadStatus;
  fields: LeadFields;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  contact: Contact;
  createdAt: string;
  updatedAt: string;
};

export type Stats = {
  totals: {
    leads: number;
    hot: number;
    warm: number;
    cold: number;
    meetingsBooked: number;
    bookingRate: number;
    pendingApprovals: number;
    failedRuns: number;
    handedOff: number;
  };
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  perDay: Array<{ day: string; HOT: number; WARM: number; COLD: number }>;
  messages: Record<string, number>;
  tokens: { in: number; out: number };
};

export type MessageRole = "user" | "assistant" | "human_agent" | "system";

export type ConversationSummary = {
  id: string;
  channel: Channel;
  aiEnabled: boolean;
  lastMessageAt: string;
  contact: { id: string; name: string | null; email: string | null };
  lead: { id: string; tier: Tier; score: number; status: LeadStatus } | null;
  lastMessage: { role: MessageRole; content: string } | null;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  meta: { intent?: string; scoreReasons?: string[]; handoffToHuman?: boolean } | null;
  toolCalls: Array<{ tool: string; status: string; input: unknown; output: unknown }>;
};

export type ConversationDetail = {
  id: string;
  channel: Channel;
  aiEnabled: boolean;
  contact: Contact & { leads: Array<Omit<Lead, "contact" | "assignedTo">> };
  messages: Message[];
};

export type PendingAction = {
  id: string;
  tool: string;
  payload: Record<string, unknown>;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
  result: Record<string, unknown> | null;
  approvedBy: { id: string; name: string } | null;
  createdAt: string;
  decidedAt: string | null;
};

export type WorkflowRun = {
  id: string;
  workflow: string;
  event: string;
  payload: { lead?: { name?: string | null; email?: string | null } | null };
  status: "RUNNING" | "SUCCESS" | "FAILED";
  error: string | null;
  attempts: number;
  startedAt: string;
  finishedAt: string | null;
};

export type KbDocument = { id: string; title: string; source: string | null; createdAt: string; _count: { chunks: number } };
export type KbHit = { id: string; content: string; similarity: number };
