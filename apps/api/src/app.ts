import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { leadRoutes } from "./routes/leads.js";
import { chatRoutes } from "./routes/chat.js";
import { kbRoutes } from "./routes/kb.js";

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : true,
  });

  await app.register(cors, { origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()) });
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin);

  // Serves the embeddable chat widget and its demo page: /widget/widget.js, /widget/demo.html
  await app.register(fastifyStatic, {
    root: fileURLToPath(new URL("../../widget/public", import.meta.url)),
    prefix: "/widget/",
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(leadRoutes);
  await app.register(chatRoutes);
  await app.register(kbRoutes);

  return app;
}
