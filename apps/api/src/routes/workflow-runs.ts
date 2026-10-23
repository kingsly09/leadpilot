import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";
import { deliverRun } from "../lib/events.js";

const ListQuery = z.object({
  status: z.enum(["RUNNING", "SUCCESS", "FAILED"]).optional(),
  take: z.coerce.number().min(1).max(200).default(50),
});

export const workflowRunRoutes: FastifyPluginAsync = async (app) => {
  // Automation log for the dashboard: what was sent to n8n and whether it worked.
  app.get("/workflow-runs", { preHandler: app.authenticate }, async (req, reply) => {
    const q = ListQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() });
    return db.workflowRun.findMany({
      where: { status: q.data.status },
      orderBy: { startedAt: "desc" },
      take: q.data.take,
    });
  });

  // "Retry" button for failed automations.
  app.post<{ Params: { id: string } }>(
    "/workflow-runs/:id/retry",
    { preHandler: app.requireRole("ADMIN") },
    async (req, reply) => {
      const claimed = await db.workflowRun.updateMany({
        where: { id: req.params.id, status: "FAILED" },
        data: { status: "RUNNING", error: null, finishedAt: null },
      });
      if (claimed.count === 0) return reply.code(409).send({ error: "Only failed runs can be retried" });
      return deliverRun(req.params.id);
    },
  );
};
