"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  full_name: string | null;
  agency_name: string | null;
  phone: string | null;
};

function getInitials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

const inputClass =
  "w-full h-12 px-4 rounded-xl border border-gray-200 bg-white font-body text-sm focus:outline-none focus:border-[#9A88FD]";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string | null; created_at?: string } | null>(null);
  const [totalProperties, setTotalProperties] = useState(0);
  const [totalInspections, setTotalInspections] = useState(0);
  const [totalReports, setTotalReports] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", agency_name: "", phone: "" });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single();
      setProfile(profileData ?? null);
      if (profileData) {
        setForm({
          full_name: profileData.full_name ?? "",
          agency_name: profileData.agency_name ?? "",
          phone: profileData.phone ?? "",
        });
      }

      const [
        { count: propsCount },
        { count: inspCount },
        { count: reportsCount },
      ] = await Promise.all([
        supabase.from("properties").select("*", { count: "exact", head: true }).eq("agent_id", u.id),
        supabase.from("inspections").select("*", { count: "exact", head: true }).eq("agent_id", u.id),
        supabase
          .from("inspections")
          .select("*", { count: "exact", head: true })
          .eq("agent_id", u.id)
          .eq("status", "completed"),
      ]);
      setTotalProperties(propsCount ?? 0);
      setTotalInspections(inspCount ?? 0);
      setTotalReports(reportsCount ?? 0);
      setLoading(false);
    };
    load();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim() || null,
        agency_name: form.agency_name.trim() || null,
        phone: form.phone.trim() || null,
      })
      .eq("id", user.id);
    setProfile({
      full_name: form.full_name.trim() || null,
      agency_name: form.agency_name.trim() || null,
      phone: form.phone.trim() || null,
    });
    setSaving(false);
    setEditing(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-[#fcfcfc] pb-24 max-w-lg mx-auto flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#9A88FD] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fcfcfc] pb-24 max-w-lg mx-auto">
      <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center sticky top-0 z-50">
        <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Poppins, sans-serif" }}>
          Profile
        </h1>
      </header>

      <div className="mx-4 mt-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #9A88FD, #7B65FC)" }}
            >
              <span
                className="text-white text-xl font-bold"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                {getInitials(profile?.full_name ?? null, user.email ?? null)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-bold text-gray-900 text-lg truncate"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                {profile?.full_name || "Your Name"}
              </p>
              <p className="text-sm text-gray-400 truncate">{user.email}</p>
              {profile?.agency_name && (
                <p className="text-xs text-[#9A88FD] font-medium mt-0.5">
                  🏢 {profile.agency_name}
                </p>
              )}
            </div>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full mt-4 py-2.5 rounded-xl border border-[#9A88FD] text-[#9A88FD] text-sm font-semibold transition-all active:scale-[0.98]"
            >
              Edit Profile
            </button>
          )}
        </div>

        {editing && (
          <div className="bg-white rounded-2xl p-4 mt-3 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Edit details
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className={inputClass}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Agency Name</label>
                <input
                  type="text"
                  value={form.agency_name}
                  onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                  className={inputClass}
                  placeholder="Your agency"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                  placeholder="+971 50 123 4567"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    full_name: profile?.full_name ?? "",
                    agency_name: profile?.agency_name ?? "",
                    phone: profile?.phone ?? "",
                  });
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#9A88FD] text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            { value: totalProperties, label: "Properties" },
            { value: totalInspections, label: "Inspections" },
            { value: totalReports, label: "Reports" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100"
            >
              <p
                className="text-2xl font-bold text-gray-900"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                {stat.value ?? 0}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-4 pt-4 pb-2">
            Settings
          </p>

          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">📱</span>
              <div>
                <p className="text-sm font-medium text-gray-800">Install App</p>
                <p className="text-xs text-gray-400">Add to home screen</p>
              </div>
            </div>
            <span className="text-xs text-[#9A88FD] font-semibold">Guide →</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">🌍</span>
              <p className="text-sm font-medium text-gray-800">Language</p>
            </div>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              English
            </span>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <p className="text-sm font-medium text-gray-800">Snagify</p>
                <p className="text-xs text-gray-400">Version 1.0.0 MVP</p>
              </div>
            </div>
            <span className="text-xs text-gray-400">snagify.net</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-500 font-semibold text-sm transition-all active:scale-[0.98] mt-4"
        >
          🚪 Sign Out
        </button>
      </div>

      {user.created_at && (
        <p className="text-center text-xs text-gray-300 mt-4 mb-8">
          Member since{" "}
          {new Date(user.created_at).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
    </main>
  );
}
