"use client";

/**
 * Unified inspection status pill — use Dashboard, Reports, Property rows, Report header.
 */
export function InspectionStatusBadge({
  status,
  fullySigned,
}: {
  status: string | null | undefined;
  fullySigned?: boolean;
}) {
  const raw = (status ?? "").toLowerCase();

  let key: string;
  if (raw === "disputed") key = "disputed";
  else if (raw === "expired") key = "expired";
  else if (fullySigned || raw === "signed") key = "signed";
  else if (raw === "completed") key = "pending_signatures";
  else if (raw === "in_progress") key = "in_progress";
  else key = "in_progress";

  const config: Record<string, { label: string; bg: string; color: string }> = {
    in_progress: { label: "Draft", bg: "#F3F4F6", color: "#6B7280" },
    completed: { label: "Ready", bg: "#EDE9FF", color: "#7C3AED" },
    pending_signatures: { label: "Pending", bg: "#FEF3C7", color: "#92400E" },
    signed: { label: "Signed", bg: "#D1FAE5", color: "#065F46" },
    disputed: { label: "Disputed", bg: "#FEF3C7", color: "#92400E" },
    expired: { label: "Expired", bg: "#F3F4F6", color: "#6B7280" },
  };

  const c = config[key] ?? {
    label: status ?? "—",
    bg: "#F3F4F6",
    color: "#6B7280",
  };

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 20,
        background: c.bg,
        color: c.color,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}
