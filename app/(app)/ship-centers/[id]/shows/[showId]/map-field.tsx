"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { Field, inputClass } from "@/components/form";
import { MAP_KINDS, MAP_MAX_BYTES, mapPathname, type MapKind } from "@/lib/ship-maps";

/**
 * One show map: a link, or (once Vercel Blob is set up) a file from the kit
 * uploaded straight from the browser. Either way the link lands in the input,
 * and saving the form saves it.
 */
export function MapField({
  kind,
  partnerId,
  showId,
  defaultUrl,
  uploadReady,
  error,
  hint,
}: {
  kind: MapKind;
  partnerId: string;
  showId: string;
  defaultUrl: string | null;
  uploadReady: boolean;
  error?: string;
  hint: string;
}) {
  const { column, label } = MAP_KINDS[kind];
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    const path = mapPathname(partnerId, showId, kind, file.type);
    if (!path) return setUploadError("Use a PDF, PNG, JPEG or WebP file.");
    if (file.size > MAP_MAX_BYTES) return setUploadError("Keep it under 25 MB.");
    setBusy(true);
    try {
      const blob = await upload(path, file, { access: "public", handleUploadUrl: "/api/ship-maps/upload", contentType: file.type });
      setUrl(blob.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "The upload did not finish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label} htmlFor={column} error={uploadError ?? error} hint={hint} className="sm:col-span-2">
      <div className="space-y-2">
        <input
          id={column}
          name={column}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {uploadReady ? (
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
              {busy ? "Uploading…" : "Upload the file instead"}
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          ) : (
            <span className="text-slate-400">File upload comes once Vercel Blob is set up.</span>
          )}
          {url && /^https:\/\//.test(url) ? (
            <a href={url} target="_blank" rel="noreferrer" className="text-dts-maroon hover:underline">
              Open it
            </a>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
