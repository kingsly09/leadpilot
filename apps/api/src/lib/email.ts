import { env } from "../env.js";

export type EmailResult = { mode: "resend" | "dev-outbox"; id?: string; to: string; subject: string };

/**
 * Sends through Resend when RESEND_API_KEY is set. Without a key (local dev / portfolio demo)
 * the email is not sent; it is returned as a "dev-outbox" result so the flow can still be tested.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<EmailResult> {
  if (!env.RESEND_API_KEY) {
    console.error(`[dev-outbox] to=${to} subject="${subject}"\n${text}`);
    return { mode: "dev-outbox", to, subject };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { mode: "resend", id: data.id, to, subject };
}
