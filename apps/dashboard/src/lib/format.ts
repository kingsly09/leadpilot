export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  MEETING_BOOKED: "Meeting booked",
  WON: "Won",
  LOST: "Lost",
};

export const CHANNEL_LABEL: Record<string, string> = {
  web: "Website",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  email: "Email",
};

export const TOOL_LABEL: Record<string, string> = {
  book_meeting: "Book meeting",
  send_email: "Send email",
};

export const EVENT_LABEL: Record<string, string> = {
  "lead.created": "New lead",
  "lead.hot": "Hot lead",
  "handoff.requested": "Needs a human",
  "meeting.booked": "Meeting booked",
};

export function percent(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function displayName(contact: { name: string | null; email?: string | null }) {
  return contact.name || contact.email || "Anonymous visitor";
}
