import { readFile } from "node:fs/promises";
import { db } from "../src/lib/db.js";
import { ingestDocument } from "../src/lib/kb.js";

// Loads the sample business knowledge base (re-running replaces it).
const TITLE = "Brightwave Digital — services, pricing & FAQ";

const content = await readFile(new URL("./kb/brightwave.md", import.meta.url), "utf8");
await db.kbDocument.deleteMany({ where: { title: TITLE } });
const doc = await ingestDocument(TITLE, content, "prisma/kb/brightwave.md");
console.log(`Ingested "${doc.title}" as ${doc.chunks} chunks.`);
await db.$disconnect();
