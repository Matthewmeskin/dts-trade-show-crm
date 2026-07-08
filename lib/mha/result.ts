/**
 * Shape returned by POST /api/mha/submit and GET /api/mha/result/[id], shared
 * with the client so the form and result screen stay in lockstep with the API.
 */
import type { CheckResult, Overall } from "./rules";
import type { MhaExtraction } from "./extraction";

export type SubmissionStatus = "pending" | "passed" | "warning" | "failed" | "error";

export type MhaResult = {
  submissionId: string;
  status: SubmissionStatus;
  overall: Overall | null;
  gcDetected: string | null;
  checks: CheckResult[];
  extracted: MhaExtraction | null;
  matchMethod: "exact" | "fuzzy" | "none";
  loadId: string | null;
  loadReference: string | null;
  companyName: string;
  loadNumberInput: string | null;
  lowResolution: boolean;
  fileUrl: string | null; // short-lived signed URL
  error?: string;
};
