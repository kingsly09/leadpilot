import type { TurnResult } from "@leadpilot/shared";

/**
 * Deterministic lead scoring. The LLM only extracts facts; these rules decide the tier,
 * so scores are explainable and editable without touching prompts.
 */
export function scoreLead(input: {
  intent: TurnResult["intent"];
  extracted: Partial<TurnResult["extracted"]>;
}) {
  const reasons: string[] = [];
  let score = 0;
  const { extracted: x, intent } = input;

  if (x.budget) { score += 30; reasons.push("budget given (+30)"); }
  if (x.timeline && /(asap|now|week|this month|30 days|urgent)/i.test(x.timeline)) {
    score += 20; reasons.push("short timeline (+20)");
  }
  if (x.email || x.phone) { score += 20; reasons.push("contact captured (+20)"); }
  if (intent === "pricing" || intent === "booking") { score += 15; reasons.push(`intent ${intent} (+15)`); }
  if (intent === "spam" || intent === "not_interested") { score -= 50; reasons.push(`intent ${intent} (-50)`); }

  const tier = score >= 60 ? "HOT" : score >= 30 ? "WARM" : "COLD";
  return { score, tier, reasons } as const;
}
