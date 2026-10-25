// Transcribes each scene with word-level timestamps (OpenAI Whisper), so mistakes and pauses can be cut.
import { readFile, writeFile } from "node:fs/promises";
const key = (await readFile("../apps/api/.env", "utf8")).match(/^OPENAI_API_KEY="?([^"\r\n]+)"?/m)?.[1];
const results = {};
for (let n = 1; n <= 9; n++) {
  const form = new FormData();
  form.append("file", new Blob([await readFile(`audio/scene-${n}.mp3`)]), `scene-${n}.mp3`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { authorization: `Bearer ${key}` }, body: form,
  });
  const j = await res.json();
  if (!res.ok) { console.log(n, j.error?.message); continue; }
  results[n] = j;
  console.log(`\n=== Scene ${n} (${j.duration.toFixed(1)}s)`);
  for (const s of j.segments) console.log(`  [${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`);
}
await writeFile("out/transcripts.json", JSON.stringify(results, null, 1));
