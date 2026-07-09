"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, inputClass } from "@/components/form";
import type { MhaResult } from "@/lib/mha/result";
import { MhaResultView } from "./result-view";
import { MhaLoader } from "./mha-loader";

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf,.heic,.heif";

// Photos off a phone are often 8–12 MP. Downscaling to ~1600px on the long edge
// before upload cuts the upload size and speeds the vision read, with no
// meaningful loss of legibility. HEIC/PDF can't be canvas-decoded, so they pass
// through untouched (the server handles HEIC conversion).
const MAX_EDGE = 1600;

async function downscaleImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_EDGE) {
      bitmap.close();
      return file;
    }
    const scale = MAX_EDGE / longest;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function MhaCheckForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MhaResult | null>(null);
  const [fileName, setFileName] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Attach a photo or PDF of the MHA.");
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const shrunk = await downscaleImage(file);
      if (shrunk !== file) {
        fd.set("file", shrunk, file.name.replace(/\.[^.]+$/, "") + ".jpg");
      }
      const res = await fetch("/api/mha/submit", { method: "POST", body: fd });
      const data = (await res.json()) as MhaResult & { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setResult(data);
      // Keep the form values but scroll to the result.
      requestAnimationFrame(() => {
        document.getElementById("mha-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Card>
          <FormSection
            title="Your details"
            description="So we can reach you if the paperwork needs a fix before the freight leaves."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="submitter_name" required>
                <input id="submitter_name" name="submitter_name" className={inputClass} autoComplete="name" required />
              </Field>
              <Field label="Company name" htmlFor="company_name" required>
                <input id="company_name" name="company_name" className={inputClass} autoComplete="organization" required />
              </Field>
              <Field label="Phone" htmlFor="submitter_phone" required>
                <input id="submitter_phone" name="submitter_phone" type="tel" className={inputClass} autoComplete="tel" required />
              </Field>
              <Field label="Email" htmlFor="submitter_email" required>
                <input id="submitter_email" name="submitter_email" type="email" className={inputClass} autoComplete="email" required />
              </Field>
            </div>
          </FormSection>

          <FormSection title="The form" description="Load number is optional — we can still check the MHA itself without it.">
            <Field label="Load number" htmlFor="load_number" hint="If you have it. We can still check the form without it.">
              <input id="load_number" name="load_number" className={inputClass} placeholder="e.g. TMS reference / PRO number" />
            </Field>
            <Field label="MHA photo or PDF" htmlFor="file" required>
              <input
                id="file"
                name="file"
                type="file"
                accept={ACCEPT}
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-dts-maroon file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-dts-maroon-dark"
              />
              {fileName ? <p className="mt-1 text-xs text-slate-400">{fileName}</p> : null}
            </Field>
          </FormSection>

          <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4">
            {error ? <p className="text-sm text-dts-maroon">{error}</p> : <span />}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60"
            >
              {busy ? "Reading…" : "Check this MHA"}
            </button>
          </div>
        </Card>
      </form>

      {busy ? <MhaLoader /> : null}

      {!busy && result ? (
        <div id="mha-result">
          <MhaResultView result={result} />
        </div>
      ) : null}
    </div>
  );
}
