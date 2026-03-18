"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressAvatar, compressLogo } from "@/lib/compressImage";
import type { Company } from "@/types";

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
  company?: (Company & { plan?: string | null }) | (Company & { plan?: string | null })[] | null;
};

interface EditProfileClientProps {
  userId: string;
  userEmail: string | null;
}

function getInitials(fullName: string | null, email: string | null): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.split("@")[0].slice(0, 2).toUpperCase();
  return "?";
}

const sectionLabelStyle: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  color: "#999",
  fontWeight: 600,
  letterSpacing: 0.5,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1.5px solid #e8e8e8",
  padding: "12px 14px",
  fontSize: 15,
  fontFamily: "'Poppins', sans-serif",
  color: "#1A1A1A",
  background: "#fff",
};

export function EditProfileClient({ userId, userEmail }: EditProfileClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    phone: "",
    whatsapp_number: "",
    rera_number: "",
    agency_name: "",
    company_primary_color: "#9A88FD",
    company_website: "",
    company_address: "",
    company_trade_license: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "company-logo" | "signature" | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*, company:companies(*)")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
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
            full_name: p.full_name ?? "",
            job_title: p.job_title ?? "",
            phone: p.phone ?? "",
            whatsapp_number: p.whatsapp_number ?? "",
            rera_number: p.rera_number ?? "",
            agency_name: company?.name ?? (p as { agency_name?: string }).agency_name ?? "",
            company_primary_color:
              company?.primary_color ?? (p as { company_primary_color?: string }).company_primary_color ?? "#9A88FD",
            company_website: company?.website ?? (p as { company_website?: string }).company_website ?? "",
            company_address: company?.address ?? (p as { company_address?: string }).company_address ?? "",
            company_trade_license:
              company?.trade_license ?? (p as { company_trade_license?: string }).company_trade_license ?? "",
          });
          setAvatarUrl(p.avatar_url ?? null);
          setCompanyLogoUrl(company?.logo_url ?? (p as { company_logo_url?: string }).company_logo_url ?? null);
          setSignatureImageUrl(p.signature_image_url ?? null);
        }
        setLoading(false);
      });
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

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading("avatar");
    try {
      const supabase = createClient();
      const compressed = await compressAvatar(file);
      const path = `${userId}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, {
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const urlWithCache = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCache })
        .eq("id", userId);

      setAvatarUrl(urlWithCache);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Avatar upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading("company-logo");
    try {
      const supabase = createClient();
      const isSvg = file.type === "image/svg+xml";
      const toUpload = isSvg ? file : await compressLogo(file);
      const ext = isSvg ? "svg" : "jpg";
      const path = `${userId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, toUpload, {
          upsert: true,
          contentType: isSvg ? "image/svg+xml" : "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("logos")
        .getPublicUrl(path);

      const urlWithCache = `${publicUrl}?t=${Date.now()}`;

      if (companyId) {
        await supabase
          .from("companies")
          .update({ logo_url: urlWithCache })
          .eq("id", companyId);
      }

      setCompanyLogoUrl(urlWithCache);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleSignatureUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading("signature");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", "signature");
    try {
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSignatureImageUrl(data.url as string);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Signature upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    const fullName = form.full_name.trim();
    if (!fullName) {
      alert("Full name is required.");
      return;
    }
    const isPro = profile?.account_type === "pro";
    if (isPro) {
      const agencyName = form.agency_name.trim();
      if (!agencyName) {
        alert("Agency name is required.");
        return;
      }
    }
    setSaving(true);
    const supabase = createClient();

    const profilePayload: Record<string, unknown> = {
      full_name: fullName || null,
      phone: form.phone.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      avatar_url: avatarUrl,
    };
    if (isPro) {
      profilePayload.job_title = form.job_title.trim() || null;
      profilePayload.rera_number = form.rera_number.trim() || null;
      profilePayload.signature_image_url = signatureImageUrl;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", userId);

    if (profileError) {
      setSaving(false);
      alert(profileError.message);
      return;
    }

    if (isPro && companyId) {
      const primaryColor = form.company_primary_color.trim() || "#9A88FD";
      const { error: companyError } = await supabase
        .from("companies")
        .update({
          name: form.agency_name.trim() || null,
          primary_color: primaryColor,
          logo_url: companyLogoUrl,
          website: form.company_website.trim() || null,
          address: form.company_address.trim() || null,
          trade_license: form.company_trade_license.trim() || null,
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
      <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Poppins', sans-serif" }}>
        <span style={{ color: "#999", fontSize: 15 }}>Loading…</span>
      </div>
    );
  }

  const isPro = profile?.account_type === "pro";
  const isIndividual = !isPro;
  const company = profile?.company
    ? Array.isArray(profile.company)
      ? profile.company[0]
      : profile.company
    : null;
  const planName = (company as { plan?: string | null })?.plan ?? "Free plan";
  const initials = getInitials((form.full_name || profile?.full_name) ?? null, userEmail);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        fontFamily: "'Poppins', sans-serif",
        paddingBottom: 140,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap');
      `}</style>

      {/* Header: back + title */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#f5f5f5",
          borderBottom: "1px solid #eee",
          padding: "14px 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/profile"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 12,
            color: "#1A1A1A",
            textDecoration: "none",
          }}
          aria-label="Back to profile"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>
          Edit Profile
        </h1>
      </div>

      <input
        type="file"
        ref={avatarInputRef}
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleAvatarUpload(f);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={logoInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleLogoUpload(f);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={signatureInputRef}
        accept="image/png"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleSignatureUpload(f);
          e.target.value = "";
        }}
      />

      <div style={{ padding: "20px 16px" }}>
        {/* ─── PHOTO ─── */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={!!uploading}
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                overflow: "hidden",
                border: "none",
                padding: 0,
                cursor: uploading === "avatar" ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: avatarUrl ? "transparent" : "#9A88FD",
                opacity: uploading === "avatar" ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{initials}</span>
              )}
            </button>
            {uploading === "avatar" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    border: "2px solid #9A88FD",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={!!uploading}
            style={{
              display: "block",
              marginTop: 8,
              marginLeft: "auto",
              marginRight: "auto",
              background: "none",
              border: "none",
              padding: 0,
              cursor: uploading === "avatar" ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: "#9A88FD",
            }}
          >
            {uploading === "avatar" ? "Uploading..." : "Change Photo"}
          </button>
          {/* Account type badge */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.3,
                ...(isPro
                  ? { background: "#EDE9FF", color: "#6D28D9" }
                  : { background: "#F3F4F6", color: "#6B7280" }),
              }}
            >
              {isPro ? `Pro · ${planName}` : "Property Owner"}
            </span>
            {isIndividual && (
              <Link
                href="/settings/billing"
                style={{ fontSize: 12, fontWeight: 600, color: "#9A88FD", textDecoration: "none" }}
              >
                Switch to Pro account →
              </Link>
            )}
          </div>
        </div>

        {/* ─── SECTION: YOUR PROFILE ─── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ ...sectionLabelStyle, marginBottom: 8 }}>YOUR PROFILE</p>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Full Name *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  style={inputStyle}
                  placeholder="Your name"
                  required
                />
              </div>
              {isPro && (
                <div>
                  <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Job Title</label>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                    style={inputStyle}
                    placeholder="Property Inspector"
                  />
                </div>
              )}
              <div>
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  style={inputStyle}
                  placeholder="+971 50 000 0000"
                />
              </div>
              <div>
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>WhatsApp number</label>
                <input
                  type="tel"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
                  style={inputStyle}
                  placeholder="+971 50 000 0000"
                />
                <p style={{ fontSize: 10, color: "#999", marginTop: 4, marginBottom: 0 }}>
                  Used to share inspection reports
                </p>
              </div>
              {isPro && (
                <div>
                  <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>RERA number</label>
                  <input
                    type="text"
                    value={form.rera_number}
                    onChange={(e) => setForm((f) => ({ ...f, rera_number: e.target.value }))}
                    style={inputStyle}
                    placeholder="RERA License No."
                  />
                  <p style={{ fontSize: 10, color: "#999", marginTop: 4, marginBottom: 0 }}>
                    Your Dubai real estate license
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── SECTION: AGENCY SETTINGS (Pro only) ─── */}
        {isPro && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ ...sectionLabelStyle, marginBottom: 4 }}>AGENCY SETTINGS</p>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              This branding will appear on all your inspection reports
            </p>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...sectionLabelStyle, marginBottom: 8, display: "block" }}>Agency name *</label>
                <input
                  type="text"
                  value={form.agency_name}
                  onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                  style={inputStyle}
                  placeholder="MULKEEF Real Estate"
                  required
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...sectionLabelStyle, marginBottom: 8, display: "block" }}>Primary color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={form.company_primary_color}
                    onChange={(e) => setForm((f) => ({ ...f, company_primary_color: e.target.value }))}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: "2px solid #e8e8e8",
                      padding: 2,
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  />
                  <input
                    type="text"
                    value={form.company_primary_color}
                    onChange={(e) => setForm((f) => ({ ...f, company_primary_color: e.target.value }))}
                    style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }}
                    placeholder="#9A88FD"
                  />
                </div>
                <p style={{ fontSize: 10, color: "#999", marginTop: 4, marginBottom: 0 }}>
                  Used on PDF report headers
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...sectionLabelStyle, marginBottom: 8, display: "block" }}>Logo</label>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={!!uploading}
                  style={{
                    width: "100%",
                    height: 80,
                    borderRadius: 12,
                    border: "2px dashed #e0e0e0",
                    background: companyLogoUrl ? "transparent" : "#fafafa",
                    cursor: uploading === "company-logo" ? "wait" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    padding: 8,
                  }}
                >
                  {uploading === "company-logo" ? (
                    <span style={{ fontSize: 13, color: "#999" }}>Uploading…</span>
                  ) : companyLogoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={companyLogoUrl} alt="Logo" style={{ maxHeight: 64, maxWidth: "100%", objectFit: "contain" }} />
                      <span style={{ fontSize: 12, color: "#9A88FD", fontWeight: 600, marginTop: 4 }}>Change</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, color: "#666", marginBottom: 2 }}>Tap to upload your logo</span>
                      <span style={{ fontSize: 11, color: "#999" }}>PNG, JPG, or SVG · Used in PDF reports</span>
                    </>
                  )}
                </button>
                {companyLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setCompanyLogoUrl(null)}
                    style={{
                      marginTop: 6,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#dc2626",
                      fontWeight: 600,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Website</label>
                  <input
                    type="url"
                    value={form.company_website}
                    onChange={(e) => setForm((f) => ({ ...f, company_website: e.target.value }))}
                    style={inputStyle}
                    placeholder="https://yourcompany.com"
                  />
                </div>
                <div>
                  <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Address</label>
                  <input
                    type="text"
                    value={form.company_address}
                    onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))}
                    style={inputStyle}
                    placeholder="Dubai, UAE"
                  />
                </div>
                <div>
                  <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Trade license</label>
                  <input
                    type="text"
                    value={form.company_trade_license}
                    onChange={(e) => setForm((f) => ({ ...f, company_trade_license: e.target.value }))}
                    style={inputStyle}
                    placeholder="DED Trade License No."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── INSPECTOR SIGNATURE (Pro only, collapsible) ─── */}
        {isPro && (
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setSignatureOpen((o) => !o)}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: 16,
              padding: "14px 16px",
              border: "1px solid #eee",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 14,
              fontWeight: 600,
              color: "#1A1A1A",
              fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            Inspector Signature
            <span style={{ color: "#999", fontSize: 16 }}>{signatureOpen ? "▼" : "›"}</span>
          </button>
          {signatureOpen && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginTop: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #eee" }}>
              {signatureImageUrl ? (
                <>
                  <div
                    style={{
                      width: "100%",
                      minHeight: 70,
                      maxHeight: 70,
                      border: "2px dashed #e0e0e0",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signatureImageUrl} alt="Signature" style={{ maxWidth: 160, maxHeight: 70, objectFit: "contain" }} />
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={!!uploading}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#9A88FD" }}
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignatureImageUrl(null)}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#dc2626" }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={!!uploading}
                  style={{
                    width: "100%",
                    minHeight: 70,
                    borderRadius: 12,
                    border: "2px dashed #e0e0e0",
                    background: "#fafafa",
                    cursor: uploading === "signature" ? "wait" : "pointer",
                    fontSize: 12,
                    color: "#666",
                  }}
                >
                  {uploading === "signature" ? "Uploading…" : "Upload your handwritten signature (PNG with transparent bg)"}
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Sticky Save button */}
      <div
        style={{
          position: "fixed",
          bottom: 72,
          left: 16,
          right: 16,
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            background: "#9A88FD",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: 16,
            fontFamily: "'Poppins', sans-serif",
            cursor: saving ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {saving ? (
            <>
              <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#16a34a",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 700,
            zIndex: 999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
