"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2, ClipboardList, FileText } from "lucide-react";

type ProfileData = {
  full_name: string | null;
  agency_name: string | null;
  phone: string | null;
  email: string | null;
};

type Stats = {
  properties: number;
  inspections: number;
  reports: number;
};

const inputClass =
  "w-full h-12 px-4 rounded-xl border border-gray-200 bg-white font-body text-sm focus:outline-none focus:border-[#9A88FD]";

export function ProfileClient({
  profile: initialProfile,
  stats,
}: {
  profile: ProfileData;
  stats: Stats;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name?.trim() || null,
        agency_name: profile.agency_name?.trim() || null,
        phone: profile.phone?.trim() || null,
      })
      .eq("id", (await supabase.auth.getUser()).data.user?.id);

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: "Profile updated." });
    router.refresh();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <h1 className="font-heading font-bold text-xl mb-6" style={{ color: "#111827" }}>
        Profile
      </h1>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <h2 className="font-heading font-semibold text-sm text-gray-500 uppercase tracking-wider mb-4">
          Your details
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block font-body text-sm font-medium text-gray-700 mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={profile.full_name ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block font-body text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={profile.email ?? ""}
              disabled
              className={`${inputClass} bg-gray-50 text-gray-500`}
            />
            <p className="font-body text-xs text-gray-400 mt-1">Email is managed by your account.</p>
          </div>
          <div>
            <label className="block font-body text-sm font-medium text-gray-700 mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={profile.phone ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              className={inputClass}
              placeholder="+971..."
            />
          </div>
          <div>
            <label className="block font-body text-sm font-medium text-gray-700 mb-1.5">
              Agency name
            </label>
            <input
              type="text"
              value={profile.agency_name ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, agency_name: e.target.value }))}
              className={inputClass}
              placeholder="Your agency"
            />
          </div>
        </div>
        {message && (
          <p
            className={`mt-3 font-body text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full h-12 rounded-xl font-heading font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: "#9A88FD" }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <h2 className="font-heading font-semibold text-sm text-gray-500 uppercase tracking-wider mb-4">
          Stats
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "#F0EDFF" }}>
            <Building2 size={20} className="mx-auto" style={{ color: "#9A88FD" }} />
            <p className="font-heading font-bold text-lg mt-1 mb-0" style={{ color: "#111827" }}>
              {stats.properties}
            </p>
            <p className="font-body text-xs text-gray-500">Properties</p>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "#F0EDFF" }}>
            <ClipboardList size={20} className="mx-auto" style={{ color: "#9A88FD" }} />
            <p className="font-heading font-bold text-lg mt-1 mb-0" style={{ color: "#111827" }}>
              {stats.inspections}
            </p>
            <p className="font-body text-xs text-gray-500">Inspections</p>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "#F0EDFF" }}>
            <FileText size={20} className="mx-auto" style={{ color: "#9A88FD" }} />
            <p className="font-heading font-bold text-lg mt-1 mb-0" style={{ color: "#111827" }}>
              {stats.reports}
            </p>
            <p className="font-body text-xs text-gray-500">Reports</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <h2 className="font-heading font-semibold text-sm text-gray-500 uppercase tracking-wider mb-2">
          Install App
        </h2>
        <p className="font-body text-sm text-gray-600 mb-3">
          Add Snagify to your home screen for quick access. On iPhone: tap Share in Safari, then &ldquo;Add to Home Screen&rdquo;. On Android: tap the menu and &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.
        </p>
      </section>

      <button
        type="button"
        onClick={handleSignOut}
        className="w-full h-12 rounded-xl font-heading font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
