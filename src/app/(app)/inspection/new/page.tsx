"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasOverlapWarning } from "@/lib/tenancy";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type Step = 0 | 1 | 2 | 3 | 4;
type EntryMode = "upload" | "manual" | null;

interface FormData {
  inspectionType: "check-in" | "check-out";
  building_name: string;
  unit_number: string;
  address: string;
  property_type: string;
  property_size: string;
  ejari_ref: string;
  tenancy_type: string;
  contract_from: string;
  contract_to: string;
  annual_rent: string;
  security_deposit: string;
  landlord_name: string;
  landlord_email: string;
  landlord_phone: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
}

const emptyForm: FormData = {
  inspectionType: "check-in",
  building_name: "",
  unit_number: "",
  address: "",
  property_type: "",
  property_size: "",
  ejari_ref: "",
  tenancy_type: "standard",
  contract_from: "",
  contract_to: "",
  annual_rent: "",
  security_deposit: "",
  landlord_name: "",
  landlord_email: "",
  landlord_phone: "",
  tenant_name: "",
  tenant_email: "",
  tenant_phone: "",
};

// ─────────────────────────────────────────
// AI extraction mapper
// ─────────────────────────────────────────
function mapExtracted(raw: Record<string, unknown>): Partial<FormData> {
  const s = (k: string) => {
    const v = raw[k];
    return v != null && typeof v === "string" ? v : "";
  };
  const n = (k: string) => {
    const v = raw[k];
    if (v == null) return "";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return v.trim();
    return "";
  };
  const pt = s("property_type").toLowerCase();
  const property_type = pt.includes("villa")
    ? "Villa"
    : pt.includes("apartment") || pt.includes("flat")
      ? "Apartment"
      : pt.includes("studio")
        ? "Studio"
        : pt.includes("town")
          ? "Townhouse"
          : pt.includes("penthouse")
            ? "Penthouse"
            : "";
  const inspType = s("inspection_type").toLowerCase();
  const inspectionType: "check-in" | "check-out" = inspType.includes("out")
    ? "check-out"
    : "check-in";
  return {
    inspectionType,
    building_name: s("building_name"),
    unit_number: s("unit_number"),
    address: s("address"),
    property_type,
    property_size: n("property_size"),
    ejari_ref: s("ejari_ref"),
    contract_from: s("contract_from"),
    contract_to: s("contract_to"),
    annual_rent: n("annual_rent"),
    security_deposit: n("security_deposit"),
    landlord_name: s("landlord_name"),
    landlord_email: s("landlord_email"),
    landlord_phone: s("landlord_phone"),
    tenant_name: s("tenant_name"),
    tenant_email: s("tenant_email"),
    tenant_phone: s("tenant_phone"),
  };
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const stepTitles: Record<Step, string> = {
  0: "Start",
  1: "Contract Details",
  2: "Verify Info",
  3: "Rooms",
  4: "Ready to Start",
};

const ROOM_TEMPLATES: Record<string, string[]> = {
  Studio: ["Living/Bedroom", "Bathroom", "Kitchen"],
  "1 BR": ["Living Room", "Bedroom", "Bathroom", "Kitchen"],
  "2 BR": [
    "Living Room",
    "Master Bedroom",
    "Bedroom 2",
    "Bathroom 1",
    "Bathroom 2",
    "Kitchen",
  ],
  "3 BR": [
    "Living Room",
    "Master Bedroom",
    "Bedroom 2",
    "Bedroom 3",
    "Master Bathroom",
    "Bathroom 2",
    "Kitchen",
    "Laundry",
  ],
  Villa: [
    "Living Room",
    "Dining Room",
    "Master Bedroom",
    "Bedroom 2",
    "Bedroom 3",
    "Master Bathroom",
    "Bathroom 2",
    "Kitchen",
    "Garden",
    "Garage",
  ],
  Townhouse: [
    "Living Room",
    "Master Bedroom",
    "Bedroom 2",
    "Master Bathroom",
    "Bathroom 2",
    "Kitchen",
    "Terrace",
  ],
};

const ALL_ROOMS = [
  "Living Room",
  "Dining Room",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Master Bathroom",
  "Bathroom 2",
  "Kitchen",
  "Laundry",
  "Hallway",
  "Balcony",
  "Terrace",
  "Garden",
  "Garage",
  "Storage",
  "Maid's Room",
  "Living/Bedroom",
  "Study/Office",
];

const inputCls =
  "w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:border-[#9A88FD] focus:outline-none transition-colors bg-white";

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 mt-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[#9A88FD]">
        {title}
      </p>
      <div className="h-px bg-[#9A88FD]/20 mt-1" />
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="text-xs font-semibold text-gray-500 mb-1 block">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 max-w-lg mx-auto"
      style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────
function NewInspectionContent() {
  const searchParams = useSearchParams();
  const urlPropertyId = searchParams.get("propertyId");
  const urlTenancyId = searchParams.get("tenancyId");
  const urlType = searchParams.get("type");

  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(0);
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [customRoom, setCustomRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-fill inspection type from URL
  useEffect(() => {
    if (urlType === "check-in" || urlType === "check-out") {
      setFormData((d) => ({ ...d, inspectionType: urlType }));
    }
  }, [urlType]);

  // Skip step 1 when manual mode selected (go straight to form)
  useEffect(() => {
    if (step === 1 && entryMode === "manual") setStep(2);
  }, [step, entryMode]);

  const set = (k: keyof FormData, v: string) =>
    setFormData((d) => ({ ...d, [k]: v }));

  const handleBack = () => {
    if (step === 0) router.back();
    else if (step === 2 && entryMode === "manual") setStep(0);
    else setStep(((step - 1) as Step));
  };

  // ── PDF extraction
  const readBase64 = (file: File): Promise<{ data: string; mediaType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        const mediaType =
          file.type === "application/pdf"
            ? "application/pdf"
            : file.type.startsWith("image/")
              ? file.type
              : "image/jpeg";
        resolve({ data: base64, mediaType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleExtract = useCallback(
    async (file: File) => {
      setExtractError(null);
      setExtracting(true);
      try {
        const { data, mediaType } = await readBase64(file);
        const res = await fetch("/api/extract-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, mediaType }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || res.statusText
          );
        }
        const extracted = (await res.json()) as Record<string, unknown>;
        const mapped = mapExtracted(extracted);
        setFormData((d) => ({ ...d, ...mapped }));
        setTimeout(() => {
          setExtracting(false);
          setStep(2);
        }, 800);
      } catch (e) {
        setExtracting(false);
        setExtractError(
          e instanceof Error ? e.message : "Failed to read contract"
        );
      }
    },
    []
  );

  // ── Form validation
  const formValid =
    formData.building_name.trim() !== "" &&
    formData.unit_number.trim() !== "" &&
    formData.tenant_name.trim() !== "" &&
    formData.tenant_email.trim() !== "" &&
    formData.landlord_name.trim() !== "" &&
    formData.landlord_email.trim() !== "";

  // ── Continue from step 2 → pre-fill rooms by property type
  const handleContinueStep2 = () => {
    if (!formValid) return;
    if (selectedRooms.length === 0) {
      const pt = formData.property_type;
      const suggested =
        ROOM_TEMPLATES[pt] ||
        (pt === "Apartment"
          ? ROOM_TEMPLATES["2 BR"]
          : pt === "Studio"
            ? ROOM_TEMPLATES["Studio"]
            : []);
      if (suggested.length) setSelectedRooms(suggested);
    }
    setStep(3);
  };

  // ── Start inspection (existing logic, mapped from formData)
  const handleStartInspection = async () => {
    setSaveError(null);
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveError("You must be signed in.");
      setSaving(false);
      return;
    }

    const buildingName = formData.building_name.trim() || null;
    const unitNumber = formData.unit_number.trim() || null;
    const address =
      formData.address.trim() ||
      (buildingName && unitNumber
        ? `${buildingName}, Unit ${unitNumber}`
        : null);

    let propertyId: string;

    if (urlPropertyId) {
      propertyId = urlPropertyId;
    } else {
      let q = supabase.from("properties").select("id").eq("agent_id", user.id);
      q = buildingName
        ? q.eq("building_name", buildingName)
        : q.is("building_name", null);
      q = unitNumber
        ? q.eq("unit_number", unitNumber)
        : q.is("unit_number", null);
      const { data: existing } = await q.maybeSingle();

      if (existing?.id) {
        propertyId = existing.id;
      } else {
        const { data: prop, error: propErr } = await supabase
          .from("properties")
          .insert({
            agent_id: user.id,
            building_name: buildingName,
            unit_number: unitNumber,
            address,
            property_type: formData.property_type || null,
            furnished: false,
          })
          .select("id")
          .single();
        if (propErr || !prop) {
          setSaveError(propErr?.message ?? "Failed to create property.");
          setSaving(false);
          return;
        }
        propertyId = prop.id;
      }
    }

    // Overlap check
    try {
      const warning = await hasOverlapWarning(
        propertyId,
        formData.contract_from,
        supabase
      );
      if (warning) {
        const confirmed = window.confirm(
          `⚠️ ${warning}\n\nDo you want to continue anyway?`
        );
        if (!confirmed) {
          setSaving(false);
          return;
        }
      }
    } catch {
      // tenancies table may not exist; continue
    }

    // Tenancy
    let tenancyId: string | null = urlTenancyId ?? null;
    if (!tenancyId) {
      try {
        const { data: tenancy } = await supabase
          .from("tenancies")
          .insert({
            property_id: propertyId,
            agent_id: user.id,
            tenant_name: formData.tenant_name.trim() || "Unknown Tenant",
            tenant_email: formData.tenant_email.trim() || null,
            tenant_phone: formData.tenant_phone.trim() || null,
            landlord_name: formData.landlord_name.trim() || null,
            landlord_email: formData.landlord_email.trim() || null,
            landlord_phone: formData.landlord_phone.trim() || null,
            ejari_ref: formData.ejari_ref.trim() || null,
            tenancy_type: formData.tenancy_type || "standard",
            contract_from: formData.contract_from || null,
            contract_to: formData.contract_to || null,
            annual_rent: formData.annual_rent ? Number(formData.annual_rent) : null,
            security_deposit: formData.security_deposit
              ? Number(formData.security_deposit)
              : null,
            property_size: formData.property_size
              ? Number(formData.property_size)
              : null,
            status: "active",
          })
          .select("id")
          .single();
        if (tenancy?.id) tenancyId = tenancy.id;
      } catch {
        // continue without tenancy
      }
    }

    // Inspection
    const { data: insp, error: inspErr } = await supabase
      .from("inspections")
      .insert({
        property_id: propertyId,
        ...(tenancyId && { tenancy_id: tenancyId }),
        agent_id: user.id,
        type: formData.inspectionType,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (inspErr || !insp) {
      setSaveError(inspErr?.message ?? "Failed to create inspection.");
      setSaving(false);
      return;
    }

    // Rooms
    if (selectedRooms.length > 0) {
      const { error: roomsErr } = await supabase.from("rooms").insert(
        selectedRooms.map((name, i) => ({
          inspection_id: insp.id,
          name,
          order_index: i,
        }))
      );
      if (roomsErr) {
        setSaveError(roomsErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push(`/inspection/${insp.id}`);
    router.refresh();
  };

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto pb-32">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={handleBack}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              New Inspection
            </p>
            <p
              className="font-bold text-sm text-gray-900"
              style={{ fontFamily: "Poppins,sans-serif" }}
            >
              {stepTitles[step]}
            </p>
          </div>
          {/* Step dots */}
          <div className="flex gap-1 items-center">
            {([0, 1, 2, 3, 4] as Step[]).map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "w-6 bg-[#9A88FD]"
                    : i < step
                      ? "w-2 bg-[#cafe87]"
                      : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* STEP 0 — Choose entry mode */}
      {step === 0 && (
        <div className="px-4 pt-6">
          <h2
            className="text-xl font-bold mb-1"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            New Inspection
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            How do you want to add contract details?
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setEntryMode("upload");
                setStep(1);
              }}
              className="bg-white rounded-2xl border-2 border-[#9A88FD] p-5 text-left active:scale-[0.98] transition-transform shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#F0EDFF] flex items-center justify-center text-2xl flex-shrink-0">
                  📄
                </div>
                <div className="flex-1">
                  <p
                    className="font-bold text-gray-900"
                    style={{ fontFamily: "Poppins,sans-serif" }}
                  >
                    Upload Contract PDF
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    AI extracts all details automatically ✨
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  className="text-[#9A88FD] flex-shrink-0"
                />
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setEntryMode("manual");
                setStep(1);
              }}
              className="bg-white rounded-2xl border-2 border-gray-200 p-5 text-left active:scale-[0.98] transition-transform shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
                  ✍️
                </div>
                <div className="flex-1">
                  <p
                    className="font-bold text-gray-900"
                    style={{ fontFamily: "Poppins,sans-serif" }}
                  >
                    Enter Manually
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    No contract? Fill in details yourself
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  className="text-gray-300 flex-shrink-0"
                />
              </div>
            </button>
          </div>

          <div className="mt-6 bg-[#F0EDFF] rounded-xl p-3 flex gap-2">
            <span className="text-sm">💡</span>
            <p className="text-xs text-[#7B65FC]">
              Tip: Upload a PDF for faster setup — Claude reads Ejari
              contracts, standard RERA agreements and most UAE tenancy
              documents.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1 — Upload PDF */}
      {step === 1 && entryMode === "upload" && (
        <div className="px-4 pt-6">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleExtract(f);
              e.target.value = "";
            }}
          />

          {!extracting ? (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleExtract(f);
                }}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragging
                    ? "border-[#9A88FD] bg-[#F0EDFF] scale-[1.01]"
                    : "border-gray-200 bg-gray-50 hover:border-[#9A88FD] hover:bg-[#F0EDFF]"
                }`}
              >
                <div className="text-5xl mb-4">📄</div>
                <p
                  className="font-semibold text-gray-800 mb-1"
                  style={{ fontFamily: "Poppins,sans-serif" }}
                >
                  {dragging ? "📥 Drop it here!" : "Tap to upload"}
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  Ejari • RERA • Standard UAE tenancy agreement
                </p>
                <div className="inline-flex items-center gap-2 bg-[#9A88FD] text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                  Choose PDF
                </div>
              </div>

              {extractError && (
                <div className="mt-3 bg-red-50 text-red-500 text-sm rounded-xl p-3">
                  {extractError}
                </div>
              )}

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-300">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setEntryMode("manual");
                  setStep(2);
                }}
                className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-500 font-medium"
              >
                Enter details manually instead →
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-[#F0EDFF] flex items-center justify-center mx-auto mb-5 animate-bounce text-4xl">
                🤖
              </div>
              <p
                className="font-bold text-lg text-gray-900 mb-2"
                style={{ fontFamily: "Poppins,sans-serif" }}
              >
                Analyzing contract...
              </p>
              <p className="text-sm text-gray-400 text-center mb-6">
                Claude AI is reading your document
              </p>
              <div className="w-full max-w-xs space-y-2">
                {[
                  "Reading PDF structure...",
                  "Extracting tenant details...",
                  "Finding contract dates...",
                  "Identifying property info...",
                ].map((txt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-gray-100"
                  >
                    <div className="w-4 h-4 rounded-full bg-[#F0EDFF] flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-[#9A88FD] animate-pulse" />
                    </div>
                    <span className="text-xs text-gray-500">{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — Verify / Fill form */}
      {step === 2 && (
        <div className="px-4 pt-4 pb-28">
          {entryMode === "upload" && (
            <div className="bg-[#F0EDFF] rounded-xl p-3 mb-4 flex gap-2">
              <span className="text-sm">🤖</span>
              <p className="text-xs text-[#7B65FC]">
                Auto-filled from your contract — please verify
              </p>
            </div>
          )}

          {saveError && (
            <div className="bg-red-50 text-red-500 text-sm rounded-xl p-3 mb-4">
              {saveError}
            </div>
          )}

          {/* Inspection type */}
          <SectionHeader title="Inspection Type" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            {(["check-in", "check-out"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("inspectionType", t)}
                className={`h-12 rounded-xl font-semibold text-sm border-2 transition-all ${
                  formData.inspectionType === t
                    ? "bg-[#9A88FD] border-[#9A88FD] text-white"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                {t === "check-in" ? "🔑 Check-In" : "🚪 Check-Out"}
              </button>
            ))}
          </div>

          {/* Property */}
          <SectionHeader title="Property" />
          <Field label="Building / Community Name" required>
            <input
              value={formData.building_name}
              onChange={(e) => set("building_name", e.target.value)}
              placeholder="e.g. Marina Gate Tower 1"
              className={inputCls}
            />
          </Field>
          <Field label="Unit Number" required>
            <input
              value={formData.unit_number}
              onChange={(e) => set("unit_number", e.target.value)}
              placeholder="e.g. 2203"
              className={inputCls}
            />
          </Field>
          <Field label="Property Type" required>
            <select
              value={formData.property_type}
              onChange={(e) => set("property_type", e.target.value)}
              className={inputCls}
            >
              <option value="">Select type</option>
              {["Studio", "Apartment", "Villa", "Townhouse", "Penthouse"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
          </Field>
          <Field label="Area / District">
            <input
              value={formData.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="e.g. JBR, Dubai Marina"
              className={inputCls}
            />
          </Field>

          {/* Tenancy */}
          <SectionHeader title="Tenancy Details" />
          <Field label="Ejari Reference">
            <input
              value={formData.ejari_ref}
              onChange={(e) => set("ejari_ref", e.target.value)}
              placeholder="Optional"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required>
              <input
                type="date"
                value={formData.contract_from}
                onChange={(e) => set("contract_from", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="To" required>
              <input
                type="date"
                value={formData.contract_to}
                onChange={(e) => set("contract_to", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Annual Rent">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                AED
              </span>
              <input
                type="number"
                value={formData.annual_rent}
                onChange={(e) => set("annual_rent", e.target.value)}
                placeholder="0"
                className={`${inputCls} pl-14`}
              />
            </div>
          </Field>
          <Field label="Security Deposit">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                AED
              </span>
              <input
                type="number"
                value={formData.security_deposit}
                onChange={(e) => set("security_deposit", e.target.value)}
                placeholder="0"
                className={`${inputCls} pl-14`}
              />
            </div>
          </Field>

          {/* Tenant */}
          <SectionHeader title="Tenant" />
          <Field label="Full Name" required>
            <input
              value={formData.tenant_name}
              onChange={(e) => set("tenant_name", e.target.value)}
              placeholder="Full name"
              className={inputCls}
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              value={formData.tenant_email}
              onChange={(e) => set("tenant_email", e.target.value)}
              placeholder="tenant@email.com"
              className={inputCls}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={formData.tenant_phone}
              onChange={(e) => set("tenant_phone", e.target.value)}
              placeholder="+971 50 XXX XXXX"
              className={inputCls}
            />
          </Field>

          {/* Landlord */}
          <SectionHeader title="Landlord" />
          <Field label="Full Name" required>
            <input
              value={formData.landlord_name}
              onChange={(e) => set("landlord_name", e.target.value)}
              placeholder="Full name"
              className={inputCls}
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              value={formData.landlord_email}
              onChange={(e) => set("landlord_email", e.target.value)}
              placeholder="landlord@email.com"
              className={inputCls}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={formData.landlord_phone}
              onChange={(e) => set("landlord_phone", e.target.value)}
              placeholder="+971 50 XXX XXXX"
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {/* STEP 3 — Rooms */}
      {step === 3 && (
        <div className="pb-28">
          {/* Templates */}
          <div className="px-4 pt-5">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">
              Quick templates
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {Object.entries(ROOM_TEMPLATES).map(([name, rooms]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedRooms(rooms)}
                  className="text-xs px-4 py-2 rounded-full border border-[#9A88FD] text-[#9A88FD] font-semibold whitespace-nowrap hover:bg-[#F0EDFF] transition-colors flex-shrink-0"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Room chips */}
          <div className="px-4 mt-4">
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-semibold">
              Select rooms ({selectedRooms.length} selected)
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Standard options */}
              {ALL_ROOMS.map((room) => {
                const selected = selectedRooms.includes(room);
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() =>
                      setSelectedRooms((prev) =>
                        selected
                          ? prev.filter((r) => r !== room)
                          : [...prev, room]
                      )
                    }
                    className={`text-sm px-4 py-2 rounded-xl font-medium transition-all ${
                      selected
                        ? "bg-[#9A88FD] text-white shadow-sm"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-[#9A88FD]"
                    }`}
                  >
                    {room}
                  </button>
                );
              })}
              {/* Custom rooms not in the standard list */}
              {selectedRooms
                .filter((r) => !ALL_ROOMS.includes(r))
                .map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() =>
                      setSelectedRooms((prev) => prev.filter((r) => r !== room))
                    }
                    className="text-sm px-4 py-2 rounded-xl font-medium bg-[#9A88FD] text-white shadow-sm"
                  >
                    {room} ✕
                  </button>
                ))}
            </div>

            {/* Add custom */}
            <div className="mt-4 flex gap-2">
              <input
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                placeholder="+ Add custom room..."
                className="flex-1 h-11 px-4 rounded-xl border border-dashed border-gray-300 text-sm focus:border-[#9A88FD] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                className="w-11 h-11 rounded-xl bg-[#9A88FD] text-white font-bold text-lg"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 — Recap */}
      {step === 4 && (
        <div className="px-4 pt-5 pb-32">
          <h2
            className="text-xl font-bold mb-1"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            Ready to start! 🚀
          </h2>
          <p className="text-sm text-gray-400 mb-5">
            Review before launching the inspection
          </p>

          {saveError && (
            <div className="bg-red-50 text-red-500 text-sm rounded-xl p-3 mb-4">
              {saveError}
            </div>
          )}

          {/* Property */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
            <p className="text-xs font-bold text-[#9A88FD] uppercase tracking-wider mb-3">
              Property
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0EDFF] flex items-center justify-center text-xl">
                🏢
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  {formData.building_name}, Unit {formData.unit_number}
                </p>
                <p className="text-xs text-gray-400">
                  {formData.property_type}
                  {formData.address ? ` • ${formData.address}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Tenancy */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
            <p className="text-xs font-bold text-[#9A88FD] uppercase tracking-wider mb-3">
              Tenancy
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">Tenant</p>
                <p className="font-semibold text-gray-800 truncate">
                  {formData.tenant_name || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Landlord</p>
                <p className="font-semibold text-gray-800 truncate">
                  {formData.landlord_name || "—"}
                </p>
              </div>
              {formData.contract_from && (
                <div>
                  <p className="text-xs text-gray-400">From</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(formData.contract_from).toLocaleDateString(
                      "en-GB",
                      { day: "2-digit", month: "short", year: "numeric" }
                    )}
                  </p>
                </div>
              )}
              {formData.contract_to && (
                <div>
                  <p className="text-xs text-gray-400">To</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(formData.contract_to).toLocaleDateString(
                      "en-GB",
                      { day: "2-digit", month: "short", year: "numeric" }
                    )}
                  </p>
                </div>
              )}
              {formData.annual_rent && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Annual Rent</p>
                  <p className="font-semibold text-gray-800">
                    AED {Number(formData.annual_rent).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Rooms */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
            <p className="text-xs font-bold text-[#9A88FD] uppercase tracking-wider mb-3">
              Rooms ({selectedRooms.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedRooms.map((room) => (
                <span
                  key={room}
                  className="text-xs px-3 py-1 rounded-full bg-[#F0EDFF] text-[#7B65FC] font-medium"
                >
                  {room}
                </span>
              ))}
            </div>
          </div>

          {/* Estimated time */}
          <div className="bg-[#FEDE80]/30 rounded-xl p-3 flex items-center gap-3">
            <span className="text-xl">⏱️</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Estimated time: ~{Math.max(5, selectedRooms.length * 3)}{" "}
                minutes
              </p>
              <p className="text-xs text-gray-500">
                Based on {selectedRooms.length} rooms • 2-3 photos per room
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BUTTONS */}
      {step === 2 && (
        <BottomBar>
          <button
            type="button"
            onClick={handleContinueStep2}
            disabled={!formValid}
            className="w-full h-12 rounded-xl font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)", fontFamily: "Poppins,sans-serif" }}
          >
            Continue → Choose Rooms
          </button>
        </BottomBar>
      )}

      {step === 3 && (
        <BottomBar>
          <button
            type="button"
            onClick={() => setStep(4)}
            disabled={selectedRooms.length === 0}
            className="w-full h-12 rounded-xl font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)", fontFamily: "Poppins,sans-serif" }}
          >
            Continue → {selectedRooms.length} room
            {selectedRooms.length !== 1 ? "s" : ""} selected
          </button>
        </BottomBar>
      )}

      {step === 4 && (
        <BottomBar>
          <button
            type="button"
            onClick={handleStartInspection}
            disabled={saving}
            className="w-full h-12 rounded-xl font-bold text-gray-900 text-base active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ backgroundColor: "#cafe87", fontFamily: "Poppins,sans-serif" }}
          >
            {saving ? "Creating..." : "🚀 Start Inspection"}
          </button>
        </BottomBar>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Loading fallback
// ─────────────────────────────────────────
function NewInspectionLoading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#9A88FD] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export default function NewInspectionPage() {
  return (
    <Suspense fallback={<NewInspectionLoading />}>
      <NewInspectionContent />
    </Suspense>
  );
}
