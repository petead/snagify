import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardBottomNav } from "@/components/layout/DashboardBottomNav";
import { createClient } from "@/lib/supabase/server";

export default async function InspectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let fullName: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    fullName = data?.full_name ?? null;
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc]">
      <DashboardHeader fullName={fullName} />
      <main className="max-w-[480px] mx-auto px-4 pb-24 pt-6">
        <h1 className="font-heading font-bold text-lg text-brand-dark">
          Inspections
        </h1>
        <p className="font-body text-gray-500 mt-2">Coming soon.</p>
      </main>
      <DashboardBottomNav />
    </div>
  );
}
