import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { REPORTS } from "@/lib/reports";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Aggregate views across your trade show data." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.slug} href={`/reports/${r.slug}`}>
            <Card className="h-full p-5 transition hover:border-dts-maroon/40 hover:shadow-md">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-dts-maroon/10 text-dts-maroon">
                <Icon name={r.icon} className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-sm font-semibold text-slate-900">{r.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{r.description}</p>
              {r.scoped ? (
                <span className="mt-3 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Per show
                </span>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
