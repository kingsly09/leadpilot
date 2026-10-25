# LeadPilot: demo video script (about 3 minutes)

Record with **Loom** (free, 5-minute limit) or **OBS**. Speak calmly, like explaining to a business owner.
The text after **SAY** is your voice-over; **SHOW** is what's on screen.

Live links:
- Chat demo: https://leadpilotapi-production-24e7.up.railway.app/widget/demo.html
- Dashboard: https://leadpilotapi-production-24e7.up.railway.app/app/

---

## Before you record (5 minutes)

1. Open the dashboard → sign in with the **Admin** demo button → click **Reset demo** in the banner.
2. Open these browser tabs, in this order:
   1. Chat demo page, in a **private/incognito window**, so the chat starts fresh
   2. Dashboard → **Overview**
   3. https://github.com/kingsly09/leadpilot
3. Have **Telegram open on your phone** (or Telegram Desktop on screen) for the alert.
4. Turn off other notifications. Zoom the browser to **110%** so text is readable.
5. Type these messages into a notepad so you can paste them smoothly:
   - `Hi, how much does an online store cost?`
   - `I'm Kemi. I sell skincare products, my budget is about $4,000 and I want to launch this month.`
   - `Great, can we book a call on Thursday afternoon? My email is kemi@example.com`

---

## Scene 1: The problem (0:00–0:15)
**SHOW:** the chat demo page (Brightwave Digital website).

**SAY:**
> "Most small businesses lose leads because nobody replies fast enough, especially at night and on weekends. I built **LeadPilot**: an AI sales assistant that answers customers 24/7, qualifies them, and alerts the team the moment someone is ready to buy."

## Scene 2: A customer chats (0:15–0:50)
**SHOW:** click the 💬 bubble → paste the three messages one by one, waiting for each reply.

**SAY (while the AI replies):**
> "This is a sample agency website with my chat widget, which is one line of code on any site. The AI answers **only from the business's own information**: here it quotes the real e-commerce price.
> It naturally collects the name, need, budget and timeline, one question at a time.
> When Kemi asks for a call, the AI **doesn't pretend to book it**. It requests the meeting and tells her a team member will confirm."

## Scene 3: The instant alert (0:50–1:00)
**SHOW:** your phone or Telegram: the **🔥 New HOT lead: Kemi** message (and the email, if visible).

**SAY:**
> "Because Kemi gave a budget, a short timeline and her email, she scored as a **HOT** lead, and the sales team instantly got a Telegram and email alert. These alerts run through **n8n**, so the business can change who gets notified without touching code."

## Scene 4: The dashboard (1:00–1:25)
**SHOW:** dashboard **Overview** (point at the tiles and the chart) → **Leads** → click **Kemi** at the top.

**SAY:**
> "Here's the team's dashboard. At a glance: new leads, hot leads, meetings, and anything waiting for a decision.
> In Leads, Kemi is already at the top. The AI extracted everything from the chat: need, budget, timeline. The **score comes from clear business rules**, not a guess, so the business can always see *why* a lead is hot. I can assign her to a salesperson right here."

## Scene 5: Human approval (1:25–1:50)
**SHOW:** **Approvals** → Kemi's card → change the time to `Thursday 2:00pm` → **Approve & send confirmation** → switch to the chat tab to show the confirmation message.

**SAY:**
> "Risky actions, like booking meetings or sending emails, **always wait for a human**. I can adjust the time, approve with one click, and the customer gets a confirmation straight in her chat. The lead moves to *Meeting booked*, and every decision is recorded in an audit log."

## Scene 6: When a customer needs a person (1:50–2:10)
**SHOW:** **Inbox** → click **Chidi Okeke** (marked *Needs human*) → type a short reply → **Send**.

**SAY:**
> "If a customer is upset or asks for a person, the AI **hands over** and pauses itself. Chidi's chat is flagged here; I can reply as a human, and hand it back to the AI later."

## Scene 7: Knowledge and reliability (2:10–2:30)
**SHOW:** **Knowledge base** → *Test a question*: `Do you offer support after launch?` → **Automations** page (point at the green successes and the one failed alert) → click **Retry**.

**SAY:**
> "The AI's knowledge comes from the business's documents, searched by meaning, not keywords. That's RAG, built on Supabase and pgvector.
> And every automation is logged. If an alert fails, for example because an email account was disconnected, you see the reason and can retry with one click."

## Scene 8: Under the hood (2:30–2:50)
**SHOW:** the GitHub README: scroll slowly over the architecture diagram and the tables.

**SAY:**
> "Under the hood: a Node.js and TypeScript API, OpenAI with structured outputs and tool calling, an MCP server so AI assistants can work with the data safely, n8n for automations, and a React dashboard with role-based access. It's deployed on Railway with Supabase."

## Scene 9: Close (2:50–3:00)
**SHOW:** back to the Overview page.

**SAY:**
> "LeadPilot answers every lead in seconds, keeps humans in control, and plugs into the tools a business already uses. If you'd like this for your business, let's talk. Links are in the description."

---

## Video description (paste under the video)

> **LeadPilot**: AI lead generation & automation platform.
> AI chatbot (OpenAI, RAG, tool calling) · lead scoring · human approvals · n8n alerts (Gmail + Telegram) · MCP server · React dashboard.
> Live demo: https://leadpilotapi-production-24e7.up.railway.app/app/ (click "Admin" to sign in)
> Code: https://github.com/kingsly09/leadpilot

## Tips

- **Do one practice run** without recording. Then click **Reset demo** and record for real.
- If the AI words a reply differently, that's fine. It's live, not scripted.
- Keep the mouse still while talking; move it only to click.
- Short version for Upwork/LinkedIn (60–90 s): Scenes 2 → 3 → 5 → 9.
