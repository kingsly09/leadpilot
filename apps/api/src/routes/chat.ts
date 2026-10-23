import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";
import { handleInbound } from "../lib/agent.js";

const ChatBody = z.object({
  // Random id the widget keeps in the visitor's browser — identifies the visitor and their thread.
  sessionId: z.string().min(8).max(64).regex(/^[\w-]+$/),
  message: z.string().trim().min(1).max(2000),
  name: z.string().max(100).optional(),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  // Public endpoint used by the website widget. Rate-limited to protect the OpenAI budget.
  app.post(
    "/chat",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = ChatBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      try {
        const result = await handleInbound({
          channel: "web",
          externalUserId: body.data.sessionId,
          externalThreadId: body.data.sessionId,
          text: body.data.message,
          name: body.data.name,
        });
        return {
          reply: result.reply ?? "Thanks! A team member will reply here shortly.",
          handedOff: result.reply === null || result.turn?.handoffToHuman === true,
        };
      } catch (err) {
        req.log.error(err, "chat failed");
        return reply.code(502).send({ error: "The assistant is unavailable right now. Please try again." });
      }
    },
  );

  // Lets the widget restore the conversation after a page reload.
  app.get<{ Params: { sessionId: string } }>("/chat/:sessionId/history", async (req) => {
    const conversation = await db.conversation.findUnique({
      where: { channel_externalThreadId: { channel: "web", externalThreadId: req.params.sessionId } },
      include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
    });
    return conversation?.messages ?? [];
  });
};
