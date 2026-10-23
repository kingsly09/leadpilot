import { z } from "zod";
import type { Role } from "@leadpilot/shared";
import { db } from "../lib/db.js";
import { searchKb } from "../lib/kb.js";

/**
 * Every action the AI can take is defined once here and shared by:
 *  - the customer-facing chatbot (audience "agent", via OpenAI tool calling)
 *  - the MCP server used by team members' AI assistants (audience "mcp")
 *
 * risk:
 *  - "read"     runs immediately
 *  - "write"    runs immediately, only for ADMIN/AGENT users, and is audit-logged
 *  - "approval" never runs directly: it creates a PendingAction a human must approve
 */
export type Actor =
  | { type: "ai"; conversationId: string; leadId: string }
  | { type: "user"; userId: string; role: Role };

export type ToolDef = {
  name: string;
  description: string;
  input: z.ZodObject<z.ZodRawShape>;
  risk: "read" | "write" | "approval";
  audience: Array<"agent" | "mcp">;
  run: (input: any, actor: Actor) => Promise<unknown>;
};

const LeadStatus = z.enum(["NEW", "CONTACTED", "QUALIFIED", "MEETING_BOOKED", "WON", "LOST"]);

/** The chatbot may only touch its own customer's lead; agents only leads assigned to them. */
async function assertLeadAccess(leadId: string, actor: Actor) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { contact: true } });
  if (!lead) throw new Error("Lead not found");
  if (actor.type === "ai" && actor.leadId !== leadId) throw new Error("Not allowed");
  if (actor.type === "user" && actor.role === "AGENT" && lead.assignedToId !== actor.userId) {
    throw new Error("Not allowed: lead is assigned to someone else");
  }
  return lead;
}

async function queueApproval(tool: string, payload: Record<string, unknown>, reason: string) {
  const action = await db.pendingAction.create({ data: { tool, payload: payload as object, reason } });
  return { status: "pending_approval", pendingActionId: action.id, note: "A team member must approve this first." };
}

export const tools: ToolDef[] = [
  {
    name: "search_knowledge_base",
    description: "Search the business knowledge base (services, prices, FAQ). Returns the most relevant passages.",
    input: z.object({ query: z.string().describe("What to look up") }),
    risk: "read",
    audience: ["mcp"], // the chatbot already gets RAG context automatically
    run: async ({ query }) => searchKb(query, 4),
  },
  {
    name: "list_leads",
    description: "List leads, highest score first. Optionally filter by tier (HOT/WARM/COLD) or status.",
    input: z.object({
      tier: z.enum(["HOT", "WARM", "COLD"]).optional(),
      status: LeadStatus.optional(),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    risk: "read",
    audience: ["mcp"],
    run: async ({ tier, status, limit }, actor) => {
      const scope = actor.type === "user" && actor.role === "AGENT" ? { assignedToId: actor.userId } : {};
      const leads = await db.lead.findMany({
        where: { ...scope, tier, status },
        include: { contact: true },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: limit,
      });
      return leads.map((l) => ({
        id: l.id, name: l.contact.name, email: l.contact.email, source: l.source,
        tier: l.tier, score: l.score, status: l.status, fields: l.fields, createdAt: l.createdAt,
      }));
    },
  },
  {
    name: "get_lead",
    description: "Get one lead with contact details and the full conversation.",
    input: z.object({ leadId: z.string() }),
    risk: "read",
    audience: ["mcp"],
    run: async ({ leadId }, actor) => {
      await assertLeadAccess(leadId, actor);
      return db.lead.findUnique({
        where: { id: leadId },
        include: {
          contact: {
            include: {
              conversations: {
                include: {
                  messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } },
                },
              },
            },
          },
        },
      });
    },
  },
  {
    name: "update_lead_status",
    description: "Change a lead's pipeline status.",
    input: z.object({ leadId: z.string(), status: LeadStatus }),
    risk: "write",
    audience: ["mcp"],
    run: async ({ leadId, status }, actor) => {
      const before = await assertLeadAccess(leadId, actor);
      const after = await db.lead.update({ where: { id: leadId }, data: { status } });
      await db.auditLog.create({
        data: {
          userId: actor.type === "user" ? actor.userId : null,
          action: "lead.update_status",
          entity: "Lead",
          entityId: leadId,
          before: { status: before.status },
          after: { status: after.status },
        },
      });
      return { id: after.id, status: after.status };
    },
  },
  {
    name: "request_meeting",
    description:
      "Request a discovery call for the current customer. Use only when the customer asked to book a call and has given an email. A team member confirms it.",
    // Chatbot tools use OpenAI strict mode: every field required, "optional" expressed as nullable.
    input: z.object({
      email: z.string().nullable().describe("The customer's email, if they gave it in this conversation"),
      preferredTime: z.string().nullable().describe("When the customer would like the call, in their words"),
      notes: z.string().describe("One-line summary of what they need"),
    }),
    risk: "approval",
    audience: ["agent"],
    run: async ({ email, preferredTime, notes }, actor) => {
      if (actor.type !== "ai") throw new Error("request_meeting is only for the chatbot");
      const lead = await assertLeadAccess(actor.leadId, actor);
      const to = lead.contact.email || email;
      if (!to || !z.string().email().safeParse(to).success) {
        return { error: "Ask the customer for a valid email first." };
      }
      return queueApproval(
        "book_meeting",
        {
          leadId: lead.id,
          conversationId: actor.conversationId,
          email: to,
          name: lead.contact.name,
          preferredTime,
          notes,
        },
        `${lead.contact.name ?? "Customer"} asked for a discovery call`,
      );
    },
  },
  {
    name: "send_email",
    description: "Draft an email to a lead. It is NOT sent until a team member approves it in the dashboard.",
    input: z.object({ leadId: z.string(), subject: z.string(), body: z.string() }),
    risk: "approval",
    audience: ["mcp"],
    run: async ({ leadId, subject, body }, actor) => {
      const lead = await assertLeadAccess(leadId, actor);
      if (!lead.contact.email) throw new Error("This lead has no email address");
      return queueApproval(
        "send_email",
        { leadId, to: lead.contact.email, subject, body },
        `Email to ${lead.contact.name ?? lead.contact.email}: "${subject}"`,
      );
    },
  },
];

export function toolsFor(audience: "agent" | "mcp") {
  return tools.filter((t) => t.audience.includes(audience));
}

/** Validates input and enforces role rules before running any tool. */
export async function runTool(def: ToolDef, rawInput: unknown, actor: Actor) {
  const input = def.input.parse(rawInput ?? {});
  if (def.risk !== "read" && actor.type === "user" && actor.role === "VIEWER") {
    throw new Error("Viewers can only read");
  }
  return def.run(input, actor);
}
