import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { leadRoutes } from "./routes/leads.js";
import { chatRoutes } from "./routes/chat.js";
import { kbRoutes } from "./routes/kb.js";
import { approvalRoutes } from "./routes/approvals.js";
import { workflowRunRoutes } from "./routes/workflow-runs.js";
import { statsRoutes } from "./routes/stats.js";
import { conversationRoutes } from "./routes/conversations.js";
import { userRoutes } from "./routes/users.js";

const WIDGET_DIR = fileURLToPath(new URL("../../widget/public", import.meta.url));
const DASHBOARD_DIR = fileURLToPath(new URL("../../dashboard/dist", import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : true,
    trustProxy: true, // behind Railway's proxy: rate limits use the real client IP
  });

  // The chat widget is embedded on other people's websites, so /chat accepts any origin.
  // Everything else (the dashboard API) only accepts the configured origins.
  const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim());
  await app.register(cors, {
    delegator: (req, cb) => cb(null, { origin: req.url?.startsWith("/chat") ? true : allowed }),
  });
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin);

  // Embeddable chat widget and its demo page: /widget/widget.js, /widget/demo.html
  await app.register(fastifyStatic, { root: WIDGET_DIR, prefix: "/widget/" });

  // In production the built dashboard is served from the same server at /app.
  if (existsSync(DASHBOARD_DIR)) {
    await app.register(fastifyStatic, { root: DASHBOARD_DIR, prefix: "/app/", decorateReply: false });
    app.get("/", (_req, reply) => reply.redirect("/app/"));
    app.get("/app", (_req, reply) => reply.redirect("/app/"));
    // Client-side routes (/app/leads, /app/inbox, ...) all load the single-page app.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && req.url.startsWith("/app/")) return reply.sendFile("index.html", DASHBOARD_DIR);
      return reply.code(404).send({ error: "Not found" });
    });
  }

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(leadRoutes);
  await app.register(chatRoutes);
  await app.register(kbRoutes);
  await app.register(approvalRoutes);
  await app.register(workflowRunRoutes);
  await app.register(statsRoutes);
  await app.register(conversationRoutes);
  await app.register(userRoutes);

  return app;
}
