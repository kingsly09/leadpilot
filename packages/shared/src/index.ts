import { z } from "zod";

export const Channel = z.enum(["web", "facebook", "instagram", "linkedin", "whatsapp", "email"]);
export type Channel = z.infer<typeof Channel>;

/** Every channel adapter converts its raw webhook into this one shape. */
export const InboundEvent = z.object({
  channel: Channel,
  externalUserId: z.string(),
  externalThreadId: z.string().optional(),
  type: z.enum(["message", "lead_form", "comment"]),
  text: z.string().optional(),
  formFields: z.record(z.string()).optional(),
  receivedAt: z.string().datetime(),
  raw: z.unknown(),
});
export type InboundEvent = z.infer<typeof InboundEvent>;

/** Structured output the LLM must return on every turn (used in Step 2). */
export const TurnResult = z.object({
  reply: z.string(),
  intent: z.enum(["question", "pricing", "booking", "support", "not_interested", "spam"]),
  extracted: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    budget: z.string().nullable(),
    timeline: z.string().nullable(),
    need: z.string().nullable(),
  }),
  handoffToHuman: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type TurnResult = z.infer<typeof TurnResult>;

export const Role = z.enum(["ADMIN", "AGENT", "VIEWER"]);
export type Role = z.infer<typeof Role>;
