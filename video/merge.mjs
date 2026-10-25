// Joins the camera intro and the LeadPilot demo into one Upwork video, with a cross-fade right after the
// intro's last sentence, matched loudness, and subtitles in the same style as the demo.
import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

const INTRO = "C:/Users/HomePC/Pictures/Camera Roll/up-work video 3.mp4";
const DEMO = "out/LeadPilot-demo.mp4";
const OUT = "out/Upwork-intro-LeadPilot.mp4";

const INTRO_END = 43.4; // last word ends at ~42.6s; keep a short breath before the fade
const FADE = 0.9;
// Start the demo at "So I built a system called LeadPilot", in the pause after its first sentence,
// because the intro already introduces the problem (and says "Hi").
const DEMO_SKIP = 10.7;

// Intro subtitles: Whisper timings, wording lightly corrected.
const LINES = [
  [0.0, 5.4, "Your business is losing a lot of leads while you sleep, not because your offer is weak, but"],
  [5.4, 8.5, "because nobody is following up fast enough."],
  [8.5, 12.4, "And you can agree with me that consistent, proper follow-up is the secret key to"],
  [12.4, 15.3, "success in any business organization."],
  [15.3, 20.0, "The missed calls, the slow replies, the manual copying and pasting into your CRM, and chasing"],
  [20.0, 24.8, "people around to book an appointment. I know this pain because I have lived it."],
  [24.8, 28.6, "Hi, my name is Sylvester Ayemere, and I'm from Lagos, Nigeria."],
  [28.8, 33.9, "For four years, I worked as an executive HR assistant, a salesperson, and a customer support"],
  [33.9, 37.6, "lead for founders and CEOs across the US and Canada."],
  [37.6, 42.0, "I've done the repetitive work manually, and I've learned how to make it disappear."],
];

const ts = (s) => {
  const cs = Math.round(s * 100);
  const m = Math.floor(cs / 6000), sec = Math.floor(cs / 100) % 60;
  return `0:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
// Long lines are split in two, with time shared by word count.
const events = [];
for (const [start, end, text] of LINES) {
  const words = text.split(" ");
  if (words.length <= 10) { events.push([start, end, text]); continue; }
  const half = Math.ceil(words.length / 2);
  const mid = start + ((end - start) * half) / words.length;
  events.push([start, mid, words.slice(0, half).join(" ")], [mid, end, words.slice(half).join(" ")]);
}
await writeFile("out/intro.ass", `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Segoe UI,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H9A111111,1,0,0,0,100,100,0,0,3,14,0,2,160,160,70,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.map(([s, e, t]) => `Dialogue: 0,${ts(s)},${ts(e)},Caption,,0,0,0,,${t}`).join("\n")}
`);

const filter = [
  // Intro: full-range camera colours -> standard video range, exact 30 fps, subtitles, trimmed after the last word.
  `[0:v]trim=duration=${INTRO_END},setpts=PTS-STARTPTS,fps=30,scale=1920:1080:in_range=pc:out_range=tv,format=yuv420p,subtitles=out/intro.ass[iv]`,
  `[1:v]trim=start=${DEMO_SKIP},setpts=PTS-STARTPTS,fps=30,format=yuv420p[dv]`,
  `[iv][dv]xfade=transition=fade:duration=${FADE}:offset=${(INTRO_END - FADE).toFixed(2)}[v]`,
  // Both voices at the same loudness the demo already uses (-16 LUFS), stereo.
  `[0:a]atrim=duration=${INTRO_END},asetpts=PTS-STARTPTS,highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[ia]`,
  `[1:a]atrim=start=${DEMO_SKIP},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[da]`,
  `[ia][da]acrossfade=d=${FADE}:c1=tri:c2=tri[a]`,
].join(";");

const r = spawnSync(ffmpeg, [
  "-y", "-loglevel", "error", "-i", INTRO, "-i", DEMO, "-filter_complex", filter,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", OUT,
], { encoding: "utf8" });
if (r.status !== 0) throw new Error(r.stderr);
const d = spawnSync(ffmpeg, ["-i", OUT], { encoding: "utf8" }).stderr.match(/Duration: ([\d:.]+)/)[1];
console.log(`done: ${OUT} (${d})`);
