"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { Field, FormSection, inputClass } from "@/components/form";
import type { MhaResult } from "@/lib/mha/result";
import { MhaResultView } from "./result-view";

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf,.heic,.heif";

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
              {busy ? "Reading the form…" : "Check this MHA"}
            </button>
          </div>
        </Card>
      </form>

      {result ? (
        <div id="mha-result">
          <MhaResultView result={result} />
        </div>
      ) : null}
    </div>
  );
}
