"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { DOCUMENTS_BUCKET } from "@/lib/documents";
import { createClient } from "@/lib/supabase/client";
import { documentDownload } from "@/app/(app)/documents/actions";
import {
  getShipmentDocuments,
  createShipmentDocument,
  deleteShipmentDocument,
} from "./actions";

type Doc = {
  id: string;
  document_name: string;
  file_url: string | null;
  uploaded_at: string;
};

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/**
 * Documents attached to a single shipment. Files upload straight to Storage
 * from the browser; a server action records the row. Loaded on demand so the
 * drawer opens instantly.
 */
export function ShipmentDocuments({
  shipmentId,
  showId,
}: {
  shipmentId: string;
  showId: string | null;
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => getShipmentDocuments(shipmentId).then(setDocs);

  useEffect(() => {
    let active = true;
    getShipmentDocuments(shipmentId).then((d) => {
      if (active) setDocs(d);
    });
    return () => {
      active = false;
    };
  }, [shipmentId]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `shipments/${shipmentId}/${Date.now()}-${safeName(file.name)}`;
      const up = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
      if (up.error) {
        setError(`Upload failed: ${up.error.message}`);
        return;
      }
      const fd = new FormData();
      fd.set("shipment_id", shipmentId);
      if (showId) fd.set("show_id", showId);
      fd.set("document_name", file.name);
      fd.set("file_url", path);
      const res = await createShipmentDocument(fd);
      if (res.error) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        setError(res.error);
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(doc: Doc) {
    const fd = new FormData();
    fd.set("id", doc.id);
    if (doc.file_url) fd.set("path", doc.file_url);
    if (showId) fd.set("show_id", showId);
    setDocs((cur) => (cur ?? []).filter((d) => d.id !== doc.id));
    await deleteShipmentDocument(fd);
  }

  return (
    <div className="border-t border-slate-100 px-1 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-slate-900">Documents</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          {busy ? "Uploading…" : "Attach"}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
      </div>

      {error ? (
        <p className="mb-3 rounded-lg bg-dts-maroon/5 px-3 py-2 text-xs text-dts-maroon">{error}</p>
      ) : null}

      {docs === null ? (
        <p className="py-2 text-xs text-slate-400">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="py-2 text-xs text-slate-400">No documents attached yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
              <form action={documentDownload} className="min-w-0 flex-1">
                <input type="hidden" name="path" value={doc.file_url ?? ""} />
                <button
                  type="submit"
                  className="flex min-w-0 items-center gap-2 text-left text-sm text-dts-blue hover:underline"
                  disabled={!doc.file_url}
                >
                  <Icon name="documents" className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{doc.document_name}</span>
                </button>
              </form>
              <span className="shrink-0 text-xs text-slate-400">{formatDate(doc.uploaded_at)}</span>
              <button
                type="button"
                onClick={() => onDelete(doc)}
                aria-label={`Delete ${doc.document_name}`}
                className="shrink-0 rounded p-1 text-slate-300 transition hover:bg-dts-maroon/5 hover:text-dts-maroon"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
