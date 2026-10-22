import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { leadRoutes } from "./routes/leads.js";

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : true,
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(leadRoutes);

  return app;
}
