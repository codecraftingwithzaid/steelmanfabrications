import { createClient } from "@/lib/supabase/server";
import { DocumentEditor } from "@/components/document/document-editor";
import {
  DESCRIPTIONS_BY_CATEGORY,
  type CategorySlug,
} from "@/lib/catalog";
import type { DocType } from "@/lib/types";

export const metadata = { title: "New Document · Steelman" };

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .single()
    : { data: null };

  // Live catalog from DB (admins can edit); fall back to seed constants.
  const { data: rows } = await supabase
    .from("item_descriptions")
    .select("label, sort_order, is_active, item_categories!inner(name)")
    .eq("is_active", true)
    .order("sort_order");

  const descriptions: Record<CategorySlug, string[]> = {
    fabrication: [],
    aluminium: [],
  };
  if (rows && rows.length) {
    for (const r of rows as unknown as {
      label: string;
      item_categories: { name: CategorySlug };
    }[]) {
      const slug = r.item_categories?.name;
      if (slug && descriptions[slug]) descriptions[slug].push(r.label);
    }
  }
  if (!descriptions.fabrication.length)
    descriptions.fabrication = DESCRIPTIONS_BY_CATEGORY.fabrication;
  if (!descriptions.aluminium.length)
    descriptions.aluminium = DESCRIPTIONS_BY_CATEGORY.aluminium;

  const initialDocType: DocType =
    searchParams.type === "quotation" ? "quotation" : "invoice";

  return (
    <DocumentEditor
      initialDocType={initialDocType}
      descriptions={descriptions}
      contact={{
        name: profile?.full_name || "",
        email: profile?.email || user?.email || "",
        phone: profile?.phone || "",
      }}
    />
  );
}
