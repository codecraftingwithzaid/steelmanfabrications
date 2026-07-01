import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen">
      <AppNav
        userName={profile?.full_name || user.email || "User"}
        role={(profile?.role as "admin" | "staff") || "staff"}
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        {children}
      </main>
    </div>
  );
}
