import type { FastifyPluginAsync } from "fastify";
import { db } from "../lib/db.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    let database = "ok";
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      database = "unreachable";
    }
    return { status: "ok", database, time: new Date().toISOString() };
  });
};
