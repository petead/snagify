import Link from "next/link";
import {
  ClipboardList,
  Check,
  PenLine,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardBottomNav } from "@/components/layout/DashboardBottomNav";

function getFirstName(fullName: string | null): string {
  if (!fullName?.trim()) return "there";
  return fullName.trim().split(/\s+/)[0] ?? "there";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    fullName = profile?.full_name ?? null;
  }

  const firstName = getFirstName(fullName);

  return (
    <div className="min-h-screen bg-[#fcfcfc]">
      <DashboardHeader fullName={fullName} />

      <main className="max-w-[480px] mx-auto px-4 pb-24">
        {/* Hero */}
        <section
          className="mt-4 rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
          style={{
            background: "linear-gradient(135deg, #9A88FD 0%, #7B65FC 100%)",
          }}
        >
          <div>
            <h1 className="font-heading font-bold text-white text-2xl">
              Good morning, {firstName} 👋
            </h1>
            <p className="font-body text-sm text-white/70 mt-1">
              Dubai Property Inspections
            </p>
          </div>
          <Link
            href="/inspection/new"
            className="flex-shrink-0 inline-flex items-center justify-center rounded-xl px-6 py-3 font-heading font-bold text-brand-dark shadow-lg transition-transform active:scale-[0.98]"
            style={{ backgroundColor: "#cafe87" }}
          >
            + New Inspection
          </Link>
        </section>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          {[
            {
              label: "Total Inspections",
              value: "0",
              icon: ClipboardList,
              iconColor: "text-brand-purple",
            },
            {
              label: "Completed",
              value: "0",
              icon: Check,
              iconColor: "text-brand-green",
            },
            {
              label: "Pending Signature",
              value: "0",
              icon: PenLine,
              iconColor: "text-brand-yellow",
            },
            {
              label: "This Month",
              value: "0",
              icon: Calendar,
              iconColor: "text-brand-purple",
            },
          ].map(({ label, value, icon: Icon, iconColor }) => (
            <div
              key={label}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <div className={`${iconColor}`}>
                <Icon size={22} strokeWidth={2} />
              </div>
              <p className="font-body text-2xl font-semibold text-brand-dark mt-2">
                {value}
              </p>
              <p className="font-body text-sm text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </section>

        {/* Recent Inspections */}
        <section className="mt-8">
          <h2 className="font-heading font-bold text-lg text-brand-dark mb-4">
            Recent Inspections
          </h2>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-4 min-h-[240px]">
            <span className="text-5xl" role="img" aria-hidden>
              🏠
            </span>
            <p className="font-heading font-semibold text-brand-dark">
              No inspections yet
            </p>
            <p className="font-body text-sm text-gray-500 text-center">
              Start your first inspection to get going
            </p>
            <Link
              href="/inspection/new"
              className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-heading font-bold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: "#9A88FD" }}
            >
              + New Inspection
            </Link>
          </div>
        </section>
      </main>

      <DashboardBottomNav />
    </div>
  );
}
