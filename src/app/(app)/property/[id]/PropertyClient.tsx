"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";
import { useCredits } from "@/hooks/useCredits";
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal";
import { regenerateAndDownloadInspectionPdf } from "@/lib/regenerateAndDownloadInspectionPdf";
import { InspectionStatusBadge } from "@/components/inspection/InspectionStatusBadge";
import { planSlugForBuyCredits, pricePerCreditForBuy } from "@/lib/buyCreditsPlan";
import { getStatusLabel } from "@/lib/utils/statusHelpers";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefresh";
import { motion } from "framer-motion";

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
  report_url: string | null;
  signed_at: string | null;
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
    location: string | null;
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

function getInspectionState(inspection: {
  status?: string | null;
  report_url?: string | null;
  signed_at?: string | null;
}): "draft" | "to_sign" | "signed" {
  if (inspection.signed_at || inspection.status === "signed") return "signed";
  if (inspection.report_url) return "to_sign";
  return "draft";
}

/** Same rules as dashboard / reports — fully signed inspection */
function inspectionFullySignedGroup(inspection: InspectionInGroup): boolean {
  if (inspection.status === "signed" || inspection.signed_at) return true;
  const sigs = inspection.signatures ?? [];
  const landlordSig = sigs.find((s) => s.signer_type === "landlord");
  const tenantSig = sigs.find((s) => s.signer_type === "tenant");
  return !!landlordSig?.signed_at && !!tenantSig?.signed_at;
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
  checkin_key_handover?: { item: string; qty: number }[];
  rooms?: { id: string; name: string; order_index: number | null }[];
};

function InspectionRow({
  label,
  inspection,
  canStart,
  propertyId,
  tenancyId,
  inspectionType,
  onRemove,
  onRollback,
  sourceCheckInId,
  creditsBalance,
  creditsPlan,
  creditsAccountType,
  refreshCredits,
}: {
  label: string;
  inspection: InspectionInGroup | null;
  canStart: boolean;
  propertyId: string;
  tenancyId: string | null;
  inspectionType: "check-in" | "check-out";
  onRemove?: () => void;
  onRollback?: () => void;
  sourceCheckInId?: string;
  creditsBalance: number;
  creditsPlan: string;
  creditsAccountType: "individual" | "pro";
  refreshCredits: () => Promise<void>;
}) {
  const router = useRouter();
  const [preparingCheckOut, setPreparingCheckOut] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const buyPlanSlug = planSlugForBuyCredits(creditsPlan);
  const buyPricePerCredit = pricePerCreditForBuy(creditsPlan);

  const state = inspection ? getInspectionState(inspection) : null;
  const isDraft = inspection?.status === "in_progress";
  const isSigned = inspection ? inspectionFullySignedGroup(inspection) : false;

  const handleStart = async () => {
    if (inspectionType === "check-out" && sourceCheckInId) {
      setPreparingCheckOut(true);
      try {
        const supabase = createClient();
        const action =
          creditsAccountType === "individual" ? "individual_checkout" : "pro_checkout";
        const [balanceRes, costRow] = await Promise.all([
          fetch("/api/credits/balance"),
          supabase
            .from("credit_costs")
            .select("credits")
            .eq("action", action)
            .eq("is_active", true)
            .maybeSingle(),
        ]);
        const balanceJson = (await balanceRes.json()) as {
          balance?: number;
          error?: string;
        };
        if (!balanceRes.ok) {
          alert(balanceJson.error || "Could not verify credits");
          setPreparingCheckOut(false);
          return;
        }
        const balance = Number(balanceJson.balance ?? 0);
        const cost = Number(costRow.data?.credits ?? 1) || 1;
        if (balance < cost) {
          setShowBuyCredits(true);
          setPreparingCheckOut(false);
          return;
        }

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
            checkin_key_handover: Array.isArray(checkin.key_handover) ? checkin.key_handover : [],
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

        await refreshCredits();
        router.push(`/inspection/${newInspection.id}`);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to start check-out");
        setPreparingCheckOut(false);
      }
      return;
    }

    const startCheckIn = () => {
      const params = new URLSearchParams({ propertyId, type: "check-in" });
      if (tenancyId) params.set("tenancyId", tenancyId);
      router.push(`/inspection/new?${params.toString()}`);
    };

    startCheckIn();
  };

  const handleDownloadPdf = async () => {
    if (!inspection) return;
    setPdfLoading(true);
    try {
      await regenerateAndDownloadInspectionPdf(inspection.id);
    } catch (e) {
      console.error("[DownloadPDF]", e);
      alert(e instanceof Error ? e.message : "Download failed");
    } finally {
      setPdfLoading(false);
    }
  };

  // Inspection exists
  if (inspection && state) {
    const goToInspection = () => {
      const id = inspection.id;
      if (!id) return;
      if (inspection.status === "in_progress") {
        router.push(`/inspection/${id}`);
      } else {
        router.push(`/inspection/${id}/report`);
      }
    };

    return (
      <div className="py-3">
        <motion.div
          whileTap={{ backgroundColor: "rgba(154,136,253,0.05)" }}
          onClick={goToInspection}
          style={{
            cursor: inspection.id ? "pointer" : "default",
            borderRadius: 12,
            width: "100%",
            display: "block",
          }}
        >
          <div className="flex items-center gap-2">
          {/* Type badge */}
          <span
            className={`text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-lg flex-shrink-0
              ${inspectionType === "check-in"
                ? "bg-[#EDE9FF] text-[#9A88FD]"
                : "bg-amber-50 text-amber-600"
              }`}
          >
            {label}
          </span>

          {/* Date */}
          <span className="text-[13px] font-semibold text-[#1A1A2E] flex-1 whitespace-nowrap">
            {formatDateShort(inspection.completed_at ?? inspection.created_at)}
          </span>

          <InspectionStatusBadge
            status={inspection.status}
            fullySigned={inspectionFullySignedGroup(inspection)}
          />

          {/* Draft → resume */}
          {isDraft ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/inspection/${inspection.id}`);
              }}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {getStatusLabel("in_progress")}
            </button>
          ) : isSigned ? (
            <button
              type="button"
              disabled={pdfLoading}
              onClick={(e) => {
                e.stopPropagation();
                void handleDownloadPdf();
              }}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {pdfLoading ? "…" : "PDF"}
            </button>
          ) : state === "to_sign" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/inspection/${inspection.id}/report`);
              }}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-[#9A88FD] px-4 py-2 text-[13px] font-bold text-white"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Sign
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToInspection();
              }}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-[#F3F3F8] px-4 py-2 text-[13px] font-bold text-[#1A1A2E]"
            >
              Open
            </button>
          )}

          {/* Trash button — draft only */}
          {state === "draft" && onRemove && onRollback && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "#FEF2F2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <DeleteInspectionButton
                inspectionId={inspection.id}
                inspectionType={inspectionType}
                status={inspection.status ?? "in_progress"}
                signatures={inspection.signatures}
                redirectTo={`/property/${propertyId}`}
                variant="icon"
                onOptimisticRemove={onRemove}
                onRollback={onRollback}
              />
            </div>
          )}
        </div>
        </motion.div>

        <BuyCreditsModal
          isOpen={showBuyCredits}
          onClose={() => setShowBuyCredits(false)}
          currentBalance={creditsBalance}
          accountType={creditsAccountType}
          plan={creditsPlan}
          planSlug={buyPlanSlug}
          pricePerCredit={buyPricePerCredit}
          onPurchaseSuccess={async () => {
            await refreshCredits();
            setShowBuyCredits(false);
          }}
        />
      </div>
    );
  }

  // No inspection yet — show "Start" button or disabled state
  return (
    <div className="py-3">
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-lg
            ${inspectionType === "check-in"
              ? "bg-[#EDE9FF] text-[#9A88FD]"
              : "bg-[#F3F3F8] text-[#C4C4C4]"
            }`}
        >
          {label}
        </span>
        <span className="text-[13px] text-[#C4C4C4] flex-1">
          Not started yet
        </span>

        {!canStart && inspectionType === "check-out" ? (
          <span
            title="Complete the check-in first"
            className="bg-gray-200 text-gray-400 px-3.5 py-1.5 rounded-xl text-xs font-semibold opacity-50 cursor-not-allowed"
          >
            Complete check-in first
          </span>
        ) : canStart ? (
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={preparingCheckOut}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold text-white border-none
              ${inspectionType === "check-in" ? "bg-[#9A88FD] hover:bg-[#8674FC]" : "bg-[#1A1A2E] hover:bg-[#333]"}
              ${preparingCheckOut ? "opacity-90 cursor-wait" : "cursor-pointer"}
              transition-colors`}
          >
            {preparingCheckOut ? "..." : "Start"}
          </button>
        ) : null}
      </div>

      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        currentBalance={creditsBalance}
        accountType={creditsAccountType}
        plan={creditsPlan}
        planSlug={buyPlanSlug}
        pricePerCredit={buyPricePerCredit}
        onPurchaseSuccess={async () => {
          await refreshCredits();
          setShowBuyCredits(false);
        }}
      />

    </div>
  );
}

export function PropertyClient({
  property,
  tenancyGroups: initialTenancyGroups,
  totalInspections,
}: PropertyClientProps) {
  const router = useRouter();
  const { balance, plan, accountType, refresh: refreshCredits } = useCredits();
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

  const propertyName = property.building_name ?? property.location ?? "Property";
  const unit = property.unit_number ? `Unit ${property.unit_number}` : "";
  const propertyType = property.property_type ?? "";

  const handleRefresh = useCallback(async () => {
    router.refresh();
    await new Promise((resolve) => setTimeout(resolve, 800));
  }, [router]);

  const { pullDistance, isRefreshing, isTriggered, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        height: "calc(100dvh - 4rem)",
        maxHeight: "calc(100dvh - 4rem)",
        display: "flex",
        flexDirection: "column",
        background: "#F8F7F4",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
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

      {/* ── FIXED HEADER ── */}
      <div style={{ flexShrink: 0, background: "#F8F7F4" }}>
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

        {/* Tenancy History title */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 8px", animationDelay: "0.12s" }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 800, color: "#1A1A1A", margin: 0 }}>
            Tenancy History
          </h2>
        </div>
      </div>

      {/* ── SCROLL AREA — tenancy groups only ── */}
      <div
        ref={containerRef}
        data-pull-scroll
        className="scroll-hide"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          position: "relative",
          paddingBottom: 24,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: pullDistance,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <PullToRefreshIndicator
            pullDistance={pullDistance}
            isRefreshing={isRefreshing}
            isTriggered={isTriggered}
          />
        </div>

        <div
          style={{
            transform: `translateY(${pullDistance}px)`,
            transition: isRefreshing ? "transform 0.25s ease" : "none",
          }}
        >
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
                      inspection={checkIn ?? null}
                      canStart={group.canStartCheckIn.allowed}
                      propertyId={property.id}
                      tenancyId={group.tenancyId}
                      inspectionType="check-in"
                      onRemove={checkIn ? () => removeInspectionFromList(checkIn.id) : undefined}
                      onRollback={rollbackGroups}
                      creditsBalance={balance}
                      creditsPlan={plan}
                      creditsAccountType={accountType as "individual" | "pro"}
                      refreshCredits={refreshCredits}
                    />
                    <div style={{ height: 1, background: "#F0EFEC" }} />
                    <InspectionRow
                      label="CHECK-OUT"
                      inspection={checkOut ?? null}
                      canStart={group.canStartCheckOut.allowed}
                      propertyId={property.id}
                      tenancyId={group.tenancyId}
                      inspectionType="check-out"
                      onRemove={checkOut ? () => removeInspectionFromList(checkOut.id) : undefined}
                      onRollback={rollbackGroups}
                      sourceCheckInId={checkIn?.id}
                      creditsBalance={balance}
                      creditsPlan={plan}
                      creditsAccountType={accountType as "individual" | "pro"}
                      refreshCredits={refreshCredits}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
