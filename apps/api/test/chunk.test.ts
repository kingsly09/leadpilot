import { describe, expect, it } from "vitest";
import { chunkText } from "../src/lib/chunk.js";

describe("chunkText", () => {
  it("keeps a short document as one chunk", () => {
    expect(chunkText("Hello.\n\nWorld.")).toEqual(["Hello.\n\nWorld."]);
  });

  it("splits on paragraphs and respects the size limit", () => {
    const para = "x".repeat(500);
    const chunks = chunkText([para, para, para, para].join("\n\n"), 1200, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1200);
  });

  it("hard-splits a single paragraph longer than the limit", () => {
    const chunks = chunkText("y".repeat(3000), 1000, 100);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
    expect(chunks.join("").length).toBeGreaterThanOrEqual(3000);
  });

  it("ignores empty input", () => {
    expect(chunkText("  \n\n  ")).toEqual([]);
  });
});
