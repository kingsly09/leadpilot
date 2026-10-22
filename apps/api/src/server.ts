import { env } from "./env.js";
import { buildApp } from "./app.js";
import { db } from "./lib/db.js";

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
