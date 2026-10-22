import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../lib/db.js";

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (req, reply) => {
    const body = LoginBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid body" });

    const user = await db.user.findUnique({ where: { email: body.data.email } });
    const ok = user && (await bcrypt.compare(body.data.password, user.passwordHash));
    if (!user || !ok) return reply.code(401).send({ error: "Invalid credentials" });

    const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (req) => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true },
    });
    return user;
  });
};
