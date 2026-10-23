/**
 * LeadPilot chat widget. Embed on any site with:
 *   <script src="https://YOUR-API/widget/widget.js" data-title="Chat with us" defer></script>
 * The API address is taken from the script's own URL.
 */
(function () {
  const script = document.currentScript;
  const API = new URL(script.src).origin;
  const TITLE = script.dataset.title || "Chat with us";
  const COLOR = script.dataset.color || "#2563eb";
  const GREETING = script.dataset.greeting || "Hi! 👋 How can we help you today?";

  // Visitor id kept in the browser so the conversation survives page reloads.
  let sessionId;
  try {
    sessionId = localStorage.getItem("leadpilot_session");
    if (!sessionId) {
      sessionId = "web-" + crypto.randomUUID();
      localStorage.setItem("leadpilot_session", sessionId);
    }
  } catch {
    sessionId = "web-" + crypto.randomUUID();
  }

  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" }); // isolates our styles from the host page

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .bubble { position: fixed; right: 20px; bottom: 20px; width: 56px; height: 56px; border-radius: 50%;
        background: ${COLOR}; color: #fff; border: 0; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.25);
        font-size: 26px; z-index: 2147483000; }
      .panel { position: fixed; right: 20px; bottom: 88px; width: min(370px, calc(100vw - 32px));
        height: min(540px, calc(100vh - 120px)); background: #fff; color: #111; border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,.25); display: none; flex-direction: column; overflow: hidden;
        z-index: 2147483000; }
      .panel.open { display: flex; }
      header { background: ${COLOR}; color: #fff; padding: 14px 16px; font-weight: 600; display: flex;
        justify-content: space-between; align-items: center; }
      header button { background: none; border: 0; color: #fff; font-size: 20px; cursor: pointer; }
      .log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px;
        background: #f6f7f9; }
      .msg { max-width: 82%; padding: 9px 12px; border-radius: 14px; line-height: 1.4; font-size: 14px;
        white-space: pre-wrap; word-wrap: break-word; }
      .user { align-self: flex-end; background: ${COLOR}; color: #fff; border-bottom-right-radius: 4px; }
      .assistant, .human_agent { align-self: flex-start; background: #fff; border: 1px solid #e3e5e8;
        border-bottom-left-radius: 4px; }
      .note { align-self: center; font-size: 12px; color: #667; }
      form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e3e5e8; background: #fff; }
      input { flex: 1; padding: 10px 12px; border: 1px solid #d0d4da; border-radius: 10px; font-size: 14px; }
      form button { background: ${COLOR}; color: #fff; border: 0; border-radius: 10px; padding: 0 14px;
        cursor: pointer; font-weight: 600; }
      form button:disabled { opacity: .5; cursor: default; }
    </style>
    <button class="bubble" aria-label="Open chat">💬</button>
    <div class="panel" role="dialog" aria-label="${TITLE}">
      <header><span>${TITLE}</span><button class="close" aria-label="Close chat">×</button></header>
      <div class="log" aria-live="polite"></div>
      <form><input placeholder="Type your message…" maxlength="2000" aria-label="Message" />
        <button type="submit">Send</button></form>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const panel = $(".panel"), log = $(".log"), form = $("form"), input = $("input"), send = $("form button");

  function add(role, text) {
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text; // textContent, never innerHTML: messages can't inject HTML
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  let loaded = false;
  async function loadHistory() {
    loaded = true;
    try {
      const res = await fetch(`${API}/chat/${encodeURIComponent(sessionId)}/history`);
      const history = res.ok ? await res.json() : [];
      if (!history.length) add("assistant", GREETING);
      history.forEach((m) => add(m.role, m.content));
    } catch {
      add("assistant", GREETING);
    }
  }

  $(".bubble").onclick = () => {
    panel.classList.toggle("open");
    if (!loaded) loadHistory();
    if (panel.classList.contains("open")) input.focus();
  };
  $(".close").onclick = () => panel.classList.remove("open");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    add("user", text);
    send.disabled = true;
    const typing = add("note", "typing…");
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      typing.remove();
      add("assistant", data.reply || data.error || "Sorry, something went wrong.");
      if (data.handedOff) add("note", "A team member has been notified.");
    } catch {
      typing.remove();
      add("note", "Connection problem — please try again.");
    } finally {
      send.disabled = false;
      input.focus();
    }
  };
})();
