// Plays the LeadPilot demo on the live site and records one video clip per scene.
// Each scene's actions are paced to fit that scene's voice-over (out/durations.json).
// Output: out/raw/scene-N.webm + out/clips.json (clip paths and how much of the start to skip).
import { chromium } from "playwright";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";

const BASE = "https://leadpilotapi-production-24e7.up.railway.app";
const REPO = "https://github.com/kingsly09/leadpilot";
const DUR = JSON.parse(await readFile("out/durations.json", "utf8"));
const VIEW = { width: 1280, height: 720 }; // enlarged 1.5x to 1920x1080 when editing, so text reads well
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEMI = [
  "Hi, how much does an online store cost?",
  "I'm Kemi. I sell skincare products, my budget is about $4,000 and I want to launch this month.",
  "Great, can we book a call on Thursday afternoon? My email is kemi@example.com",
];

// A visible mouse pointer and click ripple (headless recordings have no cursor).
const CURSOR = () => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px)";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.5L16 20l-3 1.5-3.4-7.3L4 19z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => (c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`), true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #2a78d6;z-index:2147483646;pointer-events:none;transition:all .45s ease-out;opacity:.9`;
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.8)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 500);
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install); else install();
};

const browser = await chromium.launch({ headless: true });
let mouse = { x: 640, y: 360 };

async function glide(page, x, y, steps = 28) {
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
}
async function point(page, locator, { click = true, pause = 250 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error("element not visible");
  await glide(page, b.x + b.width / 2, b.y + b.height / 2);
  await sleep(pause);
  if (click) await page.mouse.click(mouse.x, mouse.y);
}
async function typeInto(page, locator, text, delay = 32) {
  await point(page, locator);
  await page.keyboard.type(text, { delay });
}
async function api(path, token, init = {}) {
  const res = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }), ...init.headers } });
  return res.json();
}

/* ---------- setup: fresh demo data + an admin session (not recorded) ---------- */
const login = await api("/auth/login", null, { method: "POST", body: JSON.stringify({ email: "admin@leadpilot.test", password: "LeadPilot-demo-2026" }) });
const TOKEN = login.token;
console.log("reset:", JSON.stringify(await api("/demo/reset", TOKEN, { method: "POST", body: "{}" })));

const setupCtx = await browser.newContext({ viewport: VIEW });
const setupPage = await setupCtx.newPage();
await setupPage.goto(`${BASE}/app/login`);
await setupPage.evaluate((t) => localStorage.setItem("leadpilot_token", t), TOKEN);
let state = await setupCtx.storageState();
await setupCtx.close();

/* ---------- scenes ---------- */
const scenes = {
  1: { url: "/widget/demo.html", async act(page) {
    await glide(page, 640, 260, 40); await sleep(3500);
    await page.mouse.wheel(0, 220); await sleep(3000);
    await page.mouse.wheel(0, -220); await sleep(2500);
    await point(page, page.locator("button.bubble"), { click: false });
  } },

  2: { url: "/widget/demo.html", async act(page) {
    await point(page, page.locator("button.bubble"));
    const input = page.locator('input[placeholder="Type your message…"]');
    await input.waitFor();
    await sleep(1200);
    // The widget re-renders from history every 5s, so wait on its own "busy" state, not message counts.
    const idle = () => page.waitForFunction(() => {
      const root = [...document.querySelectorAll("div")].map((d) => d.shadowRoot).find((r) => r?.querySelector(".panel"));
      if (!root) return false;
      const busy = root.querySelector("form button")?.disabled;
      const typing = [...root.querySelectorAll(".msg.note")].some((n) => n.textContent.includes("typing"));
      return !busy && !typing;
    }, null, { timeout: 60_000 });
    for (const text of KEMI) {
      await typeInto(page, input, text, 28);
      await sleep(250);
      await page.keyboard.press("Enter");
      await sleep(600);
      await idle();
      await sleep(1800);
    }
  } },

  3: { url: "/app/automations", async act(page) {
    // Wait until the hot-lead alert for Kemi has been delivered, then show what arrived on the phone.
    for (let i = 0; i < 20; i++) {
      const runs = await api("/workflow-runs?take=5", TOKEN);
      if (runs.some((r) => r.event === "lead.hot" && /kemi/i.test(r.payload?.lead?.name ?? "") && r.status === "SUCCESS")) break;
      await sleep(1500);
    }
    await page.reload(); await page.waitForLoadState("networkidle");
    await sleep(1500);
    await point(page, page.getByText("Hot lead").first(), { click: false });
    await sleep(1500);
    const leads = await api("/leads?tier=HOT&take=5", TOKEN);
    const kemi = leads.find((l) => /kemi/i.test(l.contact?.name ?? "")) ?? leads[0];
    await page.evaluate((l) => {
      const n = document.createElement("div");
      n.style.cssText = "position:fixed;right:28px;top:28px;width:380px;z-index:99999;background:#fff;color:#111;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:14px 16px;font:14px/1.45 system-ui,Segoe UI,sans-serif;transform:translateX(460px);transition:transform .6s cubic-bezier(.2,.9,.3,1)";
      n.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;color:#555;font-size:12px"><span style="display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#2AABEE;color:#fff;font-weight:700">✈</span><b style="color:#111">Telegram</b> · LeadPilot Alerts · now</div>
        <div style="font-weight:700">🔥 New HOT lead</div>
        <div>${l.name} · ${l.email}</div><div>Need: ${l.need}</div><div>Budget: ${l.budget} · Timeline: ${l.timeline}</div><div>Score: HOT (${l.score}) via web</div>`;
      document.body.appendChild(n);
      requestAnimationFrame(() => requestAnimationFrame(() => (n.style.transform = "translateX(0)")));
    }, { name: kemi?.contact?.name ?? "Kemi", email: kemi?.contact?.email ?? "kemi@example.com", need: kemi?.fields?.need ?? "Online store", budget: kemi?.fields?.budget ?? "$4,000", timeline: kemi?.fields?.timeline ?? "this month", score: kemi?.score ?? 85 });
    await sleep(2000);
    await glide(page, 1040, 110, 40);
  } },

  4: { url: "/app/", async act(page) {
    await sleep(1500);
    for (const label of ["Leads", "Hot leads", "Meetings", "To approve"]) {
      await point(page, page.locator("main .card").filter({ hasText: label }).first(), { click: false, pause: 1300 });
    }
    const bars = page.locator(".recharts-bar-rectangle");
    if (await bars.count()) await point(page, bars.last(), { click: false, pause: 2200 });
    await point(page, page.getByRole("link", { name: "Leads" }).first());
    await page.waitForSelector("tbody tr");
    await sleep(2200);
    await point(page, page.locator("tbody tr").filter({ hasText: "Kemi" }).first());
    await page.waitForSelector('aside[aria-label="Lead details"] dl');
    await sleep(1200);
    const panel = page.locator('aside[aria-label="Lead details"]');
    for (const t of ["Need", "Budget", "Timeline"]) await point(page, panel.getByText(t, { exact: true }), { click: false, pause: 1100 });
    await point(page, panel.locator("select").nth(1), { click: false, pause: 1500 });
  } },

  5: { url: "/app/approvals", async act(page) {
    await sleep(1500);
    const card = page.locator(".card").filter({ hasText: "Kemi" }).first();
    const time = card.locator("input.input");
    await point(page, time);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Thursday, 2:00pm WAT", { delay: 45 });
    await sleep(700);
    await point(page, card.getByRole("button", { name: /Approve/ }));
    await sleep(2500);
    await page.goto(`${BASE}/widget/demo.html`);
    await point(page, page.locator("button.bubble"));
    await sleep(1500);
    // Scroll the chat to the confirmation message.
    await page.evaluate(() => { for (const d of document.querySelectorAll("div")) if (d.shadowRoot) { const l = d.shadowRoot.querySelector(".log"); if (l) l.scrollTop = l.scrollHeight; } });
    await glide(page, 1040, 520, 30);
  } },

  6: { url: "/app/inbox?handedOff=true", async act(page) {
    await sleep(1500);
    await point(page, page.locator("button.card").filter({ hasText: "Chidi" }).first());
    await page.waitForSelector('input[placeholder="Reply to the customer…"]');
    await sleep(1800);
    await typeInto(page, page.locator('input[placeholder="Reply to the customer…"]'),
      "Hi Chidi, I'm so sorry about this. I'm looking at your site right now and will update you within 15 minutes.", 24);
    await sleep(400);
    await page.keyboard.press("Enter");
    await sleep(1500);
  } },

  7: { url: "/app/knowledge", async act(page) {
    await sleep(1200);
    await typeInto(page, page.locator('input[placeholder^="e.g. Do you offer support"]'), "Do you offer support after launch?", 40);
    await point(page, page.getByRole("button", { name: "Search" }));
    await page.waitForSelector("text=match", { timeout: 20_000 });
    await sleep(3500);
    await point(page, page.getByRole("link", { name: "Automations" }).first());
    await page.waitForSelector("tbody tr", { timeout: 20_000 });
    await sleep(900);
    const failed = page.locator("tbody tr").filter({ hasText: "Failed" }).first();
    await point(page, failed, { click: false, pause: 1800 });
    await point(page, failed.getByRole("button", { name: "Retry" }));
    await sleep(3000);
  } },

  8: { url: REPO, external: true, async act(page) {
    await sleep(2000);
    for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 160); await sleep(1100); }
  } },

  9: { url: "/app/", async act(page) {
    await sleep(1500);
    await glide(page, 440, 200, 50); await sleep(2500);
    await glide(page, 800, 400, 50); await sleep(2500);
  } },
};

await rm("out/raw", { recursive: true, force: true });
await mkdir("out/raw", { recursive: true });
const clips = {};
const only = process.argv[2] ? process.argv[2].split(",").map(Number) : Object.keys(scenes).map(Number);

for (const n of only) {
  const s = scenes[n];
  const ctx = await browser.newContext({
    viewport: VIEW, colorScheme: "light", storageState: state,
    recordVideo: { dir: "out/raw", size: VIEW }, // upscaled to 1080p in build.mjs
  });
  await ctx.addInitScript(CURSOR);
  const t0 = Date.now();
  const page = await ctx.newPage();
  await page.goto(s.external ? s.url : BASE + s.url);
  await page.waitForLoadState("networkidle").catch(() => {});
  if (!s.external) await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 15_000 }).catch(() => {});
  await sleep(600);
  await page.mouse.move(mouse.x, mouse.y);
  const ready = (Date.now() - t0) / 1000;
  const tAct = Date.now();
  try {
    await s.act(page);
  } catch (err) {
    console.error(`scene ${n} action error:`, err.message);
  }
  const acted = (Date.now() - tAct) / 1000;
  const hold = Math.max(0, DUR[n] + 0.8 - acted);
  await sleep(hold * 1000);
  if (!s.external) state = await ctx.storageState();
  const video = page.video();
  await ctx.close();
  clips[n] = { path: await video.path(), skip: ready, acted: +acted.toFixed(2), voice: DUR[n] };
  console.log(`scene ${n}: actions ${acted.toFixed(1)}s, voice ${DUR[n].toFixed(1)}s`);
}

await writeFile("out/clips.json", JSON.stringify(clips, null, 1));
await browser.close();
