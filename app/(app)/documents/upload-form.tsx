"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui";
import { Field, FormSection, inputClass } from "@/components/form";
import { Constants } from "@/lib/database.types";
import { DOCUMENT_TYPE_META, DOCUMENTS_BUCKET } from "@/lib/documents";
import { createClient } from "@/lib/supabase/client";
import { createDocument } from "./actions";

type Opt = { id: string; label: string };

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function UploadForm({
  shows,
  defaultShowId,
}: {
  shows: Opt[];
  defaultShowId?: string;
}) {
  const router = useRouter();
  const [showId, setShowId] = useState(defaultShowId ?? "");
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!showId) return setError("Select a show.");
    if (!file) return setError("Choose a file to upload.");

    setBusy(true);
    try {
      const supabase = createClient();
      const path = `${showId}/${Date.now()}-${safeName(file.name)}`;
      const up = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { upsert: false });
      if (up.error) {
        setError(`Upload failed: ${up.error.message}`);
        return;
      }

      const fd = new FormData();
      fd.set("show_id", showId);
      fd.set("document_name", docName.trim() || file.name);
      fd.set("document_type", docType);
      fd.set("file_url", path);
      const res = await createDocument(fd);
      if (res.error) {
        // Roll back the orphaned upload so storage and the table stay in sync.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        setError(res.error);
        return;
      }

      router.push(defaultShowId ? `/shows/${showId}?tab=documents` : "/documents");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <FormSection title="Upload document">
          <Field label="Show" htmlFor="show_id" required>
            <select
              id="show_id"
              value={showId}
              onChange={(e) => setShowId(e.target.value)}
              className={inputClass}
              disabled={!!defaultShowId}
            >
              <option value="">— Select show —</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Document type" htmlFor="document_type">
            <select
              id="document_type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select type —</option>
              {Constants.public.Enums.document_type.map((t) => (
                <option key={t} value={t}>{DOCUMENT_TYPE_META[t].label}</option>
              ))}
            </select>
          </Field>

          <Field label="File" htmlFor="file" required className="sm:col-span-2">
            <input
              id="file"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-dts-maroon file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-dts-maroon-dark"
            />
          </Field>

          <Field label="Display name" htmlFor="document_name" className="sm:col-span-2" hint="Defaults to the file name.">
            <input
              id="document_name"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className={inputClass}
              placeholder="e.g. 2026 Exhibitor Kit"
            />
          </Field>
        </FormSection>
      </Card>

      {error ? (
        <p className="mt-4 rounded-lg bg-dts-maroon/5 px-3 py-2 text-sm text-dts-maroon">{error}</p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload document"}
        </button>
        <Link
          href={defaultShowId ? `/shows/${defaultShowId}?tab=documents` : "/documents"}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
