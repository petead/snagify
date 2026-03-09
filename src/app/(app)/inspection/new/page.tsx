"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  address: string;
  unitNumber: string;
  propertyType: PropertyTypeId | "";
  propertySize: string;
  ejariRef: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
}

const initialDetails: DetailsForm = {
  inspectionType: "check-in",
  address: "",
  unitNumber: "",
  propertyType: "",
  propertySize: "",
  ejariRef: "",
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
  const building = get("building_name");
  const location = get("location");
  const address = [building, location].filter(Boolean).join(", ") || get("property_no") || "";
  const propType = (get("property_type") || "").toLowerCase();
  let propertyType: PropertyTypeId | "" = "";
  if (propType.includes("villa")) propertyType = "villa";
  else if (propType.includes("apartment") || propType.includes("flat")) propertyType = "apartment";
  else if (propType.includes("studio")) propertyType = "studio";
  else if (propType.includes("town") || propType.includes("house")) propertyType = "townhouse";

  return {
    address: address || undefined,
    unitNumber: get("unit_number") || undefined,
    propertyType: propertyType || undefined,
    propertySize: extracted.property_size != null ? String(extracted.property_size) : undefined,
    ejariRef: get("ejari_ref") || undefined,
    landlordName: get("landlord_name") || undefined,
    landlordEmail: get("landlord_email") || undefined,
    landlordPhone: get("landlord_phone") || undefined,
    tenantName: get("tenant_name") || undefined,
    tenantEmail: get("tenant_email") || undefined,
    tenantPhone: get("tenant_phone") || undefined,
  };
}

export default function NewInspectionPage() {
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
    details.address.trim() !== "" &&
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

    const { data: prop, error: propErr } = await supabase
      .from("properties")
      .insert({
        agent_id: user.id,
        address: (details.address ?? "").trim(),
        unit_number: (details.unitNumber ?? "").trim() || null,
        property_type: details.propertyType || null,
        furnished: false,
        ejari_ref: (details.ejariRef ?? "").trim() || null,
      })
      .select("id")
      .single();

    if (propErr || !prop) {
      setError(propErr?.message ?? "Failed to create property.");
      setSaving(false);
      return;
    }

    const { data: insp, error: inspErr } = await supabase
      .from("inspections")
      .insert({
        property_id: prop.id,
        agent_id: user.id,
        type: details.inspectionType,
        status: "draft",
        landlord_name: (details.landlordName ?? "").trim(),
        landlord_email: (details.landlordEmail ?? "").trim(),
        tenant_name: (details.tenantName ?? "").trim(),
        tenant_email: (details.tenantEmail ?? "").trim(),
      })
      .select("id")
      .single();

    if (inspErr || !insp) {
      setError(inspErr?.message ?? "Failed to create inspection.");
      setSaving(false);
      return;
    }

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
                  Address *
                </label>
                <input
                  value={details.address}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, address: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Building, Street, Area, Dubai"
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-brand-dark mb-1.5">
                  Unit Number
                </label>
                <input
                  value={details.unitNumber}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, unitNumber: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="Apt 2301"
                />
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
                  placeholder="Ejari contract number (optional)"
                />
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
