/**
 * POST /api/mha/submit
 *
 * multipart/form-data: file + submitter_name, submitter_phone, submitter_email,
 * company_name, load_number (optional).
 *
 * Creates an mha_submissions row, uploads the file to the private mha-uploads
 * bucket, runs verification inline (transcribe → deterministic rules), records
 * the result, and — when the load resolves — attaches an MHA document to it.
 * Returns the full MhaResult so the form can render the outcome immediately.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { prepareMedia, isAcceptedMime, MAX_UPLOAD_BYTES, MHA_UPLOADS_BUCKET } from "@/lib/mha/media";
import { matchLoad } from "@/lib/mha/match-load";
import { extractMha } from "@/lib/mha/extract";
import { evaluateRules, overallStatus } from "@/lib/mha/rules";
import { resolveShowId, getMhaContacts } from "@/lib/mha-contact";
import type { MhaResult, SubmissionStatus } from "@/lib/mha/result";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Best-effort E.164 for US numbers; leaves already-plus-prefixed input alone. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/[^0-9]/g, "");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function extFor(mime: string): string {
  return mime === "application/pdf"
    ? "pdf"
    : mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Unauthorized", 401);

  if (!process.env.ANTHROPIC_API_KEY) {
    return bad("MHA checking isn't configured (set ANTHROPIC_API_KEY).", 503);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Expected a multipart form upload.");
  }

  const submitterName = String(form.get("submitter_name") ?? "").trim();
  const submitterPhoneRaw = String(form.get("submitter_phone") ?? "").trim();
  const submitterEmail = String(form.get("submitter_email") ?? "").trim();
  const companyName = String(form.get("company_name") ?? "").trim();
  const loadNumberInput = String(form.get("load_number") ?? "").trim() || null;
  const file = form.get("file");

  if (!submitterName) return bad("Your name is required.");
  if (!submitterPhoneRaw) return bad("A phone number is required.");
  if (!submitterEmail || !EMAIL_RE.test(submitterEmail)) return bad("A valid email is required.");
  if (!companyName) return bad("Company name is required.");
  if (!(file instanceof File) || file.size === 0) return bad("Attach a photo or PDF of the MHA.");
  if (file.size > MAX_UPLOAD_BYTES) return bad("That file is larger than 15 MB.");
  if (file.type && !isAcceptedMime(file.type) && !/\.(jpe?g|png|hei[cf]|webp|pdf)$/i.test(file.name)) {
    return bad("Unsupported file type. Upload a JPEG, PNG, HEIC, WebP, or PDF.");
  }

  // Prepare media (HEIC → JPEG, PDF passthrough, dimension preflight).
  const buf = Buffer.from(await file.arrayBuffer());
  let prepared;
  try {
    prepared = await prepareMedia(buf, file.type || "", file.name);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not read that file.");
  }

  // Kick off the vision transcription immediately — it's the long pole, so we
  // overlap it with load matching, the upload, and the DB writes below. Wrapped
  // so it can never reject out-of-band while we await other work first.
  const extractionP = extractMha([prepared.media])
    .then((v) => ({ ok: true as const, extraction: v.extraction, model: v.model }))
    .catch((e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "The form could not be read.",
    }));

  // Resolve the load before we pick the storage path (path is keyed by load).
  const match = await matchLoad(supabase, loadNumberInput);

  const submissionId = crypto.randomUUID();
  const storagePath = `${match.loadId ?? "unmatched"}/${submissionId}.${extFor(prepared.storedMime)}`;

  const upload = await supabase.storage
    .from(MHA_UPLOADS_BUCKET)
    .upload(storagePath, prepared.storedBuffer, {
      contentType: prepared.storedMime,
      upsert: false,
    });
  if (upload.error) {
    return bad(`Upload failed: ${upload.error.message}`, 500);
  }

  const { error: insErr } = await supabase.from("mha_submissions").insert({
    id: submissionId,
    submitter_name: submitterName,
    submitter_phone: normalizePhone(submitterPhoneRaw),
    submitter_email: submitterEmail,
    company_name: companyName,
    load_number_input: loadNumberInput,
    load_id: match.loadId,
    match_method: match.matchMethod,
    storage_path: storagePath,
    file_mime: prepared.storedMime,
    file_bytes: prepared.storedBytes,
    status: "pending",
  });
  if (insErr) {
    await supabase.storage.from(MHA_UPLOADS_BUCKET).remove([storagePath]);
    return bad(`Could not record submission: ${insErr.message}`, 500);
  }

  // Sign a short-lived URL for the result screen thumbnail.
  const { data: signed } = await supabase.storage
    .from(MHA_UPLOADS_BUCKET)
    .createSignedUrl(storagePath, 900);

  const base: Omit<
    MhaResult,
    "status" | "overall" | "gcDetected" | "checks" | "extracted" | "contacts" | "contactIsDefault"
  > = {
    submissionId,
    matchMethod: match.matchMethod,
    loadId: match.loadId,
    loadReference: match.load?.reference ?? null,
    loadPieces: match.load?.pieces ?? null,
    loadWeight: match.load?.weight ?? null,
    companyName,
    loadNumberInput,
    lowResolution: prepared.lowResolution,
    fileUrl: signed?.signedUrl ?? null,
  };

  // Collect the (already in-flight) transcription. On model failure, mark the
  // submission 'error' and return a graceful result the UI can render.
  const ex = await extractionP;
  if (!ex.ok) {
    await supabase.from("mha_submissions").update({ status: "error" }).eq("id", submissionId);
    // Still resolve a contact from the matched load, if any.
    const errShowId = await resolveShowId(supabase, match.loadId, null);
    const errContacts = await getMhaContacts(supabase, errShowId);
    const result: MhaResult = {
      ...base,
      status: "error",
      overall: null,
      gcDetected: null,
      checks: [],
      extracted: null,
      contacts: errContacts.contacts,
      contactIsDefault: errContacts.isDefault,
      error: ex.error,
    };
    return NextResponse.json(result);
  }

  const checks = evaluateRules(ex.extraction, match.load);
  const outcome = {
    extraction: ex.extraction,
    model: ex.model,
    checks,
    overall: overallStatus(checks),
  };
  const status: SubmissionStatus = outcome.overall;

  await supabase.from("mha_review_results").insert({
    submission_id: submissionId,
    gc_detected: outcome.extraction.gc_detected,
    model: outcome.model,
    extracted: outcome.extraction as unknown as Json,
    checks: outcome.checks as unknown as Json,
    overall: outcome.overall,
  });
  // Resolve the show (matched load first, then the transcribed name), remember
  // it on the submission, and pull the contact(s) to show the uploader.
  const showId = await resolveShowId(supabase, match.loadId, ex.extraction.show_name);
  await supabase.from("mha_submissions").update({ status, show_id: showId }).eq("id", submissionId);
  const resolvedContacts = await getMhaContacts(supabase, showId);

  // Attach the MHA to its load profile (only when the load resolved).
  if (match.loadId) {
    await supabase.from("documents").insert({
      document_name: `MHA — ${companyName}${match.load?.reference ? ` (${match.load.reference})` : ""}`,
      document_type: "MHA",
      shipment_id: match.loadId,
      file_url: storagePath,
      uploaded_by: user.id,
    });
  }

  const result: MhaResult = {
    ...base,
    status,
    overall: outcome.overall,
    gcDetected: outcome.extraction.gc_detected,
    checks: outcome.checks,
    extracted: outcome.extraction,
    contacts: resolvedContacts.contacts,
    contactIsDefault: resolvedContacts.isDefault,
  };
  return NextResponse.json(result);
}
