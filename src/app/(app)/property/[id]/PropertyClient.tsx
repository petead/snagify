"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";

type InspectionSignature = {
  signer_type: string;
  otp_verified: boolean;
  signed_at: string | null;
};

type InspectionInGroup = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  room_count: number;
  signatures: InspectionSignature[];
};

type TenancyGroup = {
  tenancyId: string | null;
  key: string;
  status: string;
  tenantName: string | null;
  ejariRef: string | null;
  contractFrom: string | null;
  contractTo: string | null;
  annualRent: number | null;
  canStartCheckIn: { allowed: boolean; reason: string | null };
  canStartCheckOut: { allowed: boolean; reason: string | null };
  inspections: InspectionInGroup[];
};

interface PropertyClientProps {
  property: {
    id: string;
    building_name: string | null;
    unit_number: string | null;
    address: string | null;
    property_type: string | null;
    property_size: number | null;
  };
  tenancyGroups: TenancyGroup[];
  totalInspections: number;
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function tenantInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function inspectionDisplayStatus(status: string | null): "draft" | "signed" {
  if (status === "signed" || status === "completed") return "signed";
  return "draft";
}

type CheckInWithRooms = {
  id: string;
  property_id: string;
  agent_id: string | null;
  tenancy_id?: string | null;
  type: string | null;
  status: string | null;
  landlord_name: string | null;
  landlord_email: string | null;
  landlord_phone?: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone?: string | null;
  ejari_ref?: string | null;
  contract_from?: string | null;
  contract_to?: string | null;
  annual_rent?: number | null;
  security_deposit?: number | null;
  property_size?: number | null;
  key_handover?: unknown;
  rooms?: { id: string; name: string; order_index: number | null }[];
};

function InspectionRow({
  label,
  data,
  canStart,
  accentLabel,
  inspectionId,
  propertyId,
  tenancyId,
  inspectionType,
  inspectionStatus,
  onRemove,
  onRollback,
  signatures,
  sourceCheckInId,
}: {
  label: string;
  data: { date: string; status: string } | null;
  canStart: boolean;
  accentLabel: boolean;
  inspectionId?: string;
  propertyId: string;
  tenancyId: string | null;
  inspectionType: "check-in" | "check-out";
  inspectionStatus?: string | null;
  onRemove?: () => void;
  onRollback?: () => void;
  signatures?: InspectionSignature[];
  sourceCheckInId?: string;
}) {
  const router = useRouter();
  const [preparingCheckOut, setPreparingCheckOut] = useState(false);

  const handleStart = async () => {
    if (inspectionType === "check-out" && sourceCheckInId) {
      setPreparingCheckOut(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPreparingCheckOut(false);
          return;
        }
        const { data: checkinInspection, error: fetchErr } = await supabase
          .from("inspections")
          .select("*, rooms (id, name, order_index)")
          .eq("id", sourceCheckInId)
          .single();

        if (fetchErr || !checkinInspection) {
          alert(fetchErr?.message ?? "Could not load check-in");
          setPreparingCheckOut(false);
          return;
        }
        const checkin = checkinInspection as CheckInWithRooms;

        const { data: newInspection, error: insertErr } = await supabase
          .from("inspections")
          .insert({
            property_id: checkin.property_id,
            tenancy_id: checkin.tenancy_id ?? undefined,
            agent_id: user.id,
            type: "check-out",
            status: "in_progress",
            landlord_name: checkin.landlord_name,
            landlord_email: checkin.landlord_email,
            landlord_phone: checkin.landlord_phone ?? undefined,
            tenant_name: checkin.tenant_name,
            tenant_email: checkin.tenant_email,
            tenant_phone: checkin.tenant_phone ?? undefined,
            ejari_ref: checkin.ejari_ref ?? undefined,
            contract_from: checkin.contract_from ?? undefined,
            contract_to: checkin.contract_to ?? undefined,
            annual_rent: checkin.annual_rent ?? undefined,
            security_deposit: checkin.security_deposit ?? undefined,
            property_size: checkin.property_size ?? undefined,
            key_handover: Array.isArray(checkin.key_handover) ? checkin.key_handover : [],
          })
          .select()
          .single();

        if (insertErr) {
          alert(insertErr.message);
          setPreparingCheckOut(false);
          return;
        }

        if (checkin.rooms?.length) {
          const roomsToInsert = checkin.rooms.map((r) => ({
            inspection_id: newInspection.id,
            name: r.name,
            order_index: r.order_index ?? 0,
          }));
          await supabase.from("rooms").insert(roomsToInsert);
        }

        router.push(`/inspection/${newInspection.id}`);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to start check-out");
        setPreparingCheckOut(false);
      }
      return;
    }

    const params = new URLSearchParams({ propertyId, type: "check-in" });
    if (tenancyId) params.set("tenancyId", tenancyId);
    router.push(`/inspection/new?${params.toString()}`);
  };

  const handleOpen = () => {
    if (inspectionId && data?.status === "signed") {
      router.push(`/inspection/${inspectionId}/report`);
    } else if (inspectionId) {
      router.push(`/inspection/${inspectionId}`);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: accentLabel ? "#9A88FD" : "#999",
            background: accentLabel ? "rgba(154,136,253,0.1)" : "#EEEDE9",
            padding: "4px 10px",
            borderRadius: 8,
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        {data ? (
          <button
            type="button"
            onClick={handleOpen}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#1A1A1A",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {data.date}
          </button>
        ) : (
          <span style={{ fontSize: 13, color: "#CCC" }}>—</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {data ? (
          <>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: data.status === "signed" ? "#9A88FD" : "#999",
                background: data.status === "signed" ? "rgba(154,136,253,0.1)" : "#EEEDE9",
                padding: "4px 10px",
                borderRadius: 8,
                textTransform: "capitalize",
              }}
            >
              {data.status}
            </span>
            {data.status === "draft" && inspectionId && onRemove && onRollback && signatures && (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "#F8F7F4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <DeleteInspectionButton
                  inspectionId={inspectionId}
                  inspectionType={inspectionType}
                  status={inspectionStatus ?? "draft"}
                  signatures={signatures}
                  redirectTo={`/property/${propertyId}`}
                  variant="icon"
                  onOptimisticRemove={onRemove}
                  onRollback={onRollback}
                />
              </div>
            )}
          </>
        ) : !canStart && inspectionType === "check-out" ? (
          <span
            title="Complete the check-in first"
            style={{
              background: "#E5E7EB",
              color: "#9CA3AF",
              padding: "6px 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.4,
              cursor: "not-allowed",
            }}
          >
            Complete the check-in first
          </span>
        ) : canStart ? (
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={preparingCheckOut}
            style={{
              background: accentLabel ? "#9A88FD" : "#1A1A1A",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: preparingCheckOut ? "wait" : "pointer",
              opacity: preparingCheckOut ? 0.9 : 1,
            }}
          >
            {preparingCheckOut ? "Preparing Check-out…" : "Start"}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "#DDD" }}>—</span>
        )}
      </div>
    </div>
  );
}

export function PropertyClient({
  property,
  tenancyGroups: initialTenancyGroups,
  totalInspections,
}: PropertyClientProps) {
  const [loaded, setLoaded] = useState(false);
  const [tenancyGroups, setTenancyGroups] = useState(initialTenancyGroups);
  const groupsRollbackRef = useRef<TenancyGroup[]>([]);

  useEffect(() => {
    setLoaded(true);
  }, []);
  useEffect(() => {
    setTenancyGroups(initialTenancyGroups);
  }, [initialTenancyGroups]);

  const removeInspectionFromList = (inspectionId: string) => {
    groupsRollbackRef.current = tenancyGroups.map((g) => ({
      ...g,
      inspections: [...g.inspections],
    }));
    setTenancyGroups((prev) =>
      prev.map((g) => ({
        ...g,
        inspections: g.inspections.filter((i) => i.id !== inspectionId),
      }))
    );
  };
  const rollbackGroups = () => setTenancyGroups(groupsRollbackRef.current);

  const propertyName = property.building_name ?? property.address ?? "Property";
  const unit = property.unit_number ? `Unit ${property.unit_number}` : "";
  const propertyType = property.property_type ?? "";

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F8F7F4",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        paddingBottom: 24,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Poppins:wght@500;600;700;800&display=swap');
        .back-btn { transition: all 0.2s ease; cursor: pointer; }
        .back-btn:active { transform: scale(0.9); }
        .trash-btn { transition: all 0.2s ease; cursor: pointer; }
        .trash-btn:active { transform: scale(0.9); background: rgba(239,68,68,0.12) !important; }
        .scroll-hide::-webkit-scrollbar { display: none; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) forwards;
          opacity: 0;
        }
      `}</style>

      {/* Back button */}
      <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: "0s" }}>
        <Link
          href="/properties"
          className="back-btn"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "#EEEDE9",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
      </div>

      <div className="scroll-hide" style={{ overflowY: "auto", maxHeight: 700, paddingBottom: 100 }}>
        {/* Property Info Card */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: "0.06s" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: "rgba(154,136,253,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {propertyName}
                {unit ? `, ${unit}` : ""}
              </h3>
              {propertyType && (
                <p style={{ fontSize: 13, color: "#9A88FD", margin: "2px 0 0", fontWeight: 600 }}>{propertyType}</p>
              )}
              <p style={{ fontSize: 12, color: "#BBB", margin: "2px 0 0" }}>
                {totalInspections} inspection{totalInspections !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
        </div>

        {/* Tenancy History Title */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "24px 24px 0", animationDelay: "0.12s" }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 800, color: "#1A1A1A", margin: 0 }}>
            Tenancy History
          </h2>
        </div>

        {/* Tenancy Cards */}
        {tenancyGroups.length === 0 ? (
          <div className={loaded ? "fade-up" : ""} style={{ padding: "14px 24px 0", animationDelay: "0.18s" }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 22,
                padding: 32,
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 14, color: "#999", margin: 0 }}>No tenancies yet</p>
              <p style={{ fontSize: 13, color: "#BBB", margin: "8px 0 0" }}>Start with a Check-in inspection</p>
              <Link
                href={`/inspection/new?propertyId=${property.id}&type=check-in`}
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  background: "#9A88FD",
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                + New Inspection
              </Link>
            </div>
          </div>
        ) : (
          tenancyGroups.map((group, i) => {
            const checkIn = group.inspections.find(
              (insp) =>
                (insp.type ?? "").toLowerCase().includes("check-in") ||
                (insp.type ?? "").toLowerCase() === "check_in"
            );
            const checkOut = group.inspections.find(
              (insp) =>
                (insp.type ?? "").toLowerCase().includes("check-out") ||
                (insp.type ?? "").toLowerCase() === "check_out"
            );
            const tenancyStatusDisplay =
              group.status === "active" || group.status === "expiring_soon" || group.status === "upcoming"
                ? "active"
                : "past";

            const checkInData = checkIn
              ? {
                  date: formatDateShort(checkIn.completed_at ?? checkIn.created_at),
                  status: inspectionDisplayStatus(
                    checkIn.status === "signed" || (checkIn.signatures ?? []).some((s) => s.otp_verified || s.signed_at)
                      ? "signed"
                      : checkIn.status
                  ),
                }
              : null;
            const checkOutData = checkOut
              ? {
                  date: formatDateShort(checkOut.completed_at ?? checkOut.created_at),
                  status: inspectionDisplayStatus(
                    checkOut.status === "signed" || (checkOut.signatures ?? []).some((s) => s.otp_verified || s.signed_at)
                      ? "signed"
                      : checkOut.status
                  ),
                }
              : null;

            return (
              <div
                key={group.key}
                className={loaded ? "fade-up" : ""}
                style={{ padding: "14px 24px 0", animationDelay: `${0.18 + i * 0.08}s` }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 22,
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Tenant Info */}
                  <div style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: "#9A88FD",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#fff",
                            flexShrink: 0,
                          }}
                        >
                          {tenantInitials(group.tenantName)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h4
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#1A1A1A",
                              margin: 0,
                              fontFamily: "'Poppins', sans-serif",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {group.tenantName ?? "Unknown tenant"}
                          </h4>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          flexShrink: 0,
                          marginLeft: 8,
                          color: tenancyStatusDisplay === "active" ? "#9A88FD" : "#999",
                          background: tenancyStatusDisplay === "active" ? "rgba(154,136,253,0.1)" : "#EEEDE9",
                          padding: "4px 10px",
                          borderRadius: 100,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {tenancyStatusDisplay}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        gap: 16,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span style={{ fontSize: 12, color: "#999" }}>
                          {formatDateShort(group.contractFrom)} → {formatDateShort(group.contractTo)}
                        </span>
                      </div>
                      {group.annualRent != null && (
                        <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>
                          AED {group.annualRent.toLocaleString("en-AE")}/yr
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inspections */}
                  <div style={{ borderTop: "1px solid #F0EFEC", padding: "4px 20px" }}>
                    <InspectionRow
                      label="CHECK-IN"
                      data={checkInData}
                      canStart={group.canStartCheckIn.allowed}
                      accentLabel={true}
                      inspectionId={checkIn?.id}
                      propertyId={property.id}
                      tenancyId={group.tenancyId}
                      inspectionType="check-in"
                      inspectionStatus={checkIn?.status}
                      onRemove={checkIn ? () => removeInspectionFromList(checkIn.id) : undefined}
                      onRollback={rollbackGroups}
                      signatures={checkIn?.signatures}
                    />
                    <div style={{ height: 1, background: "#F0EFEC" }} />
                    <InspectionRow
                      label="CHECK-OUT"
                      data={checkOutData}
                      canStart={group.canStartCheckOut.allowed}
                      accentLabel={false}
                      inspectionId={checkOut?.id}
                      propertyId={property.id}
                      tenancyId={group.tenancyId}
                      inspectionType="check-out"
                      inspectionStatus={checkOut?.status}
                      onRemove={checkOut ? () => removeInspectionFromList(checkOut.id) : undefined}
                      onRollback={rollbackGroups}
                      signatures={checkOut?.signatures}
                      sourceCheckInId={checkIn?.id}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
