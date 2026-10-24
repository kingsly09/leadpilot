import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";

/** Agents only see conversations of contacts whose lead is assigned to them. */
function scopeFor(req: FastifyRequest) {
  return req.user.role === "AGENT" ? { contact: { leads: { some: { assignedToId: req.user.id } } } } : {};
}

async function findScoped(req: FastifyRequest, id: string) {
  return db.conversation.findFirst({ where: { id, ...scopeFor(req) } });
}

export const conversationRoutes: FastifyPluginAsync = async (app) => {
  // Inbox list: newest activity first, with the last message as a preview.
  app.get("/conversations", { preHandler: app.authenticate }, async (req) => {
    const q = z.object({ handedOff: z.enum(["true", "false"]).optional() }).parse(req.query);
    const rows = await db.conversation.findMany({
      where: { ...scopeFor(req), ...(q.handedOff ? { aiEnabled: q.handedOff === "false" } : {}) },
      include: {
        contact: { include: { leads: { orderBy: { createdAt: "desc" }, take: 1 } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });
    return rows.map((c) => ({
      id: c.id,
      channel: c.channel,
      aiEnabled: c.aiEnabled,
      lastMessageAt: c.lastMessageAt,
      contact: { id: c.contact.id, name: c.contact.name, email: c.contact.email },
      lead: c.contact.leads[0]
        ? { id: c.contact.leads[0].id, tier: c.contact.leads[0].tier, score: c.contact.leads[0].score, status: c.contact.leads[0].status }
        : null,
      lastMessage: c.messages[0] ? { role: c.messages[0].role, content: c.messages[0].content } : null,
    }));
  });

  app.get<{ Params: { id: string } }>("/conversations/:id", { preHandler: app.authenticate }, async (req, reply) => {
    if (!(await findScoped(req, req.params.id))) return reply.code(404).send({ error: "Not found" });
    return db.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        contact: { include: { leads: { orderBy: { createdAt: "desc" }, take: 1 } } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { toolCalls: { select: { tool: true, status: true, input: true, output: true } } },
        },
      },
    });
  });

  // Take over (AI stops replying) or hand back to the AI.
  app.post<{ Params: { id: string } }>(
    "/conversations/:id/ai",
    { preHandler: app.requireRole("ADMIN", "AGENT") },
    async (req, reply) => {
      const body = z.object({ enabled: z.boolean() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
      const before = await findScoped(req, req.params.id);
      if (!before) return reply.code(404).send({ error: "Not found" });
      const after = await db.conversation.update({ where: { id: before.id }, data: { aiEnabled: body.data.enabled } });
      await db.auditLog.create({
        data: {
          userId: req.user.id,
          action: body.data.enabled ? "conversation.release" : "conversation.takeover",
          entity: "Conversation",
          entityId: before.id,
          before: { aiEnabled: before.aiEnabled },
          after: { aiEnabled: after.aiEnabled },
        },
      });
      return after;
    },
  );

  // A team member replies in the chat. Replying also takes over from the AI.
  app.post<{ Params: { id: string } }>(
    "/conversations/:id/messages",
    { preHandler: app.requireRole("ADMIN", "AGENT") },
    async (req, reply) => {
      const body = z.object({ content: z.string().trim().min(1).max(2000) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
      const conversation = await findScoped(req, req.params.id);
      if (!conversation) return reply.code(404).send({ error: "Not found" });
      const [message] = await db.$transaction([
        db.message.create({ data: { conversationId: conversation.id, role: "human_agent", content: body.data.content } }),
        db.conversation.update({ where: { id: conversation.id }, data: { aiEnabled: false, lastMessageAt: new Date() } }),
      ]);
      return reply.code(201).send(message);
    },
  );
};
