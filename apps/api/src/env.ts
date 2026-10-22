import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  OPENAI_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
