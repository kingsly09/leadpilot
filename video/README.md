# Demo video tooling

Makes `LeadPilot-demo.mp4` from voice recordings and an automated screen recording of the live demo.

1. Put the 9 voice recordings in `audio/scene-1.mp3` … `audio/scene-9.mp3` (one per scene of `../docs/demo-video-script.md`).
2. `node transcribe.mjs`: word timings via OpenAI Whisper (uses `OPENAI_API_KEY` from `../apps/api/.env`).
3. Clean the audio and write `out/durations.json` (see the FFmpeg chain used in the project history: high-pass, trim leading/trailing silence, loudness to -16 LUFS).
4. `node record.mjs`: resets the demo, plays all 9 scenes on the live site with Playwright, records a clip per scene paced to the voice.
5. `node build.mjs`: syncs voice + clips, burns in subtitles and scene labels, joins them into `out/LeadPilot-demo.mp4`.

Recording runs the real flow, so it sends real hot-lead and meeting alerts through n8n.
