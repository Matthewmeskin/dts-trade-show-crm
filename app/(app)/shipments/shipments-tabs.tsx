import Link from "next/link";

/** Sub-nav shared by the Shipments and Quotes lists (Quotes is a Shipments view). */
export function ShipmentsTabs({ active }: { active: "shipments" | "quotes" }) {
  const tab = (label: string, href: string, key: "shipments" | "quotes") => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active === key ? "bg-dts-maroon text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1">
      {tab("Shipments", "/shipments", "shipments")}
      {tab("Quotes", "/quotes", "quotes")}
    </div>
  );
}
