"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImageCropModal } from "@/components/ui/ImageCropModal";
import { InspectorSignaturePad } from "@/components/profile/InspectorSignaturePad";
import { ChevronLeft, Pencil, Loader2 } from "lucide-react";
import type { Company } from "@/types";
import {
  formatAccountTierLabel,
  formatProfileRoleLabel,
  normalizeAccountTier,
  normalizeProfileRole,
  type ProfileRole,
} from "@/lib/profileLabels";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  whatsapp_number: string | null;
  rera_number: string | null;
  avatar_url: string | null;
  signature_image_url: string | null;
  company_id: string | null;
  account_type?: "individual" | "pro" | null;
  /** owner | inspector (legacy DB may still have "agent", normalized in UI) */
  role?: ProfileRole | string | null;
  company?: (Company & { plan?: string | null }) | (Company & { plan?: string | null })[] | null;
};

interface EditProfileClientProps {
  userId: string;
  userEmail: string | null;
}

export function EditProfileClient({ userId, userEmail }: EditProfileClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: "",
    jobTitle: "",
    phone: "",
    whatsapp: "",
    reraNumber: "",
    agencyName: "",
    primaryColor: "#9A88FD",
    logoUrl: "",
    website: "",
    address: "",
    tradeLicense: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "logo" | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);

  const loadProfile = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*, company:companies(*)")
      .eq("id", userId)
      .single();

    if (error) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const p = data as ProfileRow | null;
    setProfile(p);
    const company = p?.company
      ? Array.isArray(p.company)
        ? (p.company[0] as Company)
        : (p.company as Company)
      : null;

    if (p) {
      setCompanyId(p.company_id ?? null);
      setForm({
        fullName: p.full_name ?? "",
        jobTitle: p.job_title ?? "",
        phone: p.phone ?? "",
        whatsapp: p.whatsapp_number ?? "",
        reraNumber: p.rera_number ?? "",
        agencyName: company?.name ?? "",
        primaryColor: company?.primary_color ?? "#9A88FD",
        logoUrl: company?.logo_url ?? "",
        website: company?.website ?? "",
        address: company?.address ?? "",
        tradeLicense: company?.trade_license ?? "",
      });
      setAvatarUrl(p.avatar_url ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
      router.push("/profile");
      router.refresh();
    }, 2000);
    return () => clearTimeout(t);
  }, [toast, router]);

  const handleAvatarPress = () => avatarInputRef.current?.click();
  const handleLogoPress = () => logoInputRef.current?.click();

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setAvatarCropSrc(url);
    e.target.value = "";
  };

  const handleAvatarCropConfirm = async (croppedFile: File) => {
    setAvatarCropSrc(null);
    setUploading("avatar");
    try {
      const supabase = createClient();
      const path = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, croppedFile, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const urlWithCache = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: urlWithCache }).eq("id", userId);
      setAvatarUrl(urlWithCache);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Avatar upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.type === "image/svg+xml") {
      void uploadLogoFile(file);
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setLogoCropSrc(url);
    e.target.value = "";
  };

  const uploadLogoFile = async (file: File) => {
    setUploading("logo");
    try {
      const supabase = createClient();
      const isSvg = file.type === "image/svg+xml";
      const ext = isSvg ? "svg" : "jpg";
      const path = `${userId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: isSvg ? "image/svg+xml" : "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
      const urlWithCache = `${publicUrl}?t=${Date.now()}`;
      if (companyId) {
        await supabase.from("companies").update({ logo_url: urlWithCache }).eq("id", companyId);
      }
      setForm(p => ({ ...p, logoUrl: urlWithCache }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleLogoCropConfirm = async (croppedFile: File) => {
    setLogoCropSrc(null);
    await uploadLogoFile(croppedFile);
  };

  const handleSignatureSave = async (dataUrl: string) => {
    try {
      // Convert dataUrl to blob
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const formData = new FormData();
      formData.append("signature", blob, "signature.png");

      // Use the server-side API route which uses service role key
      const res = await fetch("/api/profile/inspector-signature", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[handleSignatureSave]", err);
        return;
      }

      setShowSignaturePad(false);
      await loadProfile();
    } catch (e) {
      console.error("[handleSignatureSave]", e);
    }
  };

  const handleSave = async () => {
    const fullName = form.fullName.trim();
    if (!fullName) {
      alert("Full name is required.");
      return;
    }
    const isPro = profile?.account_type === "pro";
    if (isPro && !form.agencyName.trim()) {
      alert("Agency name is required.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const profilePayload: Record<string, unknown> = {
      full_name: fullName || null,
      phone: form.phone.trim() || null,
      whatsapp_number: form.whatsapp.trim() || null,
      avatar_url: avatarUrl,
    };
    if (isPro) {
      profilePayload.job_title = form.jobTitle.trim() || null;
      profilePayload.rera_number = form.reraNumber.trim() || null;
    }

    const { error: profileError } = await supabase.from("profiles").update(profilePayload).eq("id", userId);
    if (profileError) {
      setSaving(false);
      alert(profileError.message);
      return;
    }

    if (isPro && companyId) {
      const { error: companyError } = await supabase
        .from("companies")
        .update({
          name: form.agencyName.trim() || null,
          primary_color: form.primaryColor.trim() || "#9A88FD",
          logo_url: form.logoUrl || null,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
          trade_license: form.tradeLicense.trim() || null,
        })
        .eq("id", companyId);
      if (companyError) {
        setSaving(false);
        alert(companyError.message);
        return;
      }
    }

    setSaving(false);
    setToast("Profile updated ✓");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#9A88FD]" />
      </div>
    );
  }

  const isPro = profile?.account_type === "pro";
  const company = profile?.company
    ? Array.isArray(profile.company)
      ? profile.company[0]
      : profile.company
    : null;

  /** Subscription tier (not company Stripe plan — that lives in SubscriptionSection). */
  const accountTierLabel = formatAccountTierLabel(normalizeAccountTier(profile?.account_type));
  const roleLabel = formatProfileRoleLabel(normalizeProfileRole(profile?.role));
  const initials = form.fullName
    ? form.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : userEmail?.split("@")[0].slice(0, 2).toUpperCase() || "PA";

  return (
    <div className="min-h-screen bg-[#F8F7F4]" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom) + 80px)" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap');`}</style>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={avatarInputRef}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleAvatarFileSelect}
      />
      <input
        type="file"
        ref={logoInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleLogoFileSelect}
      />

      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white border border-[#EEECFF] flex items-center justify-center"
        >
          <ChevronLeft size={18} color="#1A1A2E" />
        </button>
        <h1
          className="text-[17px] font-extrabold text-[#1A1A2E]"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          Edit Profile
        </h1>
      </div>

      {/* ── HERO IDENTITY CARD ── */}
      <div className="mx-4 mt-3 bg-[#1A1A2E] rounded-3xl p-6 relative overflow-hidden">
        {/* Deco */}
        <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-[#9A88FD]/10" />
        <div className="absolute -left-3 -bottom-5 w-14 h-14 rounded-full bg-[#9A88FD]/[0.06]" />

        <div className="flex items-center gap-4 relative z-10">
          {/* Avatar with edit button */}
          <div className="relative flex-shrink-0">
            <div className="w-[72px] h-[72px] rounded-full border-[3px] border-white/15 overflow-hidden bg-[#9A88FD] flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[24px] font-extrabold text-white">{initials}</span>
              )}
            </div>
            <button
              onClick={handleAvatarPress}
              disabled={uploading === "avatar"}
              className="absolute bottom-0 right-0 w-6 h-6 bg-[#9A88FD] rounded-full border-2 border-[#1A1A2E] flex items-center justify-center"
            >
              <Pencil size={10} color="white" />
            </button>
          </div>

          {/* Name + company + role */}
          <div className="flex-1 min-w-0">
            <div
              className="text-[18px] font-extrabold text-white truncate"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              {form.fullName || "Your name"}
            </div>
            <div className="text-[13px] text-white/50 mb-2">
              {form.agencyName || "Your agency"}
            </div>
            {/* Role pill */}
            <div className="inline-flex items-center gap-1.5 bg-[#9A88FD]/20 border border-[#9A88FD]/30 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9A88FD]" />
              <span className="text-[11px] font-bold text-[#9A88FD] uppercase tracking-wider">
                {roleLabel} · {accountTierLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── YOUR PROFILE section ── */}
      <div className="mx-4 mt-5">
        <p className="text-[11px] font-bold text-[#9B9BA8] uppercase tracking-widest mb-2.5 pl-1">
          Your profile
        </p>
        <div className="bg-white rounded-2xl overflow-hidden border border-[#EEECFF]/60">
          {/* Full name */}
          <div className="px-4 pt-4 pb-3 border-b border-[#F3F3F8]">
            <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
              Full name *
            </label>
            <input
              value={form.fullName}
              onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              className="w-full text-[15px] font-semibold text-[#1A1A2E] bg-transparent border-none outline-none"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Job title */}
          {isPro && (
            <div className="px-4 pt-3 pb-3 border-b border-[#F3F3F8]">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
                Job title
              </label>
              <input
                value={form.jobTitle}
                onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))}
                placeholder="Property Inspector"
                className="w-full text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none placeholder:text-[#C4C4C4]"
                style={{ fontSize: "16px" }}
              />
            </div>
          )}

          {/* Phone */}
          <div className="px-4 pt-3 pb-3 border-b border-[#F3F3F8]">
            <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
              Phone
            </label>
            <input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              type="tel"
              className="w-full text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* WhatsApp */}
          <div className="px-4 pt-3 pb-3 border-b border-[#F3F3F8]">
            <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
              WhatsApp
            </label>
            <input
              value={form.whatsapp}
              onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
              placeholder="+971 50 000 0000"
              type="tel"
              className="w-full text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none placeholder:text-[#C4C4C4]"
              style={{ fontSize: "16px" }}
            />
            <p className="text-[11px] text-[#C4C4C4] mt-1">
              Used to share inspection reports
            </p>
          </div>

          {/* RERA */}
          {isPro && (
            <div className="px-4 pt-3 pb-4">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
                RERA number
              </label>
              <input
                value={form.reraNumber}
                onChange={e => setForm(p => ({ ...p, reraNumber: e.target.value }))}
                placeholder="RERA License No."
                className="w-full text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none placeholder:text-[#C4C4C4]"
                style={{ fontSize: "16px" }}
              />
              <p className="text-[11px] text-[#C4C4C4] mt-1">
                Your Dubai real estate license
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── AGENCY BRANDING section ── */}
      {isPro && (
        <div className="mx-4 mt-5">
          <p className="text-[11px] font-bold text-[#9B9BA8] uppercase tracking-widest mb-1 pl-1">
            Agency branding
          </p>
          <p className="text-[12px] text-[#9B9BA8] mb-2.5 pl-1">
            Appears on all your inspection reports
          </p>
          <div className="bg-white rounded-2xl overflow-hidden border border-[#EEECFF]/60">
            {/* Agency name */}
            <div className="px-4 pt-4 pb-3 border-b border-[#F3F3F8]">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
                Agency name *
              </label>
              <input
                value={form.agencyName}
                onChange={e => setForm(p => ({ ...p, agencyName: e.target.value }))}
                className="w-full text-[15px] font-semibold text-[#1A1A2E] bg-transparent border-none outline-none"
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Primary color */}
            <div className="px-4 pt-3 pb-3 border-b border-[#F3F3F8]">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
                Primary color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))}
                  className="w-9 h-9 rounded-xl border-2 border-gray-100 cursor-pointer bg-transparent"
                />
                <input
                  value={form.primaryColor}
                  onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))}
                  className="flex-1 text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none font-mono"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <p className="text-[11px] text-[#C4C4C4] mt-1">
                Used on PDF report headers and emails
              </p>
            </div>

            {/* Logo */}
            <div className="px-4 pt-3 pb-4 border-b border-[#F3F3F8]">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-3">
                Logo
              </label>
              <div className="border-2 border-dashed border-[#DDD6FE] rounded-2xl p-5 flex flex-col items-center gap-2 bg-[#FAFAFE]">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="logo" className="w-16 h-16 rounded-xl object-contain" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#EDE9FF] flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        stroke="#9A88FD"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                )}
                <button
                  onClick={handleLogoPress}
                  disabled={uploading === "logo"}
                  className="text-[13px] font-bold text-[#9A88FD]"
                >
                  {uploading === "logo" ? "Uploading..." : form.logoUrl ? "Change logo" : "Upload logo"}
                </button>
                {form.logoUrl && (
                  <button
                    onClick={() => setForm(p => ({ ...p, logoUrl: "" }))}
                    className="text-[11px] text-[#9B9BA8]"
                  >
                    Reset to default
                  </button>
                )}
              </div>
            </div>

            {/* Website */}
            <div className="px-4 pt-3 pb-3 border-b border-[#F3F3F8]">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
                Website
              </label>
              <input
                value={form.website}
                onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                placeholder="www.agency.com"
                className="w-full text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none placeholder:text-[#C4C4C4]"
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Address */}
            <div className="px-4 pt-3 pb-3 border-b border-[#F3F3F8]">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
                Address
              </label>
              <input
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Dubai, UAE"
                className="w-full text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none placeholder:text-[#C4C4C4]"
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Trade license */}
            <div className="px-4 pt-3 pb-4">
              <label className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide block mb-1.5">
                Trade license
              </label>
              <input
                value={form.tradeLicense}
                onChange={e => setForm(p => ({ ...p, tradeLicense: e.target.value }))}
                placeholder="DED Trade License No."
                className="w-full text-[15px] text-[#1A1A2E] bg-transparent border-none outline-none placeholder:text-[#C4C4C4]"
                style={{ fontSize: "16px" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── SIGNATURE section ── */}
      {isPro && (
        <div className="mx-4 mt-5 mb-4">
          <p className="text-[11px] font-bold text-[#9B9BA8] uppercase tracking-widest mb-2.5 pl-1">
            Signature
          </p>
          <div className="bg-white rounded-2xl border border-[#EEECFF]/60">
            <button
              onClick={() => setShowSignaturePad(true)}
              className="w-full flex items-center gap-4 px-4 py-4"
            >
              <div className="w-10 h-10 bg-[#EDE9FF] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                    stroke="#9A88FD"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Preview or placeholder */}
              <div className="flex-1 text-left">
                <div className="text-[14px] font-semibold text-[#1A1A2E]">
                  Inspector signature
                </div>
                {profile?.signature_image_url ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                    <span className="text-[11px] text-[#16A34A] font-medium">
                      Signature saved — tap to update
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#9B9BA8]">
                    Tap to draw your signature
                  </span>
                )}
              </div>

              {/* Signature preview thumbnail */}
              {profile?.signature_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.signature_image_url}
                  alt="signature"
                  className="w-20 h-10 object-contain border border-[#F3F3F8] rounded-lg bg-[#FAFAFE]"
                />
              )}

              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="#C4C4C4" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Save button */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#F3F2EF] border-t border-gray-100 px-5 pt-3"
        style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom) + 8px)" }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#9A88FD] text-white rounded-2xl py-4 text-[16px] font-extrabold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : "Save changes"}
        </button>
      </div>

      {/* Signature pad modal */}
      {profile?.account_type === "pro" && showSignaturePad && (
        <InspectorSignaturePad
          existingUrl={profile?.signature_image_url}
          onSave={handleSignatureSave}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-[#16a34a] text-white px-5 py-2.5 rounded-full text-[13px] font-bold z-[999] shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Avatar Crop Modal */}
      {avatarCropSrc && (
        <ImageCropModal
          imageSrc={avatarCropSrc}
          shape="circle"
          title="Crop Profile Photo"
          onConfirm={handleAvatarCropConfirm}
          onCancel={() => {
            URL.revokeObjectURL(avatarCropSrc);
            setAvatarCropSrc(null);
          }}
        />
      )}

      {/* Logo Crop Modal */}
      {logoCropSrc && (
        <ImageCropModal
          imageSrc={logoCropSrc}
          shape="square"
          title="Crop Company Logo"
          onConfirm={handleLogoCropConfirm}
          onCancel={() => {
            URL.revokeObjectURL(logoCropSrc);
            setLogoCropSrc(null);
          }}
        />
      )}
    </div>
  );
}
