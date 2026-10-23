import { db } from "./db.js";
import { embed, toVectorLiteral } from "./openai.js";
import { chunkText } from "./chunk.js";

export async function ingestDocument(title: string, content: string, source?: string) {
  const pieces = chunkText(content);
  const vectors = await embed(pieces);

  const doc = await db.kbDocument.create({ data: { title, source } });
  for (const [i, piece] of pieces.entries()) {
    const chunk = await db.kbChunk.create({ data: { documentId: doc.id, content: piece } });
    // Prisma can't write vector columns directly, so the embedding goes in with raw SQL.
    await db.$executeRaw`UPDATE "KbChunk" SET embedding = ${toVectorLiteral(vectors[i])}::vector WHERE id = ${chunk.id}`;
  }
  return { id: doc.id, title, chunks: pieces.length };
}

export type KbHit = { id: string; content: string; similarity: number };

/** Cosine-similarity search over the knowledge base (pgvector `<=>` is cosine distance). */
export async function searchKb(query: string, k = 4, minSimilarity = 0.3): Promise<KbHit[]> {
  const [vector] = await embed([query]);
  const v = toVectorLiteral(vector);
  const hits = await db.$queryRaw<KbHit[]>`
    SELECT id, content, 1 - (embedding <=> ${v}::vector) AS similarity
    FROM "KbChunk"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${v}::vector
    LIMIT ${k}`;
  return hits.filter((h) => Number(h.similarity) >= minSimilarity);
}
