import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Constants } from "@/lib/database.types";
import { DOCUMENT_TYPE_META, DOCUMENTS_BUCKET, type DocumentType } from "@/lib/documents";
import { MHA_UPLOADS_BUCKET } from "@/lib/mha/media";
import { formatDate } from "@/lib/format";
import { documentDownload } from "./actions";
import { DeleteDocButton } from "./delete-doc-button";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select(
      "id, document_name, document_type, file_url, uploaded_at, show_id, show:shows!documents_show_id_fkey(id, show_name), uploader:profiles!documents_uploaded_by_fkey(full_name, email)",
    )
    .order("uploaded_at", { ascending: false });

  if (sp.show) query = query.eq("show_id", sp.show);
  if (sp.type && (Constants.public.Enums.document_type as readonly string[]).includes(sp.type))
    query = query.eq("document_type", sp.type as DocumentType);

  const [{ data: docs }, { data: shows }] = await Promise.all([
    query,
    supabase.from("shows").select("id, show_name, edition_year").order("show_name"),
  ]);

  const rows = docs ?? [];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Files attached to your shows — kits, routing guides, floor maps, and more."
        actions={
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> Upload document
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <select name="show" defaultValue={sp.show ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All shows</option>
          {(shows ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.show_name}{s.edition_year ? ` ${s.edition_year}` : ""}</option>
          ))}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All types</option>
          {Constants.public.Enums.document_type.map((t) => (
            <option key={t} value={t}>{DOCUMENT_TYPE_META[t].label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Filter
        </button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="documents"
            title={sp.show || sp.type ? "No documents match" : "No documents yet"}
            description={sp.show || sp.type ? "Try a different filter." : "Upload a file and attach it to a show."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Show</th>
                  <th className="px-5 py-3">Uploaded</th>
                  <th className="px-5 py-3">By</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((doc) => {
                  const meta = doc.document_type ? DOCUMENT_TYPE_META[doc.document_type] : null;
                  const bucket = doc.document_type === "MHA" ? MHA_UPLOADS_BUCKET : DOCUMENTS_BUCKET;
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <form action={documentDownload}>
                          <input type="hidden" name="path" value={doc.file_url ?? ""} />
                          <input type="hidden" name="bucket" value={bucket} />
                          <button
                            type="submit"
                            disabled={!doc.file_url}
                            className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-dts-maroon disabled:text-slate-400"
                          >
                            <Icon name="documents" className="h-4 w-4 text-slate-400" />
                            {doc.document_name}
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-3">
                        {meta ? <Badge className={meta.badge}>{meta.label}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {doc.show ? (
                          <Link href={`/shows/${doc.show.id}`} className="text-dts-blue hover:underline">
                            {doc.show.show_name}
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(doc.uploaded_at.slice(0, 10))}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {doc.uploader?.full_name?.trim() || doc.uploader?.email || (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <DeleteDocButton id={doc.id} path={doc.file_url} showId={doc.show_id} name={doc.document_name} bucket={bucket} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
