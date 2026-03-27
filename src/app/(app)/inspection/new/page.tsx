"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  PenLine,
  Building2,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type Step = 0 | 1 | 2 | 3 | 4 | 5;
type Mode = "upload" | "manual" | null;

interface FormData {
  inspectionType: "check-in" | "check-out";
  building_name: string;
  unit_number: string;
  location: string;
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

type ExistingProperty = {
  id: string;
  building_name: string | null;
  unit_number: string | null;
  property_type: string | null;
  location: string | null;
};

const emptyForm: FormData = {
  inspectionType: "check-in",
  building_name: "",
  unit_number: "",
  location: "",
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
// Phone normalization (UAE)
// ─────────────────────────────────────────
const normalizePhone = (raw: string): string => {
  if (!raw) return "";

  let cleaned = raw.replace(/[\s\-\.\(\)]/g, "");
  cleaned = cleaned.replace(/^0+/, "");

  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("971")) return "+" + cleaned;
  if (cleaned.startsWith("00971")) return "+" + cleaned.slice(2);
  if (cleaned.length === 9 && /^[524679]/.test(cleaned)) return "+971" + cleaned;
  if (cleaned.length === 10 && cleaned.startsWith("5")) return "+971" + cleaned;

  return cleaned.startsWith("+") ? cleaned : "+" + cleaned;
};

// ─────────────────────────────────────────
// Date / number normalizers for DB
// ─────────────────────────────────────────
const normalizeDate = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    return `${y}-${m}-${d}`;
  }
  return null;
};

const cleanNumber = (val: unknown): number | null => {
  if (val == null) return null;
  const n = Number(String(val).replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? null : n;
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
    // location is the physical area/district/location as written in the contract
    // (fallbacks kept for backward compatibility with older extraction output)
    location:
      s("location") || s("area") || s("district"),
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
  3: "Room Selection",
  4: "Furnished Setup",
  5: "Key Handover",
};

const HANDOVER_ITEMS = [
  { id: "door_keys", label: "Door Keys" },
  { id: "mailbox_key", label: "Mailbox Key" },
  { id: "parking_card", label: "Parking Card" },
  { id: "access_card", label: "Access Card" },
  { id: "ac_remote", label: "AC Remote" },
  { id: "gate_remote", label: "Gate Remote" },
  { id: "intercom", label: "Intercom" },
];

const ROOM_TEMPLATES: Record<string, string[]> = {
  "Studio":    ["Entrance", "Living / Bedroom", "Kitchen", "Bathroom 1", "Balcony"],
  "1 BR":      ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bathroom 1", "Balcony"],
  "2 BR":      ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bathroom 1", "Bathroom 2", "Balcony"],
  "3 BR":      ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Balcony"],
  "4 BR":      ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Balcony", "Maid's Room"],
  "5 BR":      ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Bathroom 5", "Balcony", "Maid's Room", "Laundry"],
  "6 BR":      ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bedroom 6", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Bathroom 5", "Bathroom 6", "Balcony", "Maid's Room", "Laundry", "Storage"],
  "Villa":     ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Garden", "Garage", "Maid's Room", "Laundry", "Storage"],
  "Townhouse": ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Terrace", "Garage"],
};

const ALL_ROOMS = [
  "Entrance", "Living Room", "Dining Room",
  "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bedroom 6",
  "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Bathroom 5", "Bathroom 6",
  "Kitchen", "Laundry", "Storage", "Maid's Room",
  "Balcony", "Terrace", "Garden", "Garage",
  "Living / Bedroom", "Study / Office",
];

const inputCls =
  "w-full h-11 px-4 rounded-xl border border-gray-200 text-base focus:border-[#9A88FD] focus:outline-none transition-colors bg-white";

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
      className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 max-w-lg mx-auto"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
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
  const existingPropertyId = searchParams.get("propertyId");
  const urlTenancyId = searchParams.get("tenancyId");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    existingPropertyId
  );

  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(existingPropertyId ? 1 : 0);
  const [mode, setMode] = useState<Mode>(existingPropertyId ? "upload" : null);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    id: string;
    building_name: string;
    unit_number: string;
    location?: string | null;
  }[] | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [existingProperty, setExistingProperty] = useState<ExistingProperty | null>(null);
  const [propertyMismatch, setPropertyMismatch] = useState(false);

  // Room selector state (used in recap step)
  const [selectedType, setSelectedType] = useState<string | null>("Studio");
  const [selectedRooms, setSelectedRooms] = useState<string[]>(ROOM_TEMPLATES["Studio"]);
  const [customRoom, setCustomRoom] = useState("");

  // Furnished setup state (step 4)
  const [isFurnished, setIsFurnished] = useState<boolean | null>(null);
  const [wantsInventory, setWantsInventory] = useState<boolean>(false);

  // Key handover state (step 5)
  const [keyHandover, setKeyHandover] = useState<{ item: string; qty: number }[]>([]);
  const [customItemInput, setCustomItemInput] = useState("");

  const toggleRoom = (room: string) =>
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]
    );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);


  useEffect(() => {
    if (!selectedPropertyId) return;
    const fetchProperty = async () => {
      const client = createClient();
      const { data } = await client
        .from("properties")
        .select("id, building_name, unit_number, property_type, location")
        .eq("id", selectedPropertyId)
        .single();
      if (data) {
        const property = data as ExistingProperty;
        setExistingProperty(property);
        setFormData((prev) => ({
          ...prev,
          building_name: property.building_name ?? "",
          unit_number: property.unit_number ?? "",
          property_type: property.property_type ?? "",
          location: property.location ?? "",
        }));
        setMode("upload");
        setStep(1);
      }
    };
    void fetchProperty();
  }, [selectedPropertyId]);

  const set = (k: keyof FormData, v: string) =>
    setFormData((d) => ({ ...d, [k]: v }));


  const handleBack = () => {
    if (step === 0) router.back();
    else if (step === 2 && mode === "manual") setStep(0);
    else setStep((step - 1) as Step);
  };

  // ── PDF extraction: ONLY pre-fills form state; no DB write until "Start Inspection"
  const handleExtractContract = useCallback(async (file: File) => {
    setExtractError(null);
    setExtracting(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const res = await fetch("/api/extract-contract", {
        method: "POST",
        body: formDataUpload,
      });

      const extracted = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          (extracted as { error?: string }).error || res.statusText
        );
      }

      // PRE-FILL form state with extracted data; user can override before submitting
      const mapped = mapExtracted(extracted);
      setFormData((d) => {
        const next = {
          ...d,
          ...mapped,
          ...(existingProperty
            ? {}
            : {
                building_name: mapped.building_name || d.building_name || "",
                unit_number: mapped.unit_number || d.unit_number || "",
                property_type: mapped.property_type || d.property_type || "",
                location: mapped.location || d.location || "",
              }),
          ejari_ref: mapped.ejari_ref || d.ejari_ref || "",
          contract_from: mapped.contract_from || d.contract_from || "",
          contract_to: mapped.contract_to || d.contract_to || "",
          annual_rent: mapped.annual_rent || d.annual_rent || "",
          security_deposit: mapped.security_deposit || d.security_deposit || "",
          tenant_name: mapped.tenant_name || d.tenant_name || "",
          tenant_email: mapped.tenant_email || d.tenant_email || "",
          tenant_phone: mapped.tenant_phone || d.tenant_phone || "",
          landlord_name: mapped.landlord_name || d.landlord_name || "",
          landlord_email: mapped.landlord_email || d.landlord_email || "",
          landlord_phone: mapped.landlord_phone || d.landlord_phone || "",
        };
        if (
          existingProperty &&
          typeof mapped.unit_number === "string" &&
          mapped.unit_number.trim() &&
          mapped.unit_number.trim() !== (existingProperty.unit_number ?? "")
        ) {
          setPropertyMismatch(true);
          console.warn(
            "PDF unit mismatch:",
            mapped.unit_number,
            "vs",
            existingProperty.unit_number
          );
        } else {
          setPropertyMismatch(false);
        }
        return {
          ...next,
          tenant_phone: normalizePhone(next.tenant_phone || ""),
          landlord_phone: normalizePhone(next.landlord_phone || ""),
        };
      });

      setStep(2);
    } catch (e) {
      console.error("Extraction error:", e);
      setExtractError(
        e instanceof Error ? e.message : "Could not extract contract data. Please fill in manually."
      );
      setStep(2);
    } finally {
      setExtracting(false);
    }
  }, [existingProperty]);

  // ── Form validation
  const formValid =
    formData.building_name.trim() !== "" &&
    formData.unit_number.trim() !== "" &&
    formData.tenant_name.trim() !== "" &&
    formData.tenant_email.trim() !== "" &&
    formData.landlord_name.trim() !== "" &&
    formData.landlord_email.trim() !== "";

  const handleContinueStep2 = () => {
    if (!formValid) return;
    setStep(3);
  };

  const checkTenancyConflict = async (): Promise<boolean> => {
    const tenantEmail = formData.tenant_email?.trim().toLowerCase();
    if (!tenantEmail) return false;

    // Determine the property we're creating for
    const currentPropertyId = existingProperty?.id ?? null;

    // Only warn if this tenant has an active tenancy on THIS SAME property
    // without a completed check-out — not on other properties
    const query = supabase
      .from("tenancies")
      .select("id, property_id")
      .eq("tenant_email", tenantEmail)
      .eq("status", "active");

    // If we know the property, scope to it
    if (currentPropertyId) {
      query.eq("property_id", currentPropertyId);
    } else {
      // New property — no conflict possible, tenant never had this property
      return false;
    }

    const { data: existingTenancies } = await query;
    if (!existingTenancies || existingTenancies.length === 0) return false;

    const tenancyIds = existingTenancies.map((t) => t.id);

    const { data: checkIns } = await supabase
      .from("inspections")
      .select("id, tenancy_id, type, status")
      .in("tenancy_id", tenancyIds)
      .eq("type", "check-in")
      .in("status", ["completed", "signed"]);

    if (!checkIns || checkIns.length === 0) return false;

    for (const checkIn of checkIns) {
      const { data: checkOut } = await supabase
        .from("inspections")
        .select("id, status")
        .eq("tenancy_id", checkIn.tenancy_id)
        .eq("type", "check-out")
        .in("status", ["completed", "signed"])
        .maybeSingle();

      if (!checkOut) return true;
    }
    return false;
  };

  // ── Start inspection: formData (user-validated) is the only source of truth for DB
  const handleStartInspection = async (forcedPropertyId?: string) => {
    setSaveError(null);
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaveError("You must be signed in.");
        setSaving(false);
        return;
      }
      if (!user.id) {
        alert("User session expired. Please refresh.");
        setSaving(false);
        return;
      }

      // Tenancy conflict check: warn only if tenant has completed check-in without check-out
      try {
        const hasConflict = await checkTenancyConflict();
        if (hasConflict) {
          const confirmed = window.confirm(
            `${formData.tenant_name} has an active tenancy without a completed check-out.\n\nDo you want to continue anyway?`
          );
          if (!confirmed) {
            setSaving(false);
            return;
          }
        }
      } catch {
        // tenancies/inspections tables may not exist; continue
      }

      const propertyType =
        (formData.property_type || "apartment")
          .toLowerCase()
          .replace("appartement", "apartment")
          .replace("villa", "villa")
          .replace("townhouse", "townhouse") || "apartment";

      let propertyId = forcedPropertyId ?? selectedPropertyId;
      if (!propertyId) {
        // 1) Check for fuzzy duplicates before creating a property
        const dupeRes = await fetch("/api/properties/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            building_name: formData.building_name,
            unit_number: formData.unit_number,
          }),
        });
        const dupeJson = (await dupeRes.json()) as {
          duplicates?: Array<{
            id: string;
            building_name: string | null;
            unit_number: string | null;
            location?: string | null;
          }>;
        };

        if (dupeJson.duplicates && dupeJson.duplicates.length > 0 && !pendingSubmit) {
          setDuplicateWarning(
            dupeJson.duplicates.map((d) => ({
              id: d.id,
              building_name: d.building_name ?? "Unknown building",
              unit_number: d.unit_number ?? "—",
              location: d.location ?? null,
            }))
          );
          setSaving(false);
          return;
        }

        // 2) Continue with creation (reset bypass flag)
        setPendingSubmit(false);

        // Property: insert from formData only
        const { data: property, error: propError } = await supabase
          .from("properties")
          .insert({
            agent_id: user.id,
            building_name: formData.building_name,
            unit_number: formData.unit_number,
            property_type: propertyType,
            location: formData.location,
          })
          .select()
          .single();

        if (propError) {
          console.error("Property insert error:", propError);
          if (
            // unique constraint on normalized_key (building_name + unit_number)
            (propError as { code?: string }).code === "23505" &&
            (propError as { message?: string }).message?.includes("properties_unique_normalized")
          ) {
            setSaveError(
              "A property with this building name and unit number already exists in your portfolio."
            );
            setSaving(false);
            return;
          }
          throw propError;
        }
        propertyId = property.id;
        setSelectedPropertyId(property.id);
      }

      // Tenancy: insert from formData only
      const { data: tenancy, error: tenError } = await supabase
        .from("tenancies")
        .insert({
          property_id: propertyId,
          agent_id: user.id,
          tenant_name: formData.tenant_name,
          tenant_email: formData.tenant_email || "",
          tenant_phone: formData.tenant_phone,
          landlord_name: formData.landlord_name,
          landlord_email: formData.landlord_email || "",
          landlord_phone: formData.landlord_phone,
          ejari_ref: formData.ejari_ref,
          contract_from: normalizeDate(formData.contract_from),
          contract_to: normalizeDate(formData.contract_to),
          annual_rent: cleanNumber(formData.annual_rent),
          security_deposit: cleanNumber(formData.security_deposit),
          tenancy_type: "standard",
          status: "active",
          is_furnished: isFurnished ?? false,
        })
        .select()
        .single();

      if (tenError) {
        console.error("Tenancy insert error:", tenError);
        throw tenError;
      }

      // Inspection
      const { data: inspection, error: inspError } = await supabase
        .from("inspections")
        .insert({
          property_id: propertyId,
          tenancy_id: tenancy.id,
          agent_id: user.id,
          type: "check-in",
          status: "in_progress",
          key_handover: keyHandover.length > 0 ? keyHandover : [],
        })
        .select()
        .single();

      if (inspError) {
        console.error("Inspection insert error:", inspError);
        throw inspError;
      }

      // Insert rooms selected by user
      if (selectedRooms.length > 0) {
        const roomInserts = selectedRooms.map((name, i) => ({
          inspection_id: inspection.id,
          name,
          order_index: i,
        }));
        await supabase.from("rooms").insert(roomInserts);
      }

      router.push(`/inspection/${inspection.id}?autostart=1&wants_inventory=${wantsInventory ? "1" : "0"}`);
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      console.error("=== INSPECTION CREATION ERROR ===");
      console.error("Error object:", err);
      console.error("Error message:", e?.message);
      console.error("Error details:", e?.details);
      console.error("Error hint:", e?.hint);
      console.error("Error code:", e?.code);
      console.error("formData at time of error:", JSON.stringify(formData, null, 2));

      const displayMessage =
        e?.message || e?.details || (typeof err === "object" ? JSON.stringify(err) : String(err));
      setSaveError(displayMessage);
      alert(`Error: ${displayMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F7F4] max-w-lg mx-auto pb-48">
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
              New Check-in
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
            {([0, 1, 2, 3, 4, 5] as Step[]).map((i) => (
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
            New Check-in
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            How do you want to set up this check-in?
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setMode("upload");
                setStep(1);
              }}
              className="bg-white rounded-2xl border-2 border-[#9A88FD] p-5 text-left active:scale-[0.98] transition-transform shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#F0EDFF] flex items-center justify-center text-2xl flex-shrink-0">
                  <FileText size={24} color="#7B65FC" />
                </div>
                <div className="flex-1">
                  <p
                    className="font-bold text-gray-900"
                    style={{ fontFamily: "Poppins,sans-serif" }}
                  >
                    Upload Contract PDF
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    AI extracts all details automatically
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
                setMode("manual");
                setStep(2);
              }}
              className="bg-white rounded-2xl border-2 border-gray-200 p-5 text-left active:scale-[0.98] transition-transform shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
                  <PenLine size={24} color="#16a34a" />
                </div>
                <div className="flex-1">
                  <p
                    className="font-bold text-gray-900"
                    style={{ fontFamily: "Poppins,sans-serif" }}
                  >
                    Enter Manually
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    No contract? Fill in the details manually
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
              Tip: Upload a PDF for faster setup — AI reads Ejari contracts,
              standard RERA agreements and most UAE tenancy documents and
              auto-fills the check-in details.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1 — Upload PDF */}
      {step === 1 && mode === "upload" && (
        <div className="px-4 pt-6">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleExtractContract(f);
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
                  if (f) handleExtractContract(f);
                }}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragging
                    ? "border-[#9A88FD] bg-[#F0EDFF] scale-[1.01]"
                    : "border-gray-200 bg-gray-50 hover:border-[#9A88FD] hover:bg-[#F0EDFF]"
                }`}
              >
                <div className="text-5xl mb-4 flex justify-center"><FileText size={40} color="#7B65FC" /></div>
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
                  setMode("manual");
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
                AI is reading your document
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
        <div className="px-4 pt-4 pb-44">
          {mode === "upload" && (
            <div className="bg-[#F0EDFF] rounded-xl p-3 mb-4 flex gap-2">
              <span className="text-sm">🤖</span>
              <p className="text-xs text-[#7B65FC]">
                Auto-filled from your contract — please verify
              </p>
            </div>
          )}
          {propertyMismatch && (
            <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 mb-4">
              Warning: contract unit number differs from the locked property.
            </div>
          )}

          {saveError && (
            <div className="bg-red-50 text-red-500 text-sm rounded-xl p-3 mb-4">
              {saveError}
            </div>
          )}

          {/* Property */}
          <SectionHeader title="Property" />
          {existingProperty ? (
            <div
              style={{
                background: "#f9fafb",
                border: "1.5px solid #e5e7eb",
                borderRadius: 14,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                Property (locked)
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "#e5e7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  <Building2 size={20} color="#6b7280" />
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      margin: 0,
                      color: "#1a1a1a",
                    }}
                  >
                    {existingProperty.building_name}, Unit {existingProperty.unit_number}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      margin: "2px 0 0",
                      textTransform: "capitalize",
                    }}
                  >
                    {existingProperty.property_type}
                  </p>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 16 }}><Lock size={16} color="#9ca3af" /></span>
              </div>
            </div>
          ) : (
            <>
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
              <Field label="Location">
                <input
                  value={formData.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Location (e.g. Dubai Marina, JBR...)"
                  className={inputCls}
                />
              </Field>
            </>
          )}

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
          <Field label="Contract Start" required>
            <input
              type="date"
              value={formData.contract_from}
              onChange={(e) => set("contract_from", e.target.value)}
              className={inputCls}
              style={{ fontSize: 16 }}
            />
          </Field>
          <Field label="Contract End" required>
            <input
              type="date"
              value={formData.contract_to}
              onChange={(e) => set("contract_to", e.target.value)}
              className={inputCls}
              style={{ fontSize: 16 }}
            />
          </Field>
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
            <div className="relative">
              <input
                type="tel"
                value={formData.tenant_phone}
                onChange={(e) => set("tenant_phone", e.target.value)}
                onBlur={(e) => set("tenant_phone", normalizePhone(e.target.value))}
                placeholder="+971 50 123 4567"
                className={`${inputCls} ${formData.tenant_phone?.startsWith("+971") ? "pr-9" : ""}`}
              />
              {formData.tenant_phone?.startsWith("+971") && (
                <span
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 14,
                    color: "#cafe87",
                  }}
                >
                  ✓
                </span>
              )}
            </div>
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
            <div className="relative">
              <input
                type="tel"
                value={formData.landlord_phone}
                onChange={(e) => set("landlord_phone", e.target.value)}
                onBlur={(e) => set("landlord_phone", normalizePhone(e.target.value))}
                placeholder="+971 50 123 4567"
                className={`${inputCls} ${formData.landlord_phone?.startsWith("+971") ? "pr-9" : ""}`}
              />
              {formData.landlord_phone?.startsWith("+971") && (
                <span
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 14,
                    color: "#cafe87",
                  }}
                >
                  ✓
                </span>
              )}
            </div>
          </Field>
        </div>
      )}

      {/* STEP 3 — Recap */}
      {step === 3 && (
        <div className="px-4 pt-5 pb-48">
          {saveError && (
            <div className="bg-red-50 text-red-500 text-sm rounded-xl p-3 mb-4">
              {saveError}
            </div>
          )}

          {/* Property */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
            <p className="text-xs font-bold text-[#9A88FD] uppercase tracking-wider mb-3">
              Property
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0EDFF] flex items-center justify-center text-xl">
                <Building2 size={18} color="#7B65FC" />
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  {formData.building_name}, Unit {formData.unit_number}
                </p>
                <p className="text-xs text-gray-400">
                  {formData.property_type}
                  {formData.location ? ` • ${formData.location}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* ROOMS SECTION */}
          <div style={{ marginTop: 4 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
            }}>
              Quick templates
            </p>

            {/* Type pills */}
            <div style={{
              display: "flex", gap: 8, overflowX: "auto",
              marginLeft: -16, marginRight: -16,
              paddingLeft: 16, paddingRight: 16,
              paddingBottom: 4, marginBottom: 16,
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            } as React.CSSProperties}>
              {Object.keys(ROOM_TEMPLATES).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setSelectedRooms(ROOM_TEMPLATES[type]);
                  }}
                  style={{
                    flexShrink: 0,
                    padding: "8px 18px",
                    borderRadius: 100,
                    border: `2px solid ${selectedType === type ? "#9A88FD" : "#e5e7eb"}`,
                    background: selectedType === type ? "#9A88FD" : "white",
                    color: selectedType === type ? "white" : "#555",
                    fontWeight: 700, fontSize: 13,
                    cursor: "pointer", whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            <p style={{
              fontSize: 11, fontWeight: 700, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
            }}>
              Select rooms{selectedRooms.length > 0 ? ` (${selectedRooms.length} selected)` : ""}
            </p>

            {/* Room chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {[...ALL_ROOMS, ...selectedRooms.filter((r) => !ALL_ROOMS.includes(r))].map((room) => {
                const isSelected = selectedRooms.includes(room);
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => toggleRoom(room)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? "#9A88FD" : "#e5e7eb"}`,
                      background: isSelected ? "#9A88FD" : "white",
                      color: isSelected ? "white" : "#374151",
                      fontWeight: 600, fontSize: 13,
                      cursor: "pointer", transition: "all 0.15s",
                      boxShadow: isSelected ? "0 2px 8px rgba(154,136,253,0.25)" : "none",
                    }}
                  >
                    {room}
                  </button>
                );
              })}
            </div>

            {/* Custom room input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                placeholder="+ Add a custom room..."
                style={{
                  flex: 1, height: 44, padding: "0 16px",
                  borderRadius: 10, fontSize: 13, color: "#374151",
                  border: "1.5px dashed #d1d5db",
                  outline: "none", background: "white",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                style={{
                  width: 44, height: 44, borderRadius: 10, border: "none",
                  background: "#9A88FD", color: "white",
                  fontWeight: 700, fontSize: 20, cursor: "pointer",
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="px-4 pt-6 pb-48">

          {/* Magic suggestion banner */}
          {isFurnished !== null && (() => {
            const rent = parseFloat(formData.annual_rent ?? '0')
            const deposit = parseFloat(formData.security_deposit ?? '0')
            const ratio = rent > 0 && deposit > 0 ? Math.round((deposit / rent) * 100) : null
            if (!ratio) return null
            return (
              <div style={{
                background:'#EDE9FF', borderRadius:14, padding:'12px 16px',
                marginBottom:20, display:'flex', alignItems:'flex-start', gap:10,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0, marginTop:2 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <p style={{ fontSize:12, color:'#534AB7', margin:0, lineHeight:1.6 }}>
                  Based on a <strong>{ratio}% deposit/rent ratio</strong>, this apartment
                  appears to be <strong>{isFurnished ? 'furnished' : 'unfurnished'}</strong>.
                  You can change this below.
                </p>
              </div>
            )
          })()}

          {/* Furnished / Unfurnished toggle */}
          <p style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
            Apartment type
          </p>

          <div
            onClick={() => { setIsFurnished(true) }}
            style={{
              background:'white', borderRadius:16,
              border:`1.5px solid ${isFurnished === true ? '#9A88FD' : '#e5e7eb'}`,
              padding:'16px 18px', marginBottom:10,
              display:'flex', alignItems:'center', justifyContent:'space-between',
              cursor:'pointer',
              boxShadow: isFurnished === true ? '0 2px 12px rgba(154,136,253,0.2)' : 'none',
            }}
          >
            <div>
              <p style={{ fontFamily:'Poppins, sans-serif', fontWeight:700, fontSize:14, margin:'0 0 3px', color:'#0E0E10' }}>
                Furnished
              </p>
              <p style={{ fontSize:12, color:'#9ca3af', margin:0 }}>
                Includes furniture, appliances or electronics
              </p>
            </div>
            <div style={{
              width:22, height:22, borderRadius:'50%', flexShrink:0,
              border:`2px solid ${isFurnished === true ? '#9A88FD' : '#e5e7eb'}`,
              background: isFurnished === true ? '#9A88FD' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {isFurnished === true && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          </div>

          <div
            onClick={() => { setIsFurnished(false); setWantsInventory(false) }}
            style={{
              background:'white', borderRadius:16,
              border:`1.5px solid ${isFurnished === false ? '#9A88FD' : '#e5e7eb'}`,
              padding:'16px 18px', marginBottom:24,
              display:'flex', alignItems:'center', justifyContent:'space-between',
              cursor:'pointer',
              boxShadow: isFurnished === false ? '0 2px 12px rgba(154,136,253,0.2)' : 'none',
            }}
          >
            <div>
              <p style={{ fontFamily:'Poppins, sans-serif', fontWeight:700, fontSize:14, margin:'0 0 3px', color:'#0E0E10' }}>
                Unfurnished
              </p>
              <p style={{ fontSize:12, color:'#9ca3af', margin:0 }}>
                Empty apartment, no furniture included
              </p>
            </div>
            <div style={{
              width:22, height:22, borderRadius:'50%', flexShrink:0,
              border:`2px solid ${isFurnished === false ? '#9A88FD' : '#e5e7eb'}`,
              background: isFurnished === false ? '#9A88FD' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {isFurnished === false && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          </div>

          {/* Inventory option — only if furnished */}
          {isFurnished === true && (
            <>
              <p style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
                Furniture inventory
              </p>
              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:8 }}>

                {/* Explanation */}
                <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
                  <p style={{ fontSize:12, color:'#6b7280', margin:0, lineHeight:1.7 }}>
                    An inventory lists and photographs each piece of furniture and appliance.
                    Both parties sign it — giving you legal proof of what was present and its
                    condition at move-in. This protects both landlord and tenant in case of a deposit dispute.
                  </p>
                </div>

                {/* Yes */}
                <div
                  onClick={() => setWantsInventory(true)}
                  style={{
                    padding:'14px 16px', cursor:'pointer',
                    background: wantsInventory === true ? '#EDE9FF' : 'white',
                    borderBottom:'1px solid #f3f4f6',
                    display:'flex', alignItems:'center', gap:12,
                  }}
                >
                  <div style={{
                    width:20, height:20, borderRadius:'50%', flexShrink:0,
                    border:`2px solid ${wantsInventory === true ? '#9A88FD' : '#e5e7eb'}`,
                    background: wantsInventory === true ? '#9A88FD' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {wantsInventory === true && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:'#0E0E10', margin:0, fontFamily:'Poppins, sans-serif' }}>
                      Yes — document the inventory
                    </p>
                    <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>
                      Recommended · ~5 min · included in the signed PDF
                    </p>
                  </div>
                </div>

                {/* No */}
                <div
                  onClick={() => setWantsInventory(false)}
                  style={{
                    padding:'14px 16px', cursor:'pointer',
                    background: wantsInventory === false && isFurnished === true ? '#fafafa' : 'white',
                    display:'flex', alignItems:'center', gap:12,
                  }}
                >
                  <div style={{
                    width:20, height:20, borderRadius:'50%', flexShrink:0,
                    border:`2px solid ${wantsInventory === false && isFurnished === true ? '#9A88FD' : '#e5e7eb'}`,
                    background: wantsInventory === false && isFurnished === true ? '#9A88FD' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {wantsInventory === false && isFurnished === true && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:'#0E0E10', margin:0, fontFamily:'Poppins, sans-serif' }}>
                      No — skip inventory
                    </p>
                    <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>
                      Furnished status still appears in the report
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 5 — Key Handover */}
      {step === 5 && (
        <div className="px-4 pt-5 pb-48">
          {/* Section label */}
          <p style={{
            fontSize: 11, fontWeight: 700, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
          }}>
            Handover items
          </p>

          {/* Chip grid — same style as room chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {HANDOVER_ITEMS.map(({ id, label }) => {
              const isSelected = keyHandover.some((k) => k.item === label);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setKeyHandover((prev) => prev.filter((k) => k.item !== label));
                    } else {
                      setKeyHandover((prev) => [...prev, { item: label, qty: 1 }]);
                    }
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: `1.5px solid ${isSelected ? "#9A88FD" : "#e5e7eb"}`,
                    background: isSelected ? "#9A88FD" : "white",
                    color: isSelected ? "white" : "#374151",
                    fontWeight: 600, fontSize: 13,
                    cursor: "pointer", transition: "all 0.15s",
                    boxShadow: isSelected ? "0 2px 8px rgba(154,136,253,0.25)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Qty steppers for selected items */}
          {keyHandover.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {keyHandover.map((k) => (
                <div key={k.item} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", padding: "12px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}>
                  <span style={{ fontSize: 14, color: "#1a1a2e" }}>{k.item}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button type="button"
                      onClick={() => {
                        if (k.qty <= 1) return;
                        setKeyHandover((prev) =>
                          prev.map((x) => (x.item === k.item ? { ...x, qty: x.qty - 1 } : x))
                        );
                      }}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: "1.5px solid #e0e0e0", background: "white",
                        fontSize: 16, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                      −
                    </button>
                    <span style={{
                      fontSize: 16, fontWeight: 600, minWidth: 20, textAlign: "center",
                    }}>
                      {k.qty}
                    </span>
                    <button type="button"
                      onClick={() =>
                        setKeyHandover((prev) =>
                          prev.map((x) => (x.item === k.item ? { ...x, qty: x.qty + 1 } : x))
                        )
                      }
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: "1.5px solid #9A88FD", background: "#F3F0FF",
                        color: "#9A88FD", fontSize: 16, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section label */}
          <p style={{
            fontSize: 11, fontWeight: 700, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
          }}>
            Add custom item
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              placeholder="e.g. Storage key"
              value={customItemInput}
              onChange={(e) => setCustomItemInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customItemInput.trim()) {
                  setKeyHandover((prev) => [...prev, { item: customItemInput.trim(), qty: 1 }]);
                  setCustomItemInput("");
                }
              }}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => {
                if (customItemInput.trim()) {
                  setKeyHandover((prev) => [...prev, { item: customItemInput.trim(), qty: 1 }]);
                  setCustomItemInput("");
                }
              }}
              disabled={!customItemInput.trim()}
              style={{
                padding: "12px 20px", borderRadius: 12, border: "none",
                background: customItemInput.trim() ? "#9A88FD" : "#e0e0e0",
                color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Add
            </button>
          </div>

          {keyHandover.length === 0 && (
            <p style={{ color: "#bbb", fontSize: 13, textAlign: "center", marginTop: 24 }}>
              No items selected — you can skip this step
            </p>
          )}
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
            Continue → Review
          </button>
        </BottomBar>
      )}

      {step === 3 && (
        <BottomBar>
          <button
            type="button"
            onClick={() => {
              if (selectedRooms.length === 0) return
              // Pre-compute furnished suggestion from deposit/rent ratio
              const rent = parseFloat(formData.annual_rent ?? '0')
              const deposit = parseFloat(formData.security_deposit ?? '0')
              if (rent > 0 && deposit > 0) {
                const ratio = deposit / rent
                if (ratio >= 0.04 && ratio <= 0.06) setIsFurnished(false)
                else if (ratio >= 0.09 && ratio <= 0.11) setIsFurnished(true)
              }
              setStep(4)
            }}
            disabled={selectedRooms.length === 0}
            className="w-full h-12 rounded-xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{
              background: selectedRooms.length > 0 ? "linear-gradient(135deg,#9A88FD,#7B65FC)" : "#e5e7eb",
              color: selectedRooms.length > 0 ? "white" : "#9ca3af",
              fontFamily: "Poppins,sans-serif",
            }}
          >
            {selectedRooms.length > 0
              ? `Continue → ${selectedRooms.length} rooms selected`
              : "Select rooms to continue"}
          </button>
        </BottomBar>
      )}

      {step === 4 && (
        <BottomBar>
          <button
            type="button"
            disabled={
              isFurnished === null ||
              (isFurnished === true && wantsInventory === null)
            }
            onClick={() => setStep(5)}
            className="w-full h-12 rounded-xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{
              background: isFurnished !== null ? "linear-gradient(135deg,#9A88FD,#7B65FC)" : "#e5e7eb",
              color: isFurnished !== null ? "white" : "#9ca3af",
              fontFamily: "Poppins,sans-serif",
            }}
          >
            Continue → Key Handover
          </button>
        </BottomBar>
      )}

      {step === 5 && (
        <BottomBar>
          <button
            type="button"
            onClick={() => void handleStartInspection()}
            disabled={saving}
            className="w-full h-12 rounded-xl font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg,#9A88FD,#7B65FC)",
              color: "white",
              fontFamily: "Poppins,sans-serif",
            }}
          >
            {saving
              ? "Creating..."
              : keyHandover.length > 0
                ? "Start Inspection"
                : "Skip — Start Inspection"}
          </button>
        </BottomBar>
      )}

      {duplicateWarning && duplicateWarning.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-50 mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-yellow-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h4 className="font-poppins font-extrabold text-center text-gray-900 text-base mb-2">
              Similar property found
            </h4>
            <p className="text-sm text-gray-400 text-center mb-4">
              This looks like an existing property in your portfolio:
            </p>
            {duplicateWarning.map((d) => (
              <div key={d.id} className="bg-[#F8F7F4] rounded-xl p-3 mb-4 text-center">
                <p className="font-semibold text-gray-800 text-sm">{d.building_name}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Unit {d.unit_number}
                  {d.location ? ` · ${d.location}` : ""}
                </p>
              </div>
            ))}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const existing = duplicateWarning[0];
                  setDuplicateWarning(null);
                  if (!existing) return;
                  // Use existing in current flow: skip property creation and continue submit.
                  setSelectedPropertyId(existing.id);
                  setPendingSubmit(true);
                  void handleStartInspection(existing.id);
                }}
                className="w-full py-3 rounded-xl bg-[#9A88FD] text-white font-semibold text-sm active:scale-95 transition-transform"
              >
                Use existing property
              </button>
              <button
                onClick={() => {
                  // Skip duplicate check, create a new property and continue flow.
                  setDuplicateWarning(null);
                  setPendingSubmit(true);
                  void handleStartInspection();
                }}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm active:scale-95 transition-transform"
              >
                Create new anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────
// Loading fallback
// ─────────────────────────────────────────
function NewInspectionLoading() {
  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
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
