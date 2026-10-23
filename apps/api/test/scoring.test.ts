import { describe, expect, it } from "vitest";
import { scoreLead } from "../src/lib/scoring.js";

const empty = { name: null, email: null, phone: null, budget: null, timeline: null, need: null };

describe("scoreLead", () => {
  it("rates a lead with budget, short timeline, contact and booking intent as HOT", () => {
    const r = scoreLead({
      intent: "booking",
      extracted: { ...empty, budget: "$3,000", timeline: "this month", email: "a@b.com" },
    });
    expect(r.score).toBe(85);
    expect(r.tier).toBe("HOT");
  });

  it("rates a vague question as COLD", () => {
    expect(scoreLead({ intent: "question", extracted: empty }).tier).toBe("COLD");
  });

  it("rates budget alone as WARM; a long timeline earns nothing", () => {
    const r = scoreLead({ intent: "question", extracted: { ...empty, budget: "$500", timeline: "next year" } });
    expect(r.score).toBe(30);
    expect(r.tier).toBe("WARM");
  });

  it("penalises spam", () => {
    const r = scoreLead({ intent: "spam", extracted: { ...empty, email: "x@y.z" } });
    expect(r.score).toBe(-30);
    expect(r.tier).toBe("COLD");
  });

  it("explains its score", () => {
    const r = scoreLead({ intent: "pricing", extracted: { ...empty, phone: "+1555" } });
    expect(r.reasons).toEqual(["contact captured (+20)", "intent pricing (+15)"]);
  });
});
