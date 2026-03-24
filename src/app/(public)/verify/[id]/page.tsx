import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

export default async function VerifyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: inspection } = await supabaseAdmin
    .from("inspections")
    .select(
      `
      id, type, status, created_at, completed_at, document_hash, report_url,
      properties:property_id (building_name, unit_number, location),
      tenancies:tenancy_id (
        tenant_name, landlord_name, contract_from, contract_to
      ),
      agent:agent_id (
        full_name,
        company:companies (name, logo_url, primary_color)
      ),
      signatures (signer_type, signed_at, refused_at, refused_reason)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!inspection) notFound();

  const prop = Array.isArray(inspection.properties)
    ? inspection.properties[0]
    : inspection.properties;
  const tenancy = Array.isArray(inspection.tenancies)
    ? inspection.tenancies[0]
    : inspection.tenancies;
  const agentRaw = Array.isArray(inspection.agent)
    ? inspection.agent[0]
    : inspection.agent;
  const company = Array.isArray(agentRaw?.company)
    ? agentRaw.company[0]
    : agentRaw?.company;

  const primaryColor = company?.primary_color || "#9A88FD";
  const agencyName = company?.name || "Snagify";
  const propertyName = prop?.building_name || prop?.location || "Property";
  const unitNumber = prop?.unit_number ? `Unit ${prop.unit_number}` : "";
  const inspectionDate = inspection.completed_at || inspection.created_at;
  const typeLabel = inspection.type === "check-in" ? "Check-in" : "Check-out";

  const sigs = (inspection.signatures ?? []) as {
    signer_type: string;
    signed_at: string | null;
    refused_at: string | null;
    refused_reason: string | null;
  }[];
  const landlordSig = sigs.find((s) => s.signer_type === "landlord");
  const tenantSig = sigs.find((s) => s.signer_type === "tenant");

  const statusColor =
    inspection.status === "signed"
      ? "#16A34A"
      : inspection.status === "disputed"
        ? "#EF4444"
        : inspection.status === "expired"
          ? "#6B7280"
          : "#D97706";

  const statusLabel =
    inspection.status === "signed"
      ? "✓ Fully Signed"
      : inspection.status === "disputed"
        ? "⚠ Disputed"
        : inspection.status === "expired"
          ? "Expired"
          : "Pending Signatures";

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F7F4",
        fontFamily: "-apple-system, sans-serif",
        padding: "24px 16px 48px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {/* Agency header */}
      <div
        style={{
          background: primaryColor,
          borderRadius: 20,
          padding: "20px 24px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {company?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logo_url}
            alt={agencyName}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              objectFit: "contain",
              background: "rgba(255,255,255,0.2)",
            }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "white",
            }}
          >
            {agencyName.charAt(0)}
          </div>
        )}
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>
            {agencyName}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            Inspection Report Verification
          </div>
        </div>
      </div>

      {/* Verified badge */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "16px 20px",
          marginBottom: 12,
          border: `2px solid ${statusColor}20`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${statusColor}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke={statusColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1A1A2E" }}>
            Document Verified
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
            This report was generated by Snagify
          </div>
        </div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 700,
            color: statusColor,
            background: `${statusColor}15`,
            padding: "4px 10px",
            borderRadius: 100,
            flexShrink: 0,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Property info */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "16px 20px",
          marginBottom: 12,
          border: "1px solid #EEECFF",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#9A88FD",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          Property
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#1A1A2E",
            marginBottom: 4,
          }}
        >
          {propertyName}
        </div>
        {unitNumber && (
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>
            {unitNumber}
          </div>
        )}
        <div
          style={{
            borderTop: "1px solid #F3F3F8",
            paddingTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {[
            { label: "Type", value: typeLabel },
            { label: "Date", value: formatDate(inspectionDate) },
            { label: "Tenant", value: tenancy?.tenant_name },
            { label: "Landlord", value: tenancy?.landlord_name },
            {
              label: "Contract",
              value: tenancy?.contract_from
                ? `${formatDate(tenancy.contract_from)} → ${formatDate(tenancy.contract_to)}`
                : null,
            },
            { label: "Inspector", value: agentRaw?.full_name },
          ]
            .filter((r) => r.value)
            .map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#9B9BA8" }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: "#1A1A2E" }}>{row.value}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Signatures */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "16px 20px",
          marginBottom: 12,
          border: "1px solid #EEECFF",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#9A88FD",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          Signatures
        </div>
        {[
          { label: "Landlord", name: tenancy?.landlord_name, sig: landlordSig },
          { label: "Tenant", name: tenancy?.tenant_name, sig: tenantSig },
        ].map(({ label, name, sig }, i) => {
          const signed = !!sig?.signed_at;
          const refused = !!sig?.refused_at;
          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: i === 0 ? "1px solid #F3F3F8" : "none",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: signed ? "#DCFCE7" : refused ? "#FEF2F2" : "#EDE9FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: signed ? "#16A34A" : refused ? "#EF4444" : "#9A88FD",
                }}
              >
                {signed ? "✓" : refused ? "✕" : (name || label).charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
                  {name || label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: signed ? "#16A34A" : refused ? "#EF4444" : "#9B9BA8",
                    marginTop: 2,
                  }}
                >
                  {signed
                    ? `Signed on ${formatDate(sig!.signed_at)}`
                    : refused
                      ? `Refused to sign${sig?.refused_reason ? ` — "${sig.refused_reason}"` : ""}`
                      : "Pending signature"}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 100,
                  background: signed ? "#DCFCE7" : refused ? "#FEF2F2" : "#F3F3F8",
                  color: signed ? "#16A34A" : refused ? "#EF4444" : "#9B9BA8",
                }}
              >
                {signed ? "Signed" : refused ? "Refused" : "Pending"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Document hash */}
      {inspection.document_hash && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div
            style={{
              fontSize: 10,
              color: "#9B9BA8",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            SHA-256 Hash
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#C4C4C4",
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            {inspection.document_hash}
          </div>
        </div>
      )}

      {/* Download PDF */}
      {inspection.report_url && (
        <a
          href={inspection.report_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "16px 0",
            background: primaryColor,
            color: "white",
            borderRadius: 16,
            fontSize: 15,
            fontWeight: 800,
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Download PDF Report
        </a>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#C4C4C4" }}>
          Verified by{" "}
          <Link
            href="https://snagify.net"
            style={{
              color: "#9A88FD",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Snagify
          </Link>{" "}
          · Dubai Property Inspections
        </div>
      </div>
    </div>
  );
}
