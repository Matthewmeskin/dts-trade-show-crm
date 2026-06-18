import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "../../contact-form";
import { updateContact } from "../../actions";
import { loadContactOptions } from "../../options";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", id).single();
  if (!contact) notFound();

  const options = await loadContactOptions();
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Contact";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit contact" breadcrumbs={[{ label: "Contacts", href: "/contacts" }, { label: name, href: "/contacts/" + id }]} />
      <ContactForm action={updateContact} contact={contact} options={options} submitLabel="Save changes" />
    </div>
  );
}
