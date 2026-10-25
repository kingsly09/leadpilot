// Joins each scene clip with its voice-over, burns in subtitles + a scene label, and concatenates
// everything into out/LeadPilot-demo.mp4 (1080p). Run after record.mjs.
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

const clips = JSON.parse(await readFile("out/clips.json", "utf8"));
const transcripts = JSON.parse(await readFile("out/transcripts.json", "utf8"));
const MAX_SPEEDUP = 1.4;
// Scenes where the action happens at the bottom of the screen get their subtitles at the top.
const CAPTION_TOP = new Set([6]);
const VOICE_DELAY = 0.35;

// What was actually said, with the speech-to-text mishearings corrected.
const CAPTIONS = {
  1: "Most businesses lose customers because nobody replies fast enough, especially at night and on weekends. So I built LeadPilot: an AI sales assistant that answers customers' questions 24/7, figures out who is ready to buy, and alerts the team instantly.",
  2: "This is a sample business website with my chat assistant on it. A customer called Kemi asks about prices. The AI answers using only the business's own information, so it quotes the real price instead of making one up. As the chat goes on, it naturally collects her name, what she needs, her budget and her timeline. And when Kemi asks for a call, the AI does not pretend to book it. It requests the meeting, and tells her a team member will confirm.",
  3: "Because Kemi shared a budget, a timeline and her email, she's recorded as a hot lead, and the sales team instantly gets an alert on Telegram and email. This alert runs through n8n, so the business can change who gets notified without even touching any code.",
  4: "This is the team dashboard. At a glance, you can see new leads, hot leads, meetings, and everything waiting for a decision. In the leads list, Kemi is already at the top. The AI has pulled out everything from the conversation: what she needs, her budget, her timeline. Her score comes from clear business rules, not a guess, so you can always see why a lead is hot.",
  5: "Important actions, like booking a meeting or sending an email, always wait for a human. Here, I can adjust the meeting time and approve it with one click. Kemi instantly gets a confirmation in her chat, her lead moves to meeting booked, and the decision is recorded.",
  6: "If a customer is upset or asks for a real person, the AI hands the chat over and pauses itself. This conversation is flagged as needing a human. I can reply myself, and hand it back to the AI whenever I'm ready.",
  7: "The AI's knowledge comes from the business's own documents, and it searches them by meaning, not just by keywords. And every automation is logged. If an alert ever fails, for example because an email account gets disconnected, you can see why and retry it with one click.",
  8: "Under the hood, it's built with Node.js and TypeScript, OpenAI with tool calling, an MCP server so AI assistants can work with the data safely, n8n for the automations, Supabase for the database, and a React dashboard with role-based access, all deployed on Railway.",
  9: "LeadPilot answers every lead in seconds, keeps people in control, and connects to the tools a business already uses. If you'd like something like this for your business, message me and let's talk business.",
};
const LABELS = {
  1: "The problem", 2: "A customer chats with the AI", 3: "Instant hot-lead alert", 4: "Team dashboard",
  5: "Human approval", 6: "Hand-off to a human", 7: "Knowledge base & reliability", 8: "Under the hood", 9: "LeadPilot",
};

const run = (args) => {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr.split("\n").slice(-15).join("\n"));
  return r.stderr;
};
const duration = (file) => {
  const m = spawnSync(ffmpeg, ["-i", file], { encoding: "utf8" }).stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
};
const ts = (s) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, sec = Math.floor(cs / 100) % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};

/** Splits text into caption lines of up to ~9 words, preferring to break after punctuation. */
function chunks(text) {
  const words = text.split(/\s+/);
  const out = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 9 || (cur.length >= 5 && /[.,:;!?]$/.test(w))) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Times each caption line using the real word timings from the original recording. */
function subtitles(n, segDur) {
  const words = transcripts[n].words;
  const lead = Math.max(0, words[0].start - 0.3); // silence trimmed off the start of the voice file
  const lines = chunks(CAPTIONS[n]);
  const total = lines.reduce((a, l) => a + l.length, 0);
  let seen = 0;
  const events = lines.map((l, i) => {
    const wi = Math.min(words.length - 1, Math.floor((seen / total) * words.length));
    seen += l.length;
    return { start: words[wi].start - lead + VOICE_DELAY, text: l.join(" ") };
  });
  const lastEnd = words.at(-1).end - lead + VOICE_DELAY + 0.4;
  const dialog = events.map((e, i) => {
    const end = i + 1 < events.length ? events[i + 1].start : Math.min(lastEnd, segDur - 0.1);
    return `Dialogue: 0,${ts(e.start)},${ts(end)},Caption,,0,0,0,,${e.text}`;
  });
  const label = `Dialogue: 1,${ts(0.2)},${ts(Math.min(4.5, segDur - 0.2))},Label,,0,0,0,,{\\fad(300,400)}${n < 9 ? `${n} · ` : ""}${LABELS[n]}`;
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Segoe UI,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H9A111111,1,0,0,0,100,100,0,0,3,14,0,${CAPTION_TOP.has(n) ? 8 : 2},160,160,${CAPTION_TOP.has(n) ? 150 : 70},1
Style: Label,Segoe UI,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H662A78D6,1,0,0,0,100,100,0,0,3,12,0,7,60,60,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${[label, ...dialog].join("\n")}
`;
}

const segments = [];
for (let n = 1; n <= 9; n++) {
  const c = clips[n];
  const voice = `out/voice-${n}.wav`;
  const voiceLen = duration(voice);
  const srcLen = duration(c.path) - c.skip;
  const target = Math.max(voiceLen + VOICE_DELAY + 0.6, srcLen / MAX_SPEEDUP);
  const speed = Math.max(1, srcLen / target);
  const pad = Math.max(0, target - srcLen / speed);
  await writeFile(`out/sub-${n}.ass`, subtitles(n, target));

  const v = [
    `trim=start=${c.skip.toFixed(2)}`, "setpts=PTS-STARTPTS", `setpts=PTS/${speed.toFixed(3)}`,
    "fps=30", "scale=1920:1080:flags=lanczos", `tpad=stop_mode=clone:stop_duration=${(pad + 0.1).toFixed(2)}`,
    `trim=duration=${target.toFixed(2)}`, "setpts=PTS-STARTPTS",
    `fade=t=in:st=0:d=0.35`, `fade=t=out:st=${(target - 0.35).toFixed(2)}:d=0.35`,
    `subtitles=out/sub-${n}.ass`,
  ].join(",");
  const a = `adelay=${Math.round(VOICE_DELAY * 1000)},apad,atrim=duration=${target.toFixed(2)},afade=t=out:st=${(target - 0.3).toFixed(2)}:d=0.3`;
  const seg = `out/seg-${n}.mp4`;
  run(["-y", "-loglevel", "error", "-i", c.path, "-i", voice, "-filter_complex", `[0:v]${v}[v];[1:a]${a}[a]`,
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", seg]);
  segments.push(seg);
  console.log(`scene ${n}: ${target.toFixed(1)}s (screen ${srcLen.toFixed(1)}s, voice ${voiceLen.toFixed(1)}s, speed x${speed.toFixed(2)})`);
}

await writeFile("out/segments.txt", segments.map((s) => `file '${s.replace("out/", "")}'`).join("\n"));
run(["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "out/segments.txt", "-c", "copy", "-movflags", "+faststart", "out/LeadPilot-demo.mp4"]);
console.log(`done: out/LeadPilot-demo.mp4 (${duration("out/LeadPilot-demo.mp4").toFixed(1)}s)`);
