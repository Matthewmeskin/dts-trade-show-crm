/**
 * GET /api/mha/result/[submission_id]
 *
 * Re-fetch a completed (or in-flight) MHA verification: submission metadata,
 * the deterministic checks, the transcription, and a fresh short-lived signed
 * URL for the uploaded file. Used for deep-links and refreshes.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MHA_UPLOADS_BUCKET } from "@/lib/mha/media";
import type { MhaExtraction } from "@/lib/mha/extraction";
import type { CheckResult } from "@/lib/mha/rules";
import type { MhaResult, SubmissionStatus } from "@/lib/mha/result";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ submission_id: string }> },
) {
  const { submission_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: submission, error } = await supabase
    .from("mha_submissions")
    .select(
      "id, status, match_method, load_id, company_name, load_number_input, storage_path",
    )
    .eq("id", submission_id)
    .maybeSingle();

  if (error || !submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const { data: review } = await supabase
    .from("mha_review_results")
    .select("gc_detected, extracted, checks, overall")
    .eq("submission_id", submission_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: signed } = await supabase.storage
    .from(MHA_UPLOADS_BUCKET)
    .createSignedUrl(submission.storage_path, 900);

  // Recover the matched load's reference + booked figures (display only).
  let loadReference: string | null = null;
  let loadPieces: number | null = null;
  let loadWeight: number | null = null;
  if (submission.load_id) {
    const { data: ship } = await supabase
      .from("shipments")
      .select("tms_reference_id, pro_number, pieces, weight")
      .eq("id", submission.load_id)
      .maybeSingle();
    loadReference = ship?.tms_reference_id ?? ship?.pro_number ?? null;
    loadPieces = ship?.pieces ?? null;
    loadWeight = ship?.weight ?? null;
  }

  const result: MhaResult = {
    submissionId: submission.id,
    status: submission.status as SubmissionStatus,
    overall: (review?.overall as MhaResult["overall"]) ?? null,
    gcDetected: review?.gc_detected ?? null,
    checks: (review?.checks as unknown as CheckResult[]) ?? [],
    extracted: (review?.extracted as unknown as MhaExtraction) ?? null,
    matchMethod: submission.match_method as MhaResult["matchMethod"],
    loadId: submission.load_id,
    loadReference,
    loadPieces,
    loadWeight,
    companyName: submission.company_name,
    loadNumberInput: submission.load_number_input,
    lowResolution: false,
    fileUrl: signed?.signedUrl ?? null,
  };

  return NextResponse.json(result);
}
