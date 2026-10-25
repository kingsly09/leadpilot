import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";
import { ingestDocument, searchKb } from "../lib/kb.js";
import { env } from "../env.js";

const DEMO_LOCKED = { error: "The knowledge base is read-only in the public demo." };

const DocBody = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(20).max(200_000),
  source: z.string().max(500).optional(),
});

export const kbRoutes: FastifyPluginAsync = async (app) => {
  app.get("/kb/documents", { preHandler: app.authenticate }, async () =>
    db.kbDocument.findMany({ include: { _count: { select: { chunks: true } } }, orderBy: { createdAt: "desc" } }),
  );

  app.post("/kb/documents", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    if (env.DEMO_MODE) return reply.code(403).send(DEMO_LOCKED);
    const body = DocBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const doc = await ingestDocument(body.data.title, body.data.content, body.data.source);
    await db.auditLog.create({
      data: { userId: req.user.id, action: "kb.create", entity: "KbDocument", entityId: doc.id, after: doc },
    });
    return reply.code(201).send(doc);
  });

  app.delete<{ Params: { id: string } }>(
    "/kb/documents/:id",
    { preHandler: app.requireRole("ADMIN") },
    async (req, reply) => {
      if (env.DEMO_MODE) return reply.code(403).send(DEMO_LOCKED);
      const doc = await db.kbDocument.findUnique({ where: { id: req.params.id } });
      if (!doc) return reply.code(404).send({ error: "Not found" });
      await db.kbDocument.delete({ where: { id: doc.id } }); // chunks cascade
      await db.auditLog.create({
        data: { userId: req.user.id, action: "kb.delete", entity: "KbDocument", entityId: doc.id, before: doc },
      });
      return reply.code(204).send();
    },
  );

  // "Test a question" box in the dashboard: shows which chunks the bot would see.
  app.post("/kb/search", { preHandler: app.authenticate }, async (req, reply) => {
    const body = z.object({ query: z.string().min(1).max(500) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return searchKb(body.data.query, 5, 0);
  });
};
