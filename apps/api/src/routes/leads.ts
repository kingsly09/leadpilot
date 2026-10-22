import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";

const ListQuery = z.object({
  tier: z.enum(["HOT", "WARM", "COLD"]).optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "MEETING_BOOKED", "WON", "LOST"]).optional(),
  take: z.coerce.number().min(1).max(100).default(50),
});

const UpdateBody = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "MEETING_BOOKED", "WON", "LOST"]).optional(),
  assignedToId: z.string().nullable().optional(),
});

export const leadRoutes: FastifyPluginAsync = async (app) => {
  app.get("/leads", { preHandler: app.authenticate }, async (req, reply) => {
    const q = ListQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() });

    // Agents only see leads assigned to them; admins/viewers see all.
    const scope = req.user.role === "AGENT" ? { assignedToId: req.user.id } : {};

    return db.lead.findMany({
      where: { ...scope, tier: q.data.tier, status: q.data.status },
      include: { contact: true, assignedTo: { select: { id: true, name: true } } },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: q.data.take,
    });
  });

  app.get<{ Params: { id: string } }>("/leads/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const lead = await db.lead.findUnique({
      where: { id: req.params.id },
      include: { contact: { include: { conversations: { include: { messages: true } } } } },
    });
    if (!lead) return reply.code(404).send({ error: "Not found" });
    if (req.user.role === "AGENT" && lead.assignedToId !== req.user.id) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    return lead;
  });

  app.patch<{ Params: { id: string } }>(
    "/leads/:id",
    { preHandler: app.requireRole("ADMIN", "AGENT") },
    async (req, reply) => {
      const body = UpdateBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      const before = await db.lead.findUnique({ where: { id: req.params.id } });
      if (!before) return reply.code(404).send({ error: "Not found" });
      if (req.user.role === "AGENT" && before.assignedToId !== req.user.id) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const after = await db.lead.update({ where: { id: before.id }, data: body.data });
      await db.auditLog.create({
        data: { userId: req.user.id, action: "lead.update", entity: "Lead", entityId: after.id, before, after },
      });
      return after;
    },
  );
};
