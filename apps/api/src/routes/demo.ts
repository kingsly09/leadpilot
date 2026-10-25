import type { FastifyPluginAsync } from "fastify";
import { env } from "../env.js";
import { db } from "../lib/db.js";
import { DEMO_USERS, resetDemoData } from "../lib/demo-data.js";

export const demoRoutes: FastifyPluginAsync = async (app) => {
  // Public: tells the sign-in page whether to show one-click demo logins.
  app.get("/demo/config", async () =>
    env.DEMO_MODE
      ? {
          demoMode: true,
          password: env.DEMO_PASSWORD,
          accounts: DEMO_USERS.map((u) => ({ email: u.email, role: u.role })),
          resetsDaily: true,
        }
      : { demoMode: false },
  );

  // "Reset demo" button for the admin, e.g. right before a client call.
  app.post(
    "/demo/reset",
    { preHandler: app.requireRole("ADMIN"), config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async (_req, reply) => {
      if (!env.DEMO_MODE) return reply.code(404).send({ error: "Not found" });
      return resetDemoData(db, env.DEMO_PASSWORD);
    },
  );
};

/** In demo mode, restore the demo story every night at 03:00 UTC. */
export function scheduleNightlyDemoReset(log: { info: (m: string) => void; error: (e: unknown, m: string) => void }) {
  if (!env.DEMO_MODE) return;
  const scheduleNext = () => {
    const next = new Date();
    next.setUTCHours(3, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
    setTimeout(async () => {
      try {
        await resetDemoData(db, env.DEMO_PASSWORD);
        log.info("Demo data reset");
      } catch (err) {
        log.error(err, "Demo reset failed");
      }
      scheduleNext();
    }, next.getTime() - Date.now()).unref();
  };
  scheduleNext();
}
