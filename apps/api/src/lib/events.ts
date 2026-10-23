import { db } from "./db.js";
import { env } from "../env.js";

/**
 * Business events LeadPilot sends to n8n. n8n decides what to do with each one
 * (alerts, CRM sync, sheets...), so automations can change without touching this code.
 */
export type LeadEvent = "lead.created" | "lead.hot" | "handoff.requested" | "meeting.booked";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 1000, 3000];

async function leadSnapshot(leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { contact: true } });
  if (!lead) return null;
  return {
    id: lead.id,
    name: lead.contact.name,
    email: lead.contact.email,
    phone: lead.contact.phone,
    tier: lead.tier,
    score: lead.score,
    status: lead.status,
    source: lead.source,
    fields: lead.fields,
  };
}

/** Delivers one WorkflowRun to n8n, retrying network errors and 5xx responses with backoff. */
export async function deliverRun(runId: string) {
  const run = await db.workflowRun.findUniqueOrThrow({ where: { id: runId } });
  let lastError = "";
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    if (BACKOFF_MS[attempt - 1]) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    try {
      const res = await fetch(env.N8N_WEBHOOK_URL!, {
        method: "POST",
        headers: { "content-type": "application/json", "x-leadpilot-secret": env.N8N_WEBHOOK_SECRET ?? "" },
        body: JSON.stringify(run.payload),
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      if (res.ok) {
        return db.workflowRun.update({
          where: { id: runId },
          data: { status: "SUCCESS", attempts: attempt, error: null, finishedAt: new Date() },
        });
      }
      lastError = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      if (res.status < 500) break; // 4xx (e.g. wrong secret) won't fix itself by retrying
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return db.workflowRun.update({
    where: { id: runId },
    data: { status: "FAILED", attempts, error: lastError, finishedAt: new Date() },
  });
}

/**
 * Records the event as a WorkflowRun and delivers it in the background.
 * Never throws: a broken automation must not break the customer's chat.
 */
export function emitEvent(event: LeadEvent, leadId: string, details: Record<string, unknown> = {}) {
  if (!env.N8N_WEBHOOK_URL) return;
  void (async () => {
    try {
      const lead = await leadSnapshot(leadId);
      const payload = { event, occurredAt: new Date().toISOString(), lead, details };
      const run = await db.workflowRun.create({
        data: { workflow: "n8n:leadpilot-events", event, payload: payload as object },
      });
      await deliverRun(run.id);
    } catch (err) {
      console.error(`[events] failed to emit ${event}`, err);
    }
  })();
}
