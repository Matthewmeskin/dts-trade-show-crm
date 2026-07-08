/**
 * Ties the pipeline together: transcribe (model) → evaluate (deterministic).
 * Kept free of persistence and request concerns so it can be exercised directly
 * from a test or a script with a fixed extraction.
 */
import { extractMha } from "./extract";
import { evaluateRules, overallStatus, type CheckResult, type MhaLoad, type Overall } from "./rules";
import type { MhaExtraction } from "./extraction";
import type { PreparedMedia } from "./media";

export type VerificationOutcome = {
  extraction: MhaExtraction;
  model: string;
  checks: CheckResult[];
  overall: Overall;
};

export async function verifyMha(
  media: PreparedMedia[],
  load: MhaLoad | null,
): Promise<VerificationOutcome> {
  const { extraction, model } = await extractMha(media);
  const checks = evaluateRules(extraction, load);
  return { extraction, model, checks, overall: overallStatus(checks) };
}
