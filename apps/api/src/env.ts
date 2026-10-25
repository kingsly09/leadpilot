import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  OPENAI_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("LeadPilot <onboarding@resend.dev>"),
  /** Which LeadPilot user the MCP server acts as; that user's role limits what MCP tools may do. */
  MCP_USER_EMAIL: z.string().email().optional(),
  /** n8n webhook that receives LeadPilot events; leave empty to disable automations. */
  N8N_WEBHOOK_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  N8N_WEBHOOK_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Public portfolio demo: one-click logins, protected knowledge base, nightly data reset. */
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Shared password of the demo accounts; shown on the sign-in page only when DEMO_MODE=true. */
  DEMO_PASSWORD: z.string().default("LeadPilot-demo-2026"),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
