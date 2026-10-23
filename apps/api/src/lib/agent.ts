import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { TurnResult, type Channel } from "@leadpilot/shared";
import { db } from "./db.js";
import { openai, CHAT_MODEL } from "./openai.js";
import { searchKb } from "./kb.js";
import { scoreLead } from "./scoring.js";

const BUSINESS_NAME = "Brightwave Digital";

const SYSTEM_PROMPT = `You are the friendly sales assistant for ${BUSINESS_NAME}, a digital agency.

Goals, in order:
1. Answer the customer's question using ONLY the "Business information" provided. If the answer is not there, say you'll check with the team — never invent prices, services or promises.
2. Naturally learn: their name, email or phone, what they need, budget, and timeline. Ask for at most ONE missing detail per reply, and only when it fits the conversation.
3. Keep replies short (1–3 sentences), warm and professional. No markdown.

Rules:
- Never offer discounts, refunds or custom deals; say pricing options are discussed with the team on the discovery call, then keep helping.
- Set handoffToHuman=true ONLY if they explicitly ask for a human, are upset or complaining, or have a support problem you cannot help with. Questions about discounts or unknown details are NOT a reason to hand off.
- In "extracted", fill only details the customer has actually stated anywhere in the conversation; use null otherwise.
- confidence is 0–1: how sure you are about the intent.`;

export type InboundMessage = {
  channel: Channel;
  externalUserId: string;
  externalThreadId: string;
  text: string;
  name?: string;
};

export type AgentResult = {
  reply: string | null; // null when a human has taken over
  conversationId: string;
  leadId: string;
  turn?: TurnResult;
  score?: ReturnType<typeof scoreLead>;
};

/** Find the contact/conversation/lead for this sender, creating them on first contact. */
async function resolveThread(msg: InboundMessage) {
  let contact = await db.contact.findFirst({
    where: { channelIds: { path: [msg.channel], equals: msg.externalUserId } },
  });
  if (!contact) {
    contact = await db.contact.create({
      data: { name: msg.name, channelIds: { [msg.channel]: msg.externalUserId } },
    });
  }

  const conversation = await db.conversation.upsert({
    where: { channel_externalThreadId: { channel: msg.channel, externalThreadId: msg.externalThreadId } },
    update: { lastMessageAt: new Date() },
    create: { contactId: contact.id, channel: msg.channel, externalThreadId: msg.externalThreadId },
  });

  const lead =
    (await db.lead.findFirst({
      where: { contactId: contact.id, status: { notIn: ["WON", "LOST"] } },
      orderBy: { createdAt: "desc" },
    })) ?? (await db.lead.create({ data: { contactId: contact.id, source: msg.channel } }));

  return { contact, conversation, lead };
}

export async function handleInbound(msg: InboundMessage): Promise<AgentResult> {
  const { contact, conversation, lead } = await resolveThread(msg);

  await db.message.create({ data: { conversationId: conversation.id, role: "user", content: msg.text } });

  // A human agent has taken over this chat: store the message, but the AI stays quiet.
  if (!conversation.aiEnabled) {
    return { reply: null, conversationId: conversation.id, leadId: lead.id };
  }

  const [history, kbHits] = await Promise.all([
    db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    searchKb(msg.text),
  ]);

  const knowledge = kbHits.length
    ? kbHits.map((h, i) => `[${i + 1}] ${h.content}`).join("\n\n")
    : "(no relevant business information found)";

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Business information:\n${knowledge}` },
    ...history.reverse().map((m): ChatCompletionMessageParam =>
      m.role === "user" ? { role: "user", content: m.content } : { role: "assistant", content: m.content },
    ),
  ];

  const completion = await openai.beta.chat.completions.parse({
    model: CHAT_MODEL,
    messages,
    temperature: 0.4,
    response_format: zodResponseFormat(TurnResult, "turn_result"),
  });

  const turn = completion.choices[0]?.message.parsed;
  if (!turn) throw new Error("Model returned no structured output");

  // Merge newly extracted facts into what we already know (never overwrite with null).
  const known = (lead.fields ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...known };
  for (const [k, v] of Object.entries(turn.extracted)) if (v && v.trim()) merged[k] = v.trim();
  merged.intent = turn.intent;

  const score = scoreLead({ intent: turn.intent, extracted: merged as Partial<TurnResult["extracted"]> });

  await db.$transaction([
    db.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: turn.reply,
        meta: { ...turn, kbChunkIds: kbHits.map((h) => h.id), scoreReasons: score.reasons },
        tokensIn: completion.usage?.prompt_tokens,
        tokensOut: completion.usage?.completion_tokens,
      },
    }),
    db.lead.update({
      where: { id: lead.id },
      data: {
        fields: merged as object,
        score: score.score,
        tier: score.tier,
        status: score.tier === "HOT" && lead.status === "NEW" ? "QUALIFIED" : lead.status,
      },
    }),
    db.contact.update({
      where: { id: contact.id },
      data: {
        // || (not ??) so an empty string from the model never overwrites or blocks a real value
        name: contact.name || turn.extracted.name || undefined,
        email: turn.extracted.email || contact.email || undefined,
        phone: turn.extracted.phone || contact.phone || undefined,
      },
    }),
    // Hand-off pauses the AI so a person can reply from the dashboard.
    ...(turn.handoffToHuman
      ? [db.conversation.update({ where: { id: conversation.id }, data: { aiEnabled: false } })]
      : []),
  ]);

  return { reply: turn.reply, conversationId: conversation.id, leadId: lead.id, turn, score };
}
