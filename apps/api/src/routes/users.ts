import type { FastifyPluginAsync } from "fastify";
import { db } from "../lib/db.js";

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Team list for the "assign lead" dropdown. Never returns password hashes.
  app.get("/users", { preHandler: app.requireRole("ADMIN", "AGENT") }, async () =>
    db.user.findMany({ select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } }),
  );
};
