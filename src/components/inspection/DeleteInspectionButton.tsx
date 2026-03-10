"use client";
import { useState } from "react";
import { Trash2, Lock, AlertTriangle } from "lucide-react";
import { useDeleteInspection } from "@/lib/useDeleteInspection";

interface Props {
  inspectionId: string;
  inspectionType: "check-in" | "check-out";
  status: string | null;
  signatures?: { signer_type: string; otp_verified: boolean; signed_at?: string | null }[];
  redirectTo?: string;
  variant?: "button" | "menuitem" | "icon";
}

type BlockedReason =
  | { reason: "SIGNED"; signedCount: number; signerType: string }
  | { reason: "HAS_CHECKOUT" };

// ─── Shared modal styles ────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  zIndex: 9998,
  WebkitTapHighlightColor: "transparent",
};

const sheetStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  background: "white",
  borderRadius: "20px 20px 0 0",
  padding: "24px 20px",
  paddingBottom: "max(80px, calc(64px + env(safe-area-inset-bottom)))",
  boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
  maxWidth: "100vw",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "Poppins,sans-serif",
  fontWeight: 800,
  fontSize: 18,
  textAlign: "center",
  marginBottom: 8,
  color: "#1a1a1a",
};

const bodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  textAlign: "center",
  marginBottom: 24,
  lineHeight: 1.5,
};

const okBtnStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 12,
  border: "none",
  background: "#1a1a1a",
  color: "white",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

// ─── Modal sub-components ───────────────────────────────────────────────────

function ConfirmModal({
  inspectionType,
  onConfirm,
  onCancel,
}: {
  inspectionType: "check-in" | "check-out";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div style={overlayStyle} onClick={onCancel} />
      <div style={sheetStyle}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ display: "inline-flex" }}><Trash2 size={32} color="#ef4444" /></span>
        </div>
        <p style={titleStyle}>
          Delete {inspectionType === "check-in" ? "Check-in" : "Check-out"}?
        </p>
        <p style={bodyStyle}>
          This will permanently delete all photos, rooms and data for this
          inspection. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              border: "2px solid #e5e7eb",
              background: "white",
              color: "#374151",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              border: "none",
              background: "#ef4444",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </>
  );
}

function BlockedSignedModal({
  blockedReason,
  onClose,
}: {
  blockedReason: BlockedReason | null;
  onClose: () => void;
}) {
  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={sheetStyle}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ display: "inline-flex" }}><Lock size={32} color="#6b7280" /></span>
        </div>
        <p style={titleStyle}>Cannot delete</p>
        <p style={{ ...bodyStyle, marginBottom: 8 }}>
          {blockedReason?.reason === "SIGNED" && blockedReason.signedCount === 1
            ? `The ${blockedReason.signerType} has already signed this report. Deleting it would invalidate their signature.`
            : "This report has been signed by all parties."}
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#9ca3af",
            textAlign: "center",
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          This document is legally protected under RERA/DLD regulations and
          cannot be deleted.
        </p>
        <button onClick={onClose} style={okBtnStyle}>
          OK, understood
        </button>
      </div>
    </>
  );
}

function BlockedCheckoutModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={sheetStyle}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ display: "inline-flex" }}><AlertTriangle size={32} color="#D4A000" /></span>
        </div>
        <p style={titleStyle}>Cannot delete check-in</p>
        <p style={bodyStyle}>
          A check-out inspection exists for this tenancy. Delete the check-out
          inspection first before deleting the check-in.
        </p>
        <button onClick={onClose} style={okBtnStyle}>
          OK
        </button>
      </div>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function DeleteInspectionButton({
  inspectionId,
  inspectionType,
  status,
  signatures = [],
  redirectTo,
  variant = "button",
}: Props) {
  const { deleteInspection, loading } = useDeleteInspection();
  const [modal, setModal] = useState<
    null | "confirm" | "blocked_signed" | "blocked_checkout"
  >(null);
  const [blockedReason, setBlockedReason] = useState<BlockedReason | null>(null);

  const signedSigs = signatures.filter((s) => s.otp_verified);
  const isSignedLocally = signedSigs.length > 0 || status === "signed";

  const handlePress = () => {
    if (isSignedLocally) {
      setBlockedReason({
        reason: "SIGNED",
        signedCount: signedSigs.length,
        signerType: signedSigs[0]?.signer_type ?? "",
      });
      setModal("blocked_signed");
      return;
    }
    setModal("confirm");
  };

  const handleConfirm = async () => {
    setModal(null);
    const result = await deleteInspection(inspectionId, redirectTo);
    if (!result.canDelete) {
      if (result.reason === "HAS_CHECKOUT") {
        setBlockedReason({ reason: "HAS_CHECKOUT" });
        setModal("blocked_checkout");
      } else {
        setBlockedReason({
          reason: "SIGNED",
          signedCount: result.signedCount,
          signerType: result.signerType,
        });
        setModal("blocked_signed");
      }
    }
  };

  const Modals = (
    <>
      {modal === "confirm" && (
        <ConfirmModal
          inspectionType={inspectionType}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === "blocked_signed" && (
        <BlockedSignedModal
          blockedReason={blockedReason}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "blocked_checkout" && (
        <BlockedCheckoutModal onClose={() => setModal(null)} />
      )}
    </>
  );

  // ── Icon variant ──────────────────────────────────────────────────────────
  if (variant === "icon") {
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePress();
          }}
          disabled={loading}
          title={
            isSignedLocally
              ? "Cannot delete — legally signed"
              : "Delete inspection"
          }
          onMouseEnter={(e) => {
            if (!isSignedLocally)
              e.currentTarget.style.background = "#fecaca";
          }}
          onMouseLeave={(e) => {
            if (!isSignedLocally)
              e.currentTarget.style.background = "#fff0f0";
          }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "none",
            background: isSignedLocally ? "#f5f5f5" : "#fff0f0",
            color: isSignedLocally ? "#d1d5db" : "#ef4444",
            cursor: isSignedLocally ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {isSignedLocally ? <Lock size={14} /> : <Trash2 size={14} />}
        </button>
        {Modals}
      </>
    );
  }

  // ── Button / menuitem variants ────────────────────────────────────────────
  const pad = variant === "menuitem" ? "10px 16px" : "12px 20px";

  const btnStyle: React.CSSProperties = isSignedLocally
    ? {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        color: "#9ca3af",
        fontSize: 13,
        fontWeight: 600,
        cursor: "default",
        width: "100%",
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        borderRadius: 12,
        border: "1px solid #fecaca",
        background: "#fff5f5",
        color: "#ef4444",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        width: "100%",
      };

  return (
    <>
      <button onClick={handlePress} style={btnStyle} disabled={loading}>
        <span>{isSignedLocally ? <Lock size={14} /> : <Trash2 size={14} />}</span>
        {loading
          ? "Deleting..."
          : isSignedLocally
          ? "Cannot delete — legally signed"
          : `Delete ${inspectionType}`}
      </button>
      {Modals}
    </>
  );
}
