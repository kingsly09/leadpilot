import { PrismaClient, type Channel, type LeadStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { scoreLead } from "../src/lib/scoring.js";

const db = new PrismaClient();

// Demo-only accounts for the portfolio deployment. Change before exposing real data.
const DEMO_PASSWORD = "LeadPilot-demo-2026";

const samples: Array<{
  name: string; email?: string; phone?: string; source: Channel; status: LeadStatus;
  intent: "question" | "pricing" | "booking" | "support" | "not_interested" | "spam";
  budget?: string; timeline?: string; need: string; firstMessage: string;
}> = [
  { name: "Amara Okafor", email: "amara@example.com", source: "instagram", status: "QUALIFIED", intent: "booking",
    budget: "$3,000", timeline: "this month", need: "Website redesign", firstMessage: "Hi, can we book a call about a new website?" },
  { name: "James Carter", email: "james@example.com", source: "facebook", status: "NEW", intent: "pricing",
    budget: "$1,500", need: "Social media ads", firstMessage: "How much do you charge for FB ads management?" },
  { name: "Lina Zhou", phone: "+15550100", source: "web", status: "CONTACTED", intent: "question",
    timeline: "next quarter", need: "SEO audit", firstMessage: "Do you do SEO audits for ecommerce?" },
  { name: "Tunde Bello", email: "tunde@example.com", source: "linkedin", status: "MEETING_BOOKED", intent: "booking",
    budget: "$8,000", timeline: "asap", need: "AI chatbot for support", firstMessage: "Interested in an AI support bot. Need it asap." },
  { name: "Unknown", source: "facebook", status: "LOST", intent: "spam", need: "-", firstMessage: "Click here to win $$$" },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await db.user.upsert({
    where: { email: "admin@leadpilot.test" },
    update: {},
    create: { email: "admin@leadpilot.test", name: "Demo Admin", role: "ADMIN", passwordHash },
  });
  const agent = await db.user.upsert({
    where: { email: "agent@leadpilot.test" },
    update: {},
    create: { email: "agent@leadpilot.test", name: "Demo Agent", role: "AGENT", passwordHash },
  });
  await db.user.upsert({
    where: { email: "viewer@leadpilot.test" },
    update: {},
    create: { email: "viewer@leadpilot.test", name: "Demo Viewer", role: "VIEWER", passwordHash },
  });

  for (const [i, s] of samples.entries()) {
    const externalId = `seed-${i}`;
    if (await db.lead.findUnique({ where: { externalId } })) continue;

    const { score, tier } = scoreLead({
      intent: s.intent,
      extracted: { email: s.email ?? null, phone: s.phone ?? null, budget: s.budget ?? null, timeline: s.timeline ?? null },
    });

    await db.contact.create({
      data: {
        name: s.name, email: s.email, phone: s.phone,
        channelIds: { [s.source]: `demo-user-${i}` },
        leads: {
          create: {
            source: s.source, status: s.status, score, tier, externalId,
            fields: { budget: s.budget, timeline: s.timeline, need: s.need, intent: s.intent },
            assignedToId: i % 2 === 0 ? agent.id : admin.id,
          },
        },
        conversations: {
          create: {
            channel: s.source,
            externalThreadId: `demo-thread-${i}`,
            messages: { create: [{ role: "user", content: s.firstMessage }] },
          },
        },
      },
    });
  }

  console.log("Seeded users (admin/agent/viewer @leadpilot.test) and", samples.length, "leads.");
}

main().finally(() => db.$disconnect());
