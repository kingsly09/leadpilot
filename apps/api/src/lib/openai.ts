import OpenAI from "openai";
import { env } from "../env.js";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const CHAT_MODEL = "gpt-4o-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dimensions, matches KbChunk.embedding

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  return res.data.map((d) => d.embedding);
}

/** pgvector accepts vectors as the text literal "[0.1,0.2,...]". */
export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;
