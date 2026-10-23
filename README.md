# LeadPilot

AI-powered lead generation & automation platform: captures leads from social media and web chat,
qualifies them with an LLM + rule-based scoring, automates follow-ups with n8n, and gives the team
a dashboard with human-in-the-loop approvals.

## Architecture

```
Channels (Web widget, Messenger, Instagram, Lead Ads, LinkedIn mock)
   │ webhooks (signature-verified)
   ▼
API (Fastify + TS) ── normalizes to InboundEvent ──► Queue (BullMQ/Redis)
   │                                                    │
   │                                         AI Agent (OpenAI + RAG/pgvector)
   │                                                    │ tools via MCP server
   ▼                                                    ▼
PostgreSQL ◄──────────── events ─────────────► n8n workflows (CRM, Sheets, Slack, email)
   ▲
React dashboard (leads, inbox, approvals, workflow logs, RBAC)
```

## Repo layout

| Path | What |
|---|---|
| `apps/api` | Fastify API, Prisma schema, auth/RBAC, routes |
| `apps/dashboard` | React dashboard (Step 6) |
| `apps/widget` | Embeddable chat widget (plain JS, served by the API) |
| `packages/shared` | Shared Zod schemas: `InboundEvent`, `TurnResult`, roles |
| `packages/mcp-server` | MCP tool server (Step 4) |

## Getting started

1. **Database** – either `docker compose up -d` (Postgres+pgvector, Redis, n8n) or create a free
   Supabase project and copy its connection string.
2. `npm install`
3. `cp apps/api/.env.example apps/api/.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
4. `npm run db:migrate` (creates tables), `npm run db:seed` (demo users + sample leads),
   then `npm run db:seed-kb` (sample business knowledge base; needs `OPENAI_API_KEY`).
5. `npm run dev:api` → http://localhost:4000/health
6. Try the bot: http://localhost:4000/widget/demo.html
7. `npm test` runs the unit tests.

Demo accounts (`admin@`, `agent@`, `viewer@leadpilot.test`) and their password are defined in
`apps/api/prisma/seed.ts`.

## API (so far)

| Method | Path | Access |
|---|---|---|
| GET | `/health` | public |
| POST | `/auth/login` | public |
| GET | `/auth/me` | logged in |
| GET | `/leads?tier=&status=` | admin/viewer: all · agent: assigned only |
| GET | `/leads/:id` | same as above |
| PATCH | `/leads/:id` | admin, agent (own leads); writes audit log |
| POST | `/chat` | public (widget), rate-limited 20/min |
| GET | `/chat/:sessionId/history` | public (widget) |
| GET | `/kb/documents` | logged in |
| POST | `/kb/documents` | admin — chunks + embeds a document |
| DELETE | `/kb/documents/:id` | admin |
| POST | `/kb/search` | logged in — shows what the bot would retrieve |

## How a chat turn works

1. Widget sends `{sessionId, message}` to `/chat`.
2. `lib/agent.ts` finds or creates the Contact, Conversation and Lead, and stores the message.
3. If a human has taken over (`aiEnabled = false`) the AI stays silent.
4. RAG: the message is embedded and the closest `KbChunk`s are fetched with pgvector.
5. OpenAI (`gpt-4o-mini`) returns a **structured** `TurnResult` (reply, intent, extracted facts, hand-off flag).
6. Facts are merged into the lead, `scoreLead()` re-scores it, and everything is saved in one transaction.

## Design decisions

- **LLM extracts, rules score.** The model returns structured facts (`TurnResult`); `lib/scoring.ts`
  turns them into a score/tier. Explainable and tunable without prompt changes.
- **One internal event shape.** Every channel adapter outputs `InboundEvent`; adding a channel = one adapter.
- **RBAC on the API**, not just the UI. Every lead mutation is written to `AuditLog`.
- **Idempotency** via `Lead.externalId` (e.g. Meta `leadgen_id`) so duplicate webhooks don't duplicate leads.
- **Human approval** for risky AI actions via `PendingAction`.

## Roadmap

- [x] Step 1 – Foundation: monorepo, schema, auth/RBAC, leads API, seed
- [x] Step 2 – AI chatbot, RAG, scoring, web widget
- [ ] Step 3 – Channels: Messenger, Instagram, Lead Ads, LinkedIn mock, queue
- [ ] Step 4 – MCP server + approval flow
- [ ] Step 5 – n8n workflows
- [ ] Step 6 – Dashboard
- [ ] Step 7 – Deploy, demo video
