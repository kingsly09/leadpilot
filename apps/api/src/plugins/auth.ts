import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@leadpilot/shared";
import { env } from "../env.js";

export type AuthUser = { id: string; email: string; role: Role };

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: "8h" } });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // RBAC is enforced on the API, not just hidden in the UI.
  app.decorate("requireRole", (...roles: Role[]) => async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  });
});
