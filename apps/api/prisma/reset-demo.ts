import { PrismaClient } from "@prisma/client";
import { resetDemoData } from "../src/lib/demo-data.js";

// Wipes leads/chats/approvals/automation logs and recreates the demo story. Keeps users and knowledge base.
const db = new PrismaClient();
const password = process.env.DEMO_PASSWORD ?? "LeadPilot-demo-2026";
const result = await resetDemoData(db, password);
console.log(`Demo data reset: ${result.leads} leads.`);
await db.$disconnect();
