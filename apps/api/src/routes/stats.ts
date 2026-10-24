import type { FastifyPluginAsync } from "fastify";
import { db } from "../lib/db.js";

const DAYS = 14;

/** Numbers for the dashboard overview page, in one request. */
export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stats", { preHandler: app.authenticate }, async () => {
    const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

    const [byTier, byStatus, bySource, perDay, pendingApprovals, failedRuns, handedOff, byRole, tokens] =
      await Promise.all([
        db.lead.groupBy({ by: ["tier"], _count: true }),
        db.lead.groupBy({ by: ["status"], _count: true }),
        db.lead.groupBy({ by: ["source"], _count: true }),
        db.$queryRaw<Array<{ day: Date; tier: string; count: bigint }>>`
          SELECT date_trunc('day', "createdAt") AS day, tier::text AS tier, COUNT(*) AS count
          FROM "Lead" WHERE "createdAt" >= ${since}
          GROUP BY 1, 2 ORDER BY 1`,
        db.pendingAction.count({ where: { status: "PENDING" } }),
        db.workflowRun.count({ where: { status: "FAILED", startedAt: { gte: since } } }),
        db.conversation.count({ where: { aiEnabled: false } }),
        db.message.groupBy({ by: ["role"], _count: true }),
        db.message.aggregate({ _sum: { tokensIn: true, tokensOut: true } }),
      ]);

    const count = <K extends string>(rows: Array<Record<K, string> & { _count: number }>, key: K) =>
      Object.fromEntries(rows.map((r) => [r[key], r._count])) as Record<string, number>;

    // One row per day (including empty days) so the chart has no gaps.
    const days: Array<{ day: string; HOT: number; WARM: number; COLD: number }> = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push({ day: d.toISOString().slice(0, 10), HOT: 0, WARM: 0, COLD: 0 });
    }
    for (const row of perDay) {
      const slot = days.find((d) => d.day === row.day.toISOString().slice(0, 10));
      if (slot) slot[row.tier as "HOT" | "WARM" | "COLD"] = Number(row.count);
    }

    const tier = count(byTier, "tier");
    const status = count(byStatus, "status");
    const total = Object.values(tier).reduce((a, b) => a + b, 0);
    const booked = (status.MEETING_BOOKED ?? 0) + (status.WON ?? 0);

    return {
      totals: {
        leads: total,
        hot: tier.HOT ?? 0,
        warm: tier.WARM ?? 0,
        cold: tier.COLD ?? 0,
        meetingsBooked: booked,
        bookingRate: total ? booked / total : 0,
        pendingApprovals,
        failedRuns,
        handedOff,
      },
      byStatus: status,
      bySource: count(bySource, "source"),
      perDay: days,
      messages: count(byRole, "role"),
      tokens: { in: tokens._sum.tokensIn ?? 0, out: tokens._sum.tokensOut ?? 0 },
    };
  });
};
