"use client";

/**
 * If properties table is missing 'address' or still has 'location', run in Supabase SQL Editor:
 * -- ALTER TABLE properties ADD COLUMN IF NOT EXISTS address text;
 * -- ALTER TABLE properties DROP COLUMN IF EXISTS location;
 */

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasOverlapWarning } from "@/lib/tenancy";

const PROPERTY_TYPES = [
  { id: "villa", label: "Villa", emoji: "🏠" },
  { id: "apartment", label: "Apartment", emoji: "🏢" },
  { id: "studio", label: "Studio", emoji: "🛏️" },
  { id: "townhouse", label: "Townhouse", emoji: "🏬" },
] as const;

const ROOM_SUGGESTIONS = [
  "Living Room",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Kitchen",
  "Bathroom 1",
  "Bathroom 2",
  "Guest Toilet",
  "Balcony",
  "Laundry",
  "Storage",
  "Parking",
  "Garden",
  "Pool",
];

const ROOMS_BY_PROPERTY: Record<string, string[]> = {
  studio: ["Living Room", "Kitchen", "Bathroom 1"],
  apartment: ["Living Room", "Master Bedroom", "Kitchen", "Bathroom 1", "Balcony"],
  villa: ROOM_SUGGESTIONS,
  townhouse: [
    "Living Room",
    "Master Bedroom",
    "Bedroom 2",
    "Kitchen",
    "Bathroom 1",
    "Bathroom 2",
    "Guest Toilet",
    "Balcony",
    "Garden",
  ],
};

const inputClass =
  "w-full h-[52px] px-4 rounded-xl border border-[#E5E7EB] bg-white font-body text-brand-dark placeholder-gray-400 focus:outline-none focus:border-[#9A88FD] focus:ring-2 focus:ring-[#9A88FD]/20 transition-all";

type PropertyTypeId = (typeof PROPERTY_TYPES)[number]["id"];

interface DetailsForm {
  inspectionType: "check-in" | "check-out";
  buildingName: string;
  unitNumber: string;
  address: string;
  propertyType: PropertyTypeId | "";
  propertySize: string;
  ejariRef: string;
  contractFrom: string;
  contractTo: string;
  annualRent: string;
  securityDeposit: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
}

const initialDetails: DetailsForm = {
  inspectionType: "check-in",
  buildingName: "",
  unitNumber: "",
  address: "",
  propertyType: "",
  propertySize: "",
  ejariRef: "",
  contractFrom: "",
  contractTo: "",
  annualRent: "",
  securityDeposit: "",
  landlordName: "",
  landlordEmail: "",
  landlordPhone: "",
  tenantName: "",
  tenantEmail: "",
  tenantPhone: "",
};

function mapExtractedToForm(extracted: Record<string, unknown>): Partial<DetailsForm> {
  const get = (k: string) => {
    const v = extracted[k];
    return v != null && typeof v === "string" ? v : "";
  };
  const getNum = (k: string) => {
    const v = extracted[k];
    if (v == null) return undefined;
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
    if (typeof v === "string") return v.trim() || undefined;
    return undefined;
  };
  const building = get("building_name");
  const unitNum = get("unit_number");
  const address = (extracted.address != null && typeof extracted.address === "string")
    ? String(extracted.address).trim()
    : building && unitNum ? `${building}, Unit ${unitNum}` : "";
  const propType = (get("property_type") || "").toLowerCase();
  let propertyType: PropertyTypeId | "" = "";
  if (propType.includes("villa")) propertyType = "villa";
  else if (propType.includes("apartment") || propType.includes("flat")) propertyType = "apartment";
  else if (propType.includes("studio")) propertyType = "studio";
  else if (propType.includes("town") || propType.includes("house")) propertyType = "townhouse";
  const inspType = (get("inspection_type") || "check-in").toLowerCase();
  const inspectionType: "check-in" | "check-out" = inspType.includes("check-out") ? "check-out" : "check-in";

  return {
    buildingName: building || undefined,
    unitNumber: unitNum || undefined,
    address: address || undefined,
    propertyType: propertyType || undefined,
    propertySize: getNum("property_size") ?? undefined,
    ejariRef: get("ejari_ref") || undefined,
    contractFrom: get("contract_from") || undefined,
    contractTo: get("contract_to") || undefined,
    annualRent: getNum("annual_rent") ?? undefined,
    securityDeposit: getNum("security_deposit") ?? undefined,
    inspectionType,
    landlordName: get("landlord_name") || undefined,
    landlordEmail: get("landlord_email") || undefined,
    landlordPhone: get("landlord_phone") || undefined,
    tenantName: get("tenant_name") || undefined,
    tenantEmail: get("tenant_email") || undefined,
    tenantPhone: get("tenant_phone") || undefined,
  };
}

function NewInspectionContent() {
  const searchParams = useSearchParams();
  const urlPropertyId = searchParams.get("propertyId");
  const urlTenancyId = searchParams.get("tenancyId");
  const urlType = searchParams.get("type");

  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<DetailsForm>(initialDetails);
  const [fromContract, setFromContract] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [customRoomInput, setCustomRoomInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const readFileAsBase64 = (file: File): Promise<{ data: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        const mediaType = file.type === "application/pdf" ? "application/pdf" : file.type.startsWith("image/") ? file.type : "image/jpeg";
        resolve({ data: base64, mediaType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploadFile({ name: file.name, size: file.size });
      setUploadProgress(0);
      setUploadStatus("🤖 Reading your contract...");

      const progressInterval = setInterval(() => {
        setUploadProgress((p) => (p >= 90 ? p : p + 10));
      }, 300);

      try {
        const { data, mediaType } = await readFileAsBase64(file);
        setUploadProgress(95);

        const res = await fetch("/api/extract-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, mediaType }),
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || res.statusText);
        }

        const extracted = (await res.json()) as Record<string, unknown>;
        const mapped = mapExtractedToForm(extracted);
        setDetails((d) => ({ ...d, ...mapped }));
        setFromContract(true);
        setUploadSuccess(true);
        setUploadStatus("✅ Contract read! Please verify the details below.");

        setTimeout(() => {
          setStep(2);
          setUploadFile(null);
          setUploadProgress(0);
          setUploadStatus(null);
          setUploadSuccess(false);
        }, 1200);
      } catch (e) {
        clearInterval(progressInterval);
        setUploadError(e instanceof Error ? e.message : "Failed to read contract");
        setUploadStatus(null);
      }
    },
    []
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "application/pdf" || file.type.startsWith("image/"))) {
      processFile(file);
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === "application/pdf" || file.type.startsWith("image/"))) {
      processFile(file);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  const toggleRoom = (room: string) => {
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]
    );
  };

  const addCustomRoom = () => {
    const name = customRoomInput.trim();
    if (name && !selectedRooms.includes(name)) {
      setSelectedRooms((prev) => [...prev, name]);
      setCustomRoomInput("");
      setShowCustomInput(false);
    }
  };

  const step2Valid =
    (details.buildingName.trim() !== "" || details.address.trim() !== "") &&
    details.unitNumber.trim() !== "" &&
    details.propertyType !== "" &&
    details.landlordName.trim() !== "" &&
    details.landlordEmail.trim() !== "" &&
    details.tenantName.trim() !== "" &&
    details.tenantEmail.trim() !== "";

  const goToStep2Empty = () => {
    setFromContract(false);
    setStep(2);
  };

  const handleContinueStep2 = () => {
    if (!step2Valid) return;
    setStep(3);
    if (selectedRooms.length === 0 && details.propertyType) {
      const suggested = ROOMS_BY_PROPERTY[details.propertyType];
      if (suggested?.length) setSelectedRooms(suggested);
    }
  };

  // Pre-fill type from URL when coming from property page
  useEffect(() => {
    if (urlType === "check-in" || urlType === "check-out") {
      setDetails((d) => ({
        ...d,
        inspectionType: urlType,
      }));
    }
  }, [urlType]);

  const handleStartInspection = async () => {
    setError(null);
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in.");
      setSaving(false);
      return;
    }

    const buildingName = (details.buildingName ?? "").trim() || null;
    const unitNumber = (details.unitNumber ?? "").trim() || null;
    const address = (details.address ?? "").trim() || (buildingName && unitNumber ? `${buildingName}, Unit ${unitNumber}` : "") || null;

    let propertyId: string;

    if (urlPropertyId && urlTenancyId) {
      // Adding check-out (or check-in) to existing tenancy: use URL propertyId and tenancyId
      propertyId = urlPropertyId;
    } else if (urlPropertyId) {
      propertyId = urlPropertyId;
    } else {
      let existingQuery = supabase
        .from("properties")
        .select("id")
        .eq("agent_id", user.id);
      existingQuery = buildingName != null && buildingName !== ""
        ? existingQuery.eq("building_name", buildingName)
        : existingQuery.is("building_name", null);
      existingQuery = unitNumber != null && unitNumber !== ""
        ? existingQuery.eq("unit_number", unitNumber)
        : existingQuery.is("unit_number", null);
      const { data: existing } = await existingQuery.maybeSingle();

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
          property_type: details.propertyType || null,
          furnished: false,
        })
        .select("id")
        .single();
      if (propErr || !prop) {
        setError(propErr?.message ?? "Failed to create property.");
        setSaving(false);
        return;
      }
      propertyId = prop.id;
      }
    }

    // 1. Check for overlap warning (tenancy without completed check-out)
    try {
      const warning = await hasOverlapWarning(
        propertyId,
        details.contractFrom ?? "",
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
      // tenancies table may not exist yet; continue
    }

    // 2. Resolve tenancy: use URL tenancyId (existing tenancy) or create new
    let tenancyId: string | null = urlTenancyId ?? null;
    let tenancyData: { landlord_name?: string; landlord_email?: string; landlord_phone?: string; tenant_name?: string; tenant_email?: string; tenant_phone?: string; ejari_ref?: string; contract_from?: string; contract_to?: string; annual_rent?: number; security_deposit?: number; property_size?: number } | null = null;
    if (tenancyId) {
      const { data: existingTenancy } = await supabase
        .from("tenancies")
        .select("landlord_name, landlord_email, landlord_phone, tenant_name, tenant_email, tenant_phone, ejari_ref, contract_from, contract_to, annual_rent, security_deposit, property_size")
        .eq("id", tenancyId)
        .single();
      tenancyData = existingTenancy ?? null;
    }
    if (!tenancyId) {
      try {
        const { data: tenancy, error: tenancyErr } = await supabase
          .from("tenancies")
          .insert({
            property_id: propertyId,
            agent_id: user.id,
            tenant_name: (details.tenantName ?? "").trim() || "Unknown Tenant",
            tenant_email: (details.tenantEmail ?? "").trim() || null,
            tenant_phone: (details.tenantPhone ?? "").trim() || null,
            landlord_name: (details.landlordName ?? "").trim() || null,
            landlord_email: (details.landlordEmail ?? "").trim() || null,
            landlord_phone: (details.landlordPhone ?? "").trim() || null,
            ejari_ref: (details.ejariRef ?? "").trim() || null,
            contract_from: details.contractFrom?.trim() || null,
            contract_to: details.contractTo?.trim() || null,
            annual_rent: details.annualRent ? Number(details.annualRent) : null,
            security_deposit: details.securityDeposit ? Number(details.securityDeposit) : null,
            property_size: details.propertySize ? Number(details.propertySize) : null,
            tenancy_type: "standard",
            status: "active",
          })
          .select("id")
          .single();
        if (!tenancyErr && tenancy?.id) tenancyId = tenancy.id;
      } catch {
        // tenancies table may not exist
      }
    }

    // 3. Create inspection (with tenancy_id if we have it; contract fields from tenancy or form)
    const inspPayload = {
      property_id: propertyId,
      ...(tenancyId && { tenancy_id: tenancyId }),
      agent_id: user.id,
      type: details.inspectionType,
      status: "draft",
      ejari_ref: (tenancyData?.ejari_ref ?? details.ejariRef ?? "").toString().trim() || null,
      contract_from: (tenancyData?.contract_from ?? details.contractFrom)?.toString().trim() || null,
      contract_to: (tenancyData?.contract_to ?? details.contractTo)?.toString().trim() || null,
      annual_rent: tenancyData?.annual_rent ?? (details.annualRent ? Number(details.annualRent) : null),
      security_deposit: tenancyData?.security_deposit ?? (details.securityDeposit ? Number(details.securityDeposit) : null),
      property_size: tenancyData?.property_size ?? (details.propertySize ? Number(details.propertySize) : null),
      landlord_name: (tenancyData?.landlord_name ?? details.landlordName ?? "").toString().trim(),
      landlord_email: (tenancyData?.landlord_email ?? details.landlordEmail ?? "").toString().trim(),
      landlord_phone: (tenancyData?.landlord_phone ?? details.landlordPhone ?? "").toString().trim() || null,
      tenant_name: (tenancyData?.tenant_name ?? details.tenantName ?? "").toString().trim(),
      tenant_email: (tenancyData?.tenant_email ?? details.tenantEmail ?? "").toString().trim(),
      tenant_phone: (tenancyData?.tenant_phone ?? details.tenantPhone ?? "").toString().trim() || null,
    };
    const { data: insp, error: inspErr } = await supabase
      .from("inspections")
      .insert(inspPayload)
      .select("id")
      .single();

    if (inspErr || !insp) {
      setError(inspErr?.message ?? "Failed to create inspection.");
      setSaving(false);
      return;
    }

    // 4. Create rooms
    if (selectedRooms.length > 0) {
      const roomRows = selectedRooms.map((name, i) => ({
        inspection_id: insp.id,
        name,
        order_index: i,
      }));
      const { error: roomsErr } = await supabase.from("rooms").insert(roomRows);
      if (roomsErr) {
        setError(roomsErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push(`/inspection/${insp.id}`);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] max-w-[480px] mx-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#fcfcfc] border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-4">
          {step === 1 ? (
            <Link
              href="/dashboard"
              className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              <ChevronLeft size={24} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <h1 className="font-heading font-bold text-lg text-brand-dark flex-1">
            New Inspection
          </h1>
        </div>
      </div>

      <main className="px-4 py-8 pb-16">
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body"
          >
            {error}
          </div>
        )}

        {/* Step 1 — Contract Upload */}
        {step === 1 && (
          <div className="flex flex-col items-center">
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`w-full rounded-2xl border-2 border-dashed bg-white p-10 flex flex-col items-center justify-center text-center transition-colors ${
                isDragging ? "border-[#9A88FD] bg-[#F0EDFF]" : "border-[#9A88FD]"
              }`}
            >
              {!uploadFile ? (
                <>
                  <span className="text-5xl mb-4">📄</span>
                  <h2 className="font-heading font-bold text-xl text-brand-dark mb-2">
                    Upload Tenancy Contract
                  </h2>
                  <p className="font-body text-sm text-gray-500 mb-6 max-w-sm">
                    We&apos;ll extract all property and tenant details automatically
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/jpg"
                    onChange={onFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl bg-[#9A88FD] text-white font-heading font-medium px-6 py-3"
                  >
                    Browse File
                  </button>
                  <p className="font-body text-xs text-gray-400 mt-4">
                    Supports PDF, JPG, PNG
                  </p>
                </>
              ) : (
                <>
                  {uploadSuccess ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-full bg-[#cafe87] flex items-center justify-center">
                        <Check size={28} className="text-brand-dark" />
                      </div>
                      <p className="font-body text-sm italic text-brand-dark">
                        {uploadStatus}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="font-body text-sm font-medium text-brand-dark">
                        {uploadFile.name}
                      </p>
                      <p className="font-body text-xs text-gray-500 mb-3">
                        {(uploadFile.size / 1024).toFixed(1)} KB
                      </p>
                      <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-[#9A88FD] transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="font-body text-sm italic text-gray-600">
                        {uploadStatus}
                      </p>
                      {uploadError && (
                        <p className="font-body text-sm text-red-600 mt-2">
                          {uploadError}
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 w-full my-8">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="font-body text-sm text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              type="button"
              onClick={goToStep2Empty}
              className="font-body font-medium text-[#9A88FD] hover:underline"
            >
              Fill in manually →
            </button>
          </div>
        )}

        {/* Step 2 — Verify Details */}
        {step === 2 && (
          <div>
            <h1 className="font-heading font-bold text-xl text-brand-dark mb-1">
              Verify Details
            </h1>
            <p className="font-body text-sm text-gray-500 italic mb-4">
              AI-extracted data — please check and correct if needed
            </p>

            {fromContract && (
              <div className="bg-[#F0EDFF] text-[#9A88FD] rounded-xl p-3 mb-6 font-body text-sm">
                🤖 Auto-filled from your contract
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-6 mb-2">
                Property
              </p>
              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-2">
                  Inspection Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["check-in", "check-out"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setDetails((d) => ({ ...d, inspectionType: type }))
                      }
                      className={`h-12 rounded-xl font-heading font-semibold text-sm border-2 ${
                        details.inspectionType === type
                          ? "bg-[#9A88FD] border-[#9A88FD] text-white"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    >
                      {type === "check-in" ? "CHECK-IN" : "CHECK-OUT"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-2">
                  Property Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {PROPERTY_TYPES.map(({ id, label, emoji }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDetails((d) => ({ ...d, propertyType: id }))
                      }
                      className={`rounded-2xl border-2 p-4 text-left ${
                        details.propertyType === id
                          ? "border-[#9A88FD] bg-[#F0EDFF]"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <span className="text-2xl block mb-1">{emoji}</span>
                      <span className="font-body font-medium text-brand-dark">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Building Name *
                </label>
                <input
                  value={details.buildingName}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, buildingName: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="e.g. Creek Rise Tower 1"
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Unit Number *
                </label>
                <input
                  value={details.unitNumber}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, unitNumber: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="e.g. 3301"
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Address
                </label>
                <input
                  value={details.address}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, address: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Creek Rise Tower 1, Unit 3301"
                />
                {details.buildingName && details.unitNumber && !details.address && (
                  <p className="mt-1 font-body text-xs text-gray-500">
                    Or leave blank to use: {details.buildingName}, Unit {details.unitNumber}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Property Size (m²)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={details.propertySize}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, propertySize: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="e.g. 1200"
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Ejari Reference
                </label>
                <input
                  value={details.ejariRef}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, ejariRef: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Contract number (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                    Contract From
                  </label>
                  <input
                    type="date"
                    value={details.contractFrom}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, contractFrom: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                    Contract To
                  </label>
                  <input
                    type="date"
                    value={details.contractTo}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, contractTo: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                    Annual Rent
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={details.annualRent}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, annualRent: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="e.g. 120000"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                    Security Deposit
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={details.securityDeposit}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, securityDeposit: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="e.g. 5000"
                  />
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-6 mb-2">
                Landlord
              </p>
              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Full Name *
                </label>
                <input
                  value={details.landlordName}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, landlordName: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={details.landlordEmail}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, landlordEmail: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={details.landlordPhone}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, landlordPhone: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="+971..."
                />
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-6 mb-2">
                Tenant
              </p>
              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Full Name *
                </label>
                <input
                  value={details.tenantName}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, tenantName: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={details.tenantEmail}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, tenantEmail: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={details.tenantPhone}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, tenantPhone: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="+971..."
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinueStep2}
              disabled={!step2Valid}
              className="mt-8 w-full h-[52px] rounded-xl bg-[#9A88FD] text-white font-heading font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 3 — Select Rooms */}
        {step === 3 && (
          <div>
            <h1 className="font-heading font-bold text-xl text-brand-dark mb-1">
              Select Rooms
            </h1>
            <p className="font-body text-sm text-gray-500 mb-6">
              Tap to select rooms to inspect
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {ROOM_SUGGESTIONS.map((room) => {
                const selected = selectedRooms.includes(room);
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => toggleRoom(room)}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-sm border-2 transition-all ${
                      selected
                        ? "bg-[#9A88FD] border-[#9A88FD] text-white"
                        : "bg-white border-[#E5E7EB] text-gray-600"
                    }`}
                  >
                    {selected && <Check size={16} />}
                    {room}
                  </button>
                );
              })}
            </div>

            {selectedRooms.some((r) => !ROOM_SUGGESTIONS.includes(r)) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedRooms
                  .filter((r) => !ROOM_SUGGESTIONS.includes(r))
                  .map((room) => (
                    <button
                      key={room}
                      type="button"
                      onClick={() => toggleRoom(room)}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-sm bg-[#9A88FD] border-2 border-[#9A88FD] text-white"
                    >
                      <Check size={16} />
                      {room}
                    </button>
                  ))}
              </div>
            )}

            {showCustomInput ? (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={customRoomInput}
                  onChange={(e) => setCustomRoomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomRoom()}
                  className={inputClass}
                  placeholder="Room name"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={addCustomRoom}
                  className="h-[52px] px-4 rounded-xl bg-[#9A88FD] text-white font-heading font-bold whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="text-[#9A88FD] font-body font-medium text-sm mb-6"
              >
                + Add custom room
              </button>
            )}

            <button
              type="button"
              onClick={handleStartInspection}
              disabled={saving}
              className="mt-6 w-full h-[52px] rounded-xl font-heading font-bold text-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#cafe87" }}
            >
              {saving ? "Creating…" : "Start Inspection →"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function NewInspectionLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 border-[#9A88FD] border-t-transparent rounded-full animate-spin mx-auto mb-3"
          aria-hidden
        />
        <p className="text-sm text-gray-500 font-body">Loading...</p>
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
