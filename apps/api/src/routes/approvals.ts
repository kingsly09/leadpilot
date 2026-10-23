import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../lib/db.js";
import { executeAction } from "../lib/actions.js";

const ListQuery = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXECUTED", "FAILED"]).optional(),
});

// A reviewer may tweak the payload before approving (e.g. fix an email's wording or set a time).
const ApproveBody = z.object({ edits: z.record(z.unknown()).optional() }).optional();

export const approvalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/approvals", { preHandler: app.authenticate }, async (req, reply) => {
    const q = ListQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() });
    return db.pendingAction.findMany({
      where: { status: q.data.status },
      include: { approvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  app.post<{ Params: { id: string } }>(
    "/approvals/:id/approve",
    { preHandler: app.requireRole("ADMIN", "AGENT") },
    async (req, reply) => {
      const body = ApproveBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      // Claim it atomically: only one reviewer can move PENDING -> APPROVED, so nothing runs twice.
      const claimed = await db.pendingAction.updateMany({
        where: { id: req.params.id, status: "PENDING" },
        data: { status: "APPROVED", approvedById: req.user.id, decidedAt: new Date() },
      });
      if (claimed.count === 0) return reply.code(409).send({ error: "Not pending (already decided or not found)" });

      const action = await db.pendingAction.findUniqueOrThrow({ where: { id: req.params.id } });
      const payload = { ...(action.payload as object), ...(body.data?.edits ?? {}) } as Prisma.InputJsonObject;

      try {
        const result = await executeAction(action.tool, payload);
        const done = await db.pendingAction.update({
          where: { id: action.id },
          data: { status: "EXECUTED", payload, result: result as object },
        });
        await db.auditLog.create({
          data: {
            userId: req.user.id, action: "approval.approve", entity: "PendingAction",
            entityId: action.id, before: action.payload as object, after: payload,
          },
        });
        return done;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const failed = await db.pendingAction.update({
          where: { id: action.id },
          data: { status: "FAILED", payload, result: { error: message } },
        });
        return reply.code(502).send(failed);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/approvals/:id/reject",
    { preHandler: app.requireRole("ADMIN", "AGENT") },
    async (req, reply) => {
      const claimed = await db.pendingAction.updateMany({
        where: { id: req.params.id, status: "PENDING" },
        data: { status: "REJECTED", approvedById: req.user.id, decidedAt: new Date() },
      });
      if (claimed.count === 0) return reply.code(409).send({ error: "Not pending (already decided or not found)" });
      await db.auditLog.create({
        data: { userId: req.user.id, action: "approval.reject", entity: "PendingAction", entityId: req.params.id },
      });
      return db.pendingAction.findUnique({ where: { id: req.params.id } });
    },
  );
};
