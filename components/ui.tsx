import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export type Crumb = { label: string; href: string };

/** Page heading with optional breadcrumbs, description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="mb-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          {breadcrumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-2">
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              <Link href={c.href} className="hover:text-slate-700">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div className="flex items-center gap-2">
        {icon ? <Icon name={icon} className="h-4 w-4 text-slate-400" /> : null}
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: IconName;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon name={icon} className="h-5 w-5" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-sm text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

/** A placeholder page used for routes not yet built out. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon="sparkles"
          title={`${title} is coming next`}
          description="The dashboard is the first build. This section will be wired up in an upcoming step."
        />
      </Card>
    </div>
  );
}

/** Small link-styled button used for quick actions. */
export function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: IconName;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-dts-maroon/40 hover:bg-dts-maroon/5"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-dts-maroon text-white">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}
