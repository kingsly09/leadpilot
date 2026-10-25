import bcrypt from "bcryptjs";
import type { Channel, LeadStatus, PrismaClient } from "@prisma/client";
import type { TurnResult } from "@leadpilot/shared";
import { scoreLead } from "./scoring.js";

/**
 * A realistic, deterministic story for the public demo (Brightwave Digital, a fictional agency).
 * resetDemoData() wipes all lead/chat/automation data and recreates this, so whatever demo visitors
 * change is undone. Users are kept; the knowledge base is not touched.
 */

export const DEMO_USERS = [
  { email: "admin@leadpilot.test", name: "Demo Admin", role: "ADMIN" as const },
  { email: "agent@leadpilot.test", name: "Demo Agent", role: "AGENT" as const },
  { email: "viewer@leadpilot.test", name: "Demo Viewer", role: "VIEWER" as const },
];

type Turn = [role: "user" | "assistant" | "human_agent", content: string, intent?: TurnResult["intent"]];

type DemoLead = {
  name: string | null;
  email?: string;
  phone?: string;
  source: Channel;
  status: LeadStatus;
  daysAgo: number;
  owner: "admin" | "agent" | null;
  intent: TurnResult["intent"];
  fields: { need?: string; budget?: string; timeline?: string };
  turns: Turn[];
  aiEnabled?: boolean;
  meeting?: { state: "pending" | "executed"; preferredTime: string; confirmedTime?: string };
  events?: Array<{ event: string; status: "SUCCESS" | "FAILED"; error?: string }>;
};

const LEADS: DemoLead[] = [
  {
    name: "Ngozi Eze", email: "ngozi.eze@example.com", source: "web", status: "MEETING_BOOKED", daysAgo: 1, owner: "agent",
    intent: "booking", fields: { need: "Business website for a law firm", budget: "$3,000", timeline: "this month" },
    turns: [
      ["user", "Hi, how much does a website for a small law firm cost?"],
      ["assistant", "Business websites (up to 15 pages, with a blog and CMS) start at $2,500 and usually take 3–6 weeks. What kind of site do you have in mind?", "pricing"],
      ["user", "About 8 pages, with a contact form. Budget is around $3,000 and we'd like it live this month."],
      ["assistant", "That fits our Business website package well. Would you like a free 30-minute discovery call to plan it?", "booking"],
      ["user", "Yes please, Tuesday afternoon. My email is ngozi.eze@example.com"],
      ["assistant", "I've requested a discovery call for Tuesday afternoon. A team member will confirm the time by email shortly.", "booking"],
      ["human_agent", "Your discovery call is confirmed for Tuesday, 3:00pm WAT. A confirmation email is on its way to ngozi.eze@example.com."],
    ],
    meeting: { state: "executed", preferredTime: "Tuesday afternoon", confirmedTime: "Tuesday, 3:00pm WAT" },
    events: [{ event: "lead.hot", status: "SUCCESS" }, { event: "meeting.booked", status: "SUCCESS" }],
  },
  {
    name: "Tunde Bello", email: "tunde@bellohealth.example", source: "linkedin", status: "QUALIFIED", daysAgo: 0, owner: "admin",
    intent: "booking", fields: { need: "AI chatbot for clinic support", budget: "$8,000", timeline: "asap" },
    turns: [
      ["user", "We run three clinics and get flooded with WhatsApp questions. Can you build an AI assistant?"],
      ["assistant", "Yes — we build AI chatbots for websites, WhatsApp, Messenger and Instagram that answer questions and capture leads. Projects start at $1,500 and take 2–4 weeks. Roughly what budget do you have?", "question"],
      ["user", "Up to $8,000. We need it asap."],
      ["assistant", "That's a great fit. Shall we book a discovery call so the team can scope it?", "booking"],
      ["user", "Yes, Thursday morning works. tunde@bellohealth.example"],
      ["assistant", "I've requested a call for Thursday morning. A team member will confirm the exact time by email.", "booking"],
    ],
    meeting: { state: "pending", preferredTime: "Thursday morning" },
    events: [{ event: "lead.hot", status: "SUCCESS" }],
  },
  {
    name: "Amara Okafor", email: "amara@okaforstyle.example", source: "instagram", status: "QUALIFIED", daysAgo: 0, owner: "agent",
    intent: "booking", fields: { need: "E-commerce store for a fashion brand", budget: "$4,000", timeline: "this month" },
    turns: [
      ["user", "Hello! I need an online store for my clothing brand 👗"],
      ["assistant", "Lovely! Our e-commerce stores start at $3,500, with delivery in about 3–6 weeks. Do you have a budget in mind?", "pricing"],
      ["user", "Around $4,000, and I want to launch before the end of the month. Can we talk Friday? amara@okaforstyle.example"],
      ["assistant", "Perfect — I've requested a discovery call for Friday. A team member will confirm the time by email.", "booking"],
    ],
    meeting: { state: "pending", preferredTime: "Friday" },
    events: [{ event: "lead.hot", status: "FAILED", error: "HTTP 502: email failed: The credential \"Gmail account\" needs to be reconnected." }],
  },
  {
    name: "Daniel Mensah", email: "daniel@mensahlogistics.example", source: "web", status: "WON", daysAgo: 12, owner: "admin",
    intent: "booking", fields: { need: "Company website + SEO", budget: "$5,000", timeline: "within 30 days" },
    turns: [
      ["user", "We need a new website and better Google rankings for our logistics company."],
      ["assistant", "We can help with both: business websites start at $2,500 and ongoing SEO from $600/month. What budget and timeline are you working with?", "pricing"],
      ["user", "About $5,000 total, within 30 days. daniel@mensahlogistics.example — please book a call."],
      ["assistant", "Thanks Daniel! I've requested a discovery call; a team member will confirm by email.", "booking"],
    ],
    events: [{ event: "lead.hot", status: "SUCCESS" }, { event: "meeting.booked", status: "SUCCESS" }],
  },
  {
    name: "Emeka Obi", email: "emeka@obieats.example", source: "facebook", status: "NEW", daysAgo: 2, owner: null,
    intent: "pricing", fields: { need: "Facebook & Instagram ads for a restaurant", budget: "$800/month", timeline: "next week" },
    turns: [
      ["user", "How much do you charge to run Facebook ads for a restaurant?"],
      ["assistant", "Ads management starts at $500/month plus ad spend (we recommend at least $300/month). What monthly budget are you considering?", "pricing"],
      ["user", "About $800 a month, starting next week. emeka@obieats.example"],
      ["assistant", "Great, thanks Emeka! That budget works well. Would you like to book a quick call to plan the first campaign?", "pricing"],
    ],
    events: [{ event: "lead.hot", status: "SUCCESS" }],
  },
  {
    name: "James Carter", source: "facebook", status: "CONTACTED", daysAgo: 4, owner: "agent",
    intent: "pricing", fields: { need: "Social media ads", budget: "$1,500" },
    turns: [
      ["user", "What's the price for managing Instagram ads?"],
      ["assistant", "Ads management starts at $500/month plus ad spend, including monthly reporting. What budget do you have in mind?", "pricing"],
      ["user", "Maybe $1,500 total. Not sure about timing yet."],
      ["assistant", "No problem! When you're ready, share your email and I can set up a call with the team.", "pricing"],
    ],
  },
  {
    name: "Lina Zhou", email: "lina@zhoucrafts.example", source: "web", status: "CONTACTED", daysAgo: 6, owner: "agent",
    intent: "question", fields: { need: "SEO audit for an Etsy-style shop" },
    turns: [
      ["user", "Do you do SEO audits for small online shops?"],
      ["assistant", "Yes — a one-off SEO audit costs $400 and is delivered in 7 days. Would you like us to send details? If so, what's your email?", "question"],
      ["user", "lina@zhoucrafts.example, thanks. Probably next quarter."],
      ["assistant", "Thanks Lina! A team member will email you the details.", "question"],
    ],
  },
  {
    name: "Chidi Okeke", source: "web", status: "NEW", daysAgo: 0, owner: null, aiEnabled: false,
    intent: "support", fields: { need: "Site down after update" },
    turns: [
      ["user", "Our website has been down since your update yesterday and we're losing orders. I want to speak to a real person NOW."],
      ["assistant", "I'm really sorry about this. I'm connecting you with a team member right away — they'll reply here shortly.", "support"],
      ["user", "Please hurry."],
    ],
    events: [{ event: "handoff.requested", status: "SUCCESS" }],
  },
  {
    name: "Sarah Kim", email: "sarah@kimconsulting.example", source: "linkedin", status: "QUALIFIED", daysAgo: 9, owner: "admin",
    intent: "question", fields: { need: "Brand identity + website", budget: "$3,500" },
    turns: [
      ["user", "I'm launching a consultancy and need a logo and website."],
      ["assistant", "Branding packages start at $600 and starter websites at $1,200. What budget are you working with?", "question"],
      ["user", "About $3,500. sarah@kimconsulting.example"],
      ["assistant", "Thanks Sarah! That covers branding plus a website. Would you like to book a discovery call?", "question"],
    ],
  },
  {
    name: "Grace Adeyemi", source: "instagram", status: "NEW", daysAgo: 3, owner: null,
    intent: "question", fields: { need: "Wants to know about maintenance plans" },
    turns: [
      ["user", "Do you offer support after a website launches?"],
      ["assistant", "Yes! Every website includes 30 days of free support, and maintenance plans start at $99/month.", "question"],
    ],
  },
  {
    name: "Fatima Musa", phone: "+234 801 000 0000", source: "whatsapp", status: "NEW", daysAgo: 7, owner: null,
    intent: "pricing", fields: { need: "Logo design" },
    turns: [
      ["user", "How much is a logo?"],
      ["assistant", "Logo and brand identity packages start at $600. Is this for a new business?", "pricing"],
    ],
  },
  {
    name: null, source: "facebook", status: "LOST", daysAgo: 10, owner: null,
    intent: "spam", fields: {},
    turns: [
      ["user", "CLICK HERE to claim your FREE crypto $$$ 🚀🚀"],
      ["assistant", "I can help with questions about Brightwave's services. Is there something we can do for your business?", "spam"],
    ],
  },
];

const DAY = 24 * 60 * 60 * 1000;

export async function ensureDemoUsers(db: PrismaClient, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const ids: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, name: u.name },
      create: { ...u, passwordHash },
    });
    ids[u.role] = user.id;
  }
  return { admin: ids.ADMIN, agent: ids.AGENT };
}

export async function resetDemoData(db: PrismaClient, password: string) {
  // Children first (most relations cascade, but be explicit about order).
  await db.$transaction([
    db.toolCall.deleteMany(),
    db.message.deleteMany(),
    db.conversation.deleteMany(),
    db.lead.deleteMany(),
    db.contact.deleteMany(),
    db.pendingAction.deleteMany(),
    db.workflowRun.deleteMany(),
    db.auditLog.deleteMany(),
  ]);

  const owners = await ensureDemoUsers(db, password);
  const now = Date.now();

  for (const [i, d] of LEADS.entries()) {
    const start = now - d.daysAgo * DAY - (i + 1) * 37 * 60 * 1000; // spread within the day
    const at = (step: number) => new Date(start + step * 90 * 1000);
    const { score, tier, reasons } = scoreLead({
      intent: d.intent,
      extracted: { email: d.email ?? null, phone: d.phone ?? null, budget: d.fields.budget ?? null, timeline: d.fields.timeline ?? null },
    });

    const contact = await db.contact.create({
      data: { name: d.name, email: d.email, phone: d.phone, channelIds: { [d.source]: `demo-${i}` }, createdAt: at(0) },
    });
    const lead = await db.lead.create({
      data: {
        contactId: contact.id, source: d.source, status: d.status, score, tier,
        fields: { ...d.fields, intent: d.intent, ...(d.name ? { name: d.name } : {}) },
        assignedToId: d.owner ? owners[d.owner] : null, createdAt: at(0),
      },
    });
    const conversation = await db.conversation.create({
      data: {
        contactId: contact.id, channel: d.source, externalThreadId: `demo-thread-${i}`,
        aiEnabled: d.aiEnabled ?? true, createdAt: at(0), lastMessageAt: at(d.turns.length),
      },
    });

    let lastAssistantId: string | null = null;
    for (const [step, [role, content, intent]] of d.turns.entries()) {
      const msg = await db.message.create({
        data: {
          conversationId: conversation.id, role, content, createdAt: at(step + 1),
          ...(role === "assistant" ? { meta: { intent, scoreReasons: reasons, demo: true }, tokensIn: 900, tokensOut: 80 } : {}),
        },
      });
      if (role === "assistant") lastAssistantId = msg.id;
    }

    if (d.meeting && d.email) {
      const payload = {
        leadId: lead.id, conversationId: conversation.id, email: d.email, name: d.name,
        preferredTime: d.meeting.preferredTime, notes: d.fields.need ?? "",
        ...(d.meeting.confirmedTime ? { confirmedTime: d.meeting.confirmedTime } : {}),
      };
      const action = await db.pendingAction.create({
        data: {
          tool: "book_meeting", payload, reason: `${d.name} asked for a discovery call`, createdAt: at(d.turns.length),
          ...(d.meeting.state === "executed"
            ? { status: "EXECUTED", approvedById: owners.agent, decidedAt: at(d.turns.length + 2),
                result: { meeting: d.meeting.confirmedTime, email: { mode: "dev-outbox", to: d.email } } }
            : {}),
        },
      });
      if (lastAssistantId) {
        await db.toolCall.create({
          data: {
            messageId: lastAssistantId, tool: "request_meeting", status: "ok",
            input: { email: d.email, preferredTime: d.meeting.preferredTime, notes: d.fields.need ?? "" },
            output: { status: "pending_approval", pendingActionId: action.id },
          },
        });
      }
    }

    for (const [k, e] of (d.events ?? []).entries()) {
      await db.workflowRun.create({
        data: {
          workflow: "n8n:leadpilot-events", event: e.event, status: e.status, error: e.error ?? null,
          attempts: e.status === "FAILED" ? 3 : 1, startedAt: at(d.turns.length + k), finishedAt: at(d.turns.length + k),
          payload: {
            event: e.event, occurredAt: at(d.turns.length + k).toISOString(), details: { demo: true },
            lead: { id: lead.id, name: d.name, email: d.email ?? null, phone: d.phone ?? null, tier, score, status: d.status, source: d.source, fields: d.fields },
          },
        },
      });
    }
  }

  return { leads: LEADS.length };
}
