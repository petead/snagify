"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  full_name: string | null;
  agency_name: string | null;
  phone: string | null;
  job_title: string | null;
  whatsapp_number: string | null;
  rera_number: string | null;
  company_logo_url: string | null;
  company_website: string | null;
  company_address: string | null;
  company_trade_license: string | null;
  avatar_url: string | null;
  signature_image_url: string | null;
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
    company_website: "",
    company_address: "",
    company_trade_license: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
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
      .select("*")
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
        if (p) {
          setForm({
            full_name: p.full_name ?? "",
            job_title: p.job_title ?? "",
            phone: p.phone ?? "",
            whatsapp_number: p.whatsapp_number ?? "",
            rera_number: p.rera_number ?? "",
            agency_name: p.agency_name ?? "",
            company_website: p.company_website ?? "",
            company_address: p.company_address ?? "",
            company_trade_license: p.company_trade_license ?? "",
          });
          setAvatarUrl(p.avatar_url ?? null);
          setCompanyLogoUrl(p.company_logo_url ?? null);
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

  const handleFileUpload = async (kind: "avatar" | "company-logo" | "signature", file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(kind);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", kind);
    try {
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const url = data.url as string;
      if (kind === "avatar") setAvatarUrl(url);
      if (kind === "company-logo") setCompanyLogoUrl(url);
      if (kind === "signature") setSignatureImageUrl(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    const fullName = form.full_name.trim();
    const agencyName = form.agency_name.trim();
    if (!fullName || !agencyName) {
      alert("Full Name and Agency Name are required.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        job_title: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp_number: form.whatsapp_number.trim() || null,
        rera_number: form.rera_number.trim() || null,
        agency_name: agencyName || null,
        company_website: form.company_website.trim() || null,
        company_address: form.company_address.trim() || null,
        company_trade_license: form.company_trade_license.trim() || null,
        company_logo_url: companyLogoUrl,
        avatar_url: avatarUrl,
        signature_image_url: signatureImageUrl,
      })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setToast("Profile updated ✓");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Poppins', sans-serif" }}>
        <span style={{ color: "#999", fontSize: 15 }}>Loading…</span>
      </div>
    );
  }

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
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload("avatar", f);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={logoInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload("company-logo", f);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={signatureInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload("signature", f);
          e.target.value = "";
        }}
      />

      <div style={{ padding: "20px 16px" }}>
        {/* ─── PHOTO ─── */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
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
            }}
          >
            {uploading === "avatar" ? (
              <span style={{ fontSize: 18, color: "#fff" }}>…</span>
            ) : avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{initials}</span>
            )}
          </button>
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
            Change Photo
          </button>
        </div>

        {/* ─── YOUR IDENTITY ─── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ ...sectionLabelStyle, marginBottom: 8 }}>Your Identity</p>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
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
              <div>
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Job Title</label>
                <input
                  type="text"
                  value={form.job_title}
                  onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                  style={inputStyle}
                  placeholder="Property Agent"
                />
              </div>
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
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>WhatsApp</label>
                <input
                  type="tel"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
                  style={inputStyle}
                  placeholder="+971 50 000 0000"
                />
                <p style={{ fontSize: 10, color: "#999", marginTop: 4, marginBottom: 0 }}>Used to share reports</p>
              </div>
              <div>
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>RERA Number</label>
                <input
                  type="text"
                  value={form.rera_number}
                  onChange={(e) => setForm((f) => ({ ...f, rera_number: e.target.value }))}
                  style={inputStyle}
                  placeholder="RERA License No."
                />
                <p style={{ fontSize: 10, color: "#999", marginTop: 4, marginBottom: 0 }}>Your Dubai real estate license</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── YOUR COMPANY ─── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ ...sectionLabelStyle, marginBottom: 8 }}>Your Company</p>
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...sectionLabelStyle, marginBottom: 8, display: "block" }}>Company Logo</label>
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
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={companyLogoUrl} alt="Logo" style={{ maxHeight: 64, maxWidth: "100%", objectFit: "contain" }} />
                ) : (
                  <>
                    <span style={{ fontSize: 13, color: "#666", marginBottom: 2 }}>📎 Tap to upload your logo</span>
                    <span style={{ fontSize: 11, color: "#999" }}>PNG or JPG · Used in PDF reports</span>
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
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Agency Name *</label>
                <input
                  type="text"
                  value={form.agency_name}
                  onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                  style={inputStyle}
                  placeholder="Your agency"
                  required
                />
              </div>
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
                <label style={{ ...sectionLabelStyle, marginBottom: 6, display: "block" }}>Trade License</label>
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

        {/* ─── SIGNATURE (collapsible) ─── */}
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
