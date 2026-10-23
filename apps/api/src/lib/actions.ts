import { db } from "./db.js";
import { sendEmail } from "./email.js";

/**
 * What actually happens once a human approves a PendingAction.
 * Payloads were written by tools in tools/registry.ts; a reviewer may have edited them.
 */
type Executor = (payload: any) => Promise<unknown>;

const executors: Record<string, Executor> = {
  async send_email({ to, subject, body }) {
    return sendEmail(to, subject, body);
  },

  async book_meeting({ leadId, conversationId, email, name, preferredTime, notes, confirmedTime }) {
    const when = confirmedTime || preferredTime || "a time our team will confirm by email";
    const email_ = await sendEmail(
      email,
      "Your discovery call with Brightwave Digital",
      `Hi ${name ?? "there"},\n\nThanks for reaching out about: ${notes}.\n` +
        `Your free 30-minute discovery call is booked for ${when}.\n\nSee you soon,\nBrightwave Digital`,
    );
    await db.lead.update({ where: { id: leadId }, data: { status: "MEETING_BOOKED" } });
    // Let the customer see the confirmation in their chat too.
    if (conversationId) {
      await db.message.create({
        data: {
          conversationId,
          role: "human_agent",
          content: `Your discovery call is confirmed for ${when}. A confirmation email is on its way to ${email}.`,
        },
      });
    }
    return { meeting: when, email: email_ };
  },
};

export function canExecute(tool: string) {
  return tool in executors;
}

export async function executeAction(tool: string, payload: unknown) {
  const run = executors[tool];
  if (!run) throw new Error(`No executor for "${tool}"`);
  return run(payload);
}
