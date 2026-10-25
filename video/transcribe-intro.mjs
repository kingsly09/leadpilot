import { readFile } from "node:fs/promises";
const key = (await readFile("../apps/api/.env", "utf8")).match(/^OPENAI_API_KEY="?([^"\r\n]+)"?/m)?.[1];
const form = new FormData();
form.append("file", new Blob([await readFile("out/intro-audio.mp3")]), "intro.mp3");
form.append("model", "whisper-1");
form.append("response_format", "verbose_json");
form.append("timestamp_granularities[]", "segment");
const j = await (await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form })).json();
for (const s of j.segments) console.log(`[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`);
