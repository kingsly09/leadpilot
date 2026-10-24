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
| `apps/api` | Fastify API, Prisma schema, auth/RBAC, routes, AI agent |
| `apps/api/src/tools` | Tool registry shared by the chatbot and the MCP server |
| `apps/api/src/mcp` | MCP server (stdio) for team members' AI assistants |
| `apps/dashboard` | React + Vite + Tailwind dashboard (TanStack Query, Recharts) |
| `apps/widget` | Embeddable chat widget (plain JS, served by the API) |
| `packages/shared` | Shared Zod schemas: `InboundEvent`, `TurnResult`, roles |
| `n8n/` | Exported n8n workflow (secrets removed) |

## Getting started

1. **Database** – either `docker compose up -d` (Postgres+pgvector, Redis, n8n) or create a free
   Supabase project and copy its connection string.
2. `npm install`
3. `cp apps/api/.env.example apps/api/.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
4. `npm run db:migrate` (creates tables), `npm run db:seed` (demo users + sample leads),
   then `npm run db:seed-kb` (sample business knowledge base; needs `OPENAI_API_KEY`).
5. `npm run dev:api` → http://localhost:4000/health, and `npm run dev:dashboard` → http://localhost:5173/app/
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
| GET | `/stats` | logged in — overview numbers and 14-day chart data |
| GET | `/conversations?handedOff=` | logged in (agents: own leads) |
| GET | `/conversations/:id` | messages with AI intent and tool calls |
| POST | `/conversations/:id/ai` | admin, agent — `{ enabled }` take over / hand back |
| POST | `/conversations/:id/messages` | admin, agent — team reply (pauses the AI) |
| GET | `/users` | admin, agent — team list for assignment |
| GET | `/workflow-runs?status=` | logged in |
| POST | `/workflow-runs/:id/retry` | admin |
| GET | `/approvals?status=` | logged in |
| POST | `/approvals/:id/approve` | admin, agent — body `{ edits? }`; runs the action once |
| POST | `/approvals/:id/reject` | admin, agent |

## How a chat turn works

1. Widget sends `{sessionId, message}` to `/chat`.
2. `lib/agent.ts` finds or creates the Contact, Conversation and Lead, and stores the message.
3. If a human has taken over (`aiEnabled = false`) the AI stays silent.
4. RAG: the message is embedded and the closest `KbChunk`s are fetched with pgvector.
5. OpenAI (`gpt-4o-mini`) returns a **structured** `TurnResult` (reply, intent, extracted facts, hand-off flag).
6. Facts are merged into the lead, `scoreLead()` re-scores it, and everything is saved in one transaction.

## Tools, approvals and MCP

All AI actions live in `src/tools/registry.ts`, each with a **risk level**:

| Tool | Used by | Risk |
|---|---|---|
| `search_knowledge_base` | MCP | read |
| `list_leads`, `get_lead` | MCP | read |
| `update_lead_status` | MCP | write (admin/agent, audit-logged) |
| `request_meeting` | chatbot | **approval** → `book_meeting` |
| `send_email` | MCP | **approval** |

"Approval" tools never act directly: they create a `PendingAction`. A human approves (optionally editing
the payload) and only then does `src/lib/actions.ts` run it. Approval is claimed atomically, so an action
can't run twice. Every chatbot tool call is stored in `ToolCall`; every human decision in `AuditLog`.

Emails go through Resend when `RESEND_API_KEY` is set, otherwise to a dev outbox (logged, not sent).

### Using the MCP server

`npm run mcp:smoke -w @leadpilot/api` starts the server and exercises its tools.
The server acts as `MCP_USER_EMAIL`, so that user's role applies (viewer = read-only, agent = own leads).
To use it from Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "leadpilot": {
      "command": "node",
      "args": [
        "C:/path/to/leadpilot/node_modules/tsx/dist/cli.mjs",
        "--env-file=C:/path/to/leadpilot/apps/api/.env",
        "C:/path/to/leadpilot/apps/api/src/mcp/server.ts"
      ]
    }
  }
}
```

## Dashboard

| Page | What it does |
|---|---|
| Overview | KPI tiles, new leads per day by tier, pipeline by status, leads by channel |
| Leads | Search and filter; detail panel to change status, assign an owner, read the chat |
| Inbox | All conversations; take over from the AI, reply as a human, hand back |
| Approvals | Edit, approve or reject AI actions (meetings, emails); decision history |
| Automations | n8n delivery log with errors and a Retry button (admin) |
| Knowledge base | Add/delete business documents and test what the AI would retrieve |

Roles are enforced by the API: viewers are read-only, agents only see their own leads and chats.
The website widget polls its history every 5 seconds, so team replies from the Inbox reach the visitor.
Set `VITE_DEMO_PASSWORD` in `apps/dashboard/.env` to show one-click demo logins on the sign-in page.

## Automations (n8n)

LeadPilot emits business events; n8n decides what to do with them, so automations change without code changes.

| Event | When |
|---|---|
| `lead.created` | first message from a new person |
| `lead.hot` | a lead's tier changes to HOT |
| `handoff.requested` | the AI hands a conversation to a human |
| `meeting.booked` | a human approves a `book_meeting` action |

`src/lib/events.ts` stores each event as a `WorkflowRun`, POSTs it to `N8N_WEBHOOK_URL` with an
`x-leadpilot-secret` header, retries network errors / 5xx with backoff (3 attempts, 4xx not retried) and
records SUCCESS or FAILED with the error. Delivery happens in the background, so a broken automation never
breaks a customer chat. `GET /workflow-runs` lists them and `POST /workflow-runs/:id/retry` (admin) re-sends a failed one.

The **LeadPilot — Sales Alerts** n8n workflow verifies the secret, builds an alert for `lead.hot`,
`handoff.requested` and `meeting.booked`, emails (Gmail) and messages (Telegram) the sales team with
per-node retries, and answers LeadPilot with what was delivered. Other events are acknowledged and ignored.

## Deployment (Railway)

One service runs everything from the root `Dockerfile`: the API, the chat widget (`/widget/`) and the
built dashboard (`/app/`, served by the API so it is same-origin). `/` redirects to `/app/`.

Service variables:

| Variable | Value |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Supabase pooler URLs (see `apps/api/.env.example`) |
| `JWT_SECRET` | long random string |
| `OPENAI_API_KEY` | OpenAI key (set a spend limit on its project) |
| `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` | production webhook of the n8n workflow in `n8n/` |
| `CORS_ORIGIN` | the service's own public URL |
| `MCP_USER_EMAIL` | optional, only for running the MCP server |
| `VITE_DEMO_PASSWORD` | optional, shows one-click demo logins on the sign-in page |

Health check path: `/health`. The `/chat` endpoints accept any origin (the widget is embedded on other sites);
every other endpoint only accepts `CORS_ORIGIN`.

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
- [ ] Step 3 – Channels: Messenger, Instagram, Lead Ads, LinkedIn mock, queue (waiting on a Facebook Page)
- [x] Step 4 – MCP server + approval flow
- [x] Step 5 – n8n workflows
- [x] Step 6 – Dashboard
- [ ] Step 7 – Deploy, demo video
