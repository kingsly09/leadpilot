/**
 * Split a document into ~maxChars chunks on paragraph boundaries, with a small overlap
 * so a fact that spans two chunks is still retrievable.
 */
export function chunkText(text: string, maxChars = 1200, overlap = 150): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > maxChars) {
      chunks.push(current);
      current = current.slice(-overlap) + "\n\n" + p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
    // A single paragraph longer than maxChars gets hard-split.
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars - overlap);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
