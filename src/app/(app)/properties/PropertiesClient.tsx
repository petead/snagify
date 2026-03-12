"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTenancyStatus, getTenancyDaysLeft, TENANCY_STATUS_CONFIG } from "@/lib/tenancy";

type InspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
};

type TenancyRow = {
  id: string;
  tenant_name: string | null;
  status?: string | null;
  contract_from?: string | null;
  contract_to?: string | null;
  annual_rent?: number | null;
  inspections?: InspectionRow[] | InspectionRow | null;
};

type PropertyRow = {
  id: string;
  building_name: string | null;
  unit_number: string | null;
  address: string | null;
  property_type: string | null;
  created_at: string | null;
  tenancies?: TenancyRow[] | TenancyRow | null;
};

interface PropertiesClientProps {
  properties: PropertyRow[];
  fullName: string | null;
  userEmail: string | null;
}

function normalizeTenancies(t: TenancyRow[] | TenancyRow | null | undefined): TenancyRow[] {
  if (!t) return [];
  const arr = Array.isArray(t) ? t : [t];
  return arr.map((row) => ({
    ...row,
    inspections: Array.isArray(row.inspections)
      ? row.inspections
      : row.inspections
        ? [row.inspections as InspectionRow]
        : [],
  }));
}

function getActiveTenancy(tenancies: TenancyRow[]): TenancyRow | null {
  for (const t of tenancies) {
    const s = (t.status as string) || getTenancyStatus(t);
    if (["active", "expiring_soon", "upcoming"].includes(s)) return t;
  }
  return null;
}

function getPropertyStatus(property: PropertyRow): {
  status: "active" | "expiring_soon" | "upcoming" | "vacant";
  tenancy: TenancyRow | null;
} {
  const tenancies = normalizeTenancies(property.tenancies);
  for (const t of tenancies) {
    const s = (t.status as string) || getTenancyStatus(t);
    if (s === "active") return { status: "active", tenancy: t };
  }
  for (const t of tenancies) {
    const s = (t.status as string) || getTenancyStatus(t);
    if (s === "expiring_soon") return { status: "expiring_soon", tenancy: t };
  }
  for (const t of tenancies) {
    const s = (t.status as string) || getTenancyStatus(t);
    if (s === "upcoming") return { status: "upcoming", tenancy: t };
  }
  return { status: "vacant", tenancy: null };
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

export function PropertiesClient({ properties: initialProperties, fullName, userEmail }: PropertiesClientProps) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const properties = (initialProperties ?? []).map((p) => ({
    ...p,
    tenancies: normalizeTenancies(p.tenancies),
  }));

  const filtered =
    search.trim() === ""
      ? properties
      : properties.filter((p) => {
          const q = search.toLowerCase();
          const active = getActiveTenancy(normalizeTenancies(p.tenancies));
          return (
            p.building_name?.toLowerCase().includes(q) ||
            p.unit_number?.toLowerCase().includes(q) ||
            (p.address ?? "").toLowerCase().includes(q) ||
            active?.tenant_name?.toLowerCase().includes(q)
          );
        });

  const activeCount = properties.filter((p) => getPropertyStatus(p).status === "active").length;
  const expiringSoonCount = properties.filter((p) => getPropertyStatus(p).status === "expiring_soon").length;
  const vacantCount = properties.filter((p) => getPropertyStatus(p).status === "vacant").length;
  const initials = getInitials(fullName, userEmail);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F8F7F4",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        paddingBottom: 100,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Poppins:wght@500;600;700;800&display=swap');

        .prop-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .prop-card:active {
          transform: scale(0.98);
        }
        .cta-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .cta-btn:active {
          transform: scale(0.97);
        }
        .search-input {
          transition: all 0.3s ease;
          border: 1.5px solid transparent;
        }
        .search-input:focus {
          border-color: #9A88FD;
          background: #fff;
          outline: none;
          box-shadow: 0 4px 20px rgba(154,136,253,0.1);
        }
        .scroll-hide::-webkit-scrollbar { display: none; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .nav-item {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .action-chip {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .action-chip:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* Header */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{ padding: "18px 24px 0", animationDelay: "0s" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "#9A88FD",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0-6v6" />
              </svg>
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1A1A1A",
                letterSpacing: -0.3,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Snagify
            </span>
          </div>
          <Link
            href="/dashboard/profile"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "#9A88FD",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.5,
              textDecoration: "none",
            }}
          >
            {initials}
          </Link>
        </div>
      </div>

      {/* Title */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{ padding: "24px 24px 0", animationDelay: "0.06s" }}
      >
        <p
          style={{
            fontSize: 13,
            color: "#BBB",
            margin: 0,
            fontWeight: 500,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Portfolio
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 4,
          }}
        >
          <h1
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 30,
              fontWeight: 800,
              margin: 0,
              color: "#1A1A1A",
              letterSpacing: -0.5,
            }}
          >
            My Properties
          </h1>
          <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {activeCount > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  background: "#EEEDE9",
                  padding: "5px 12px",
                  borderRadius: 100,
                }}
              >
                {activeCount} active
              </span>
            )}
            {expiringSoonCount > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#d97706",
                  background: "#EEEDE9",
                  padding: "5px 12px",
                  borderRadius: 100,
                }}
              >
                {expiringSoonCount} expiring
              </span>
            )}
            {vacantCount > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#999",
                  background: "#EEEDE9",
                  padding: "5px 12px",
                  borderRadius: 100,
                }}
              >
                {vacantCount} vacant
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      {properties.length > 0 && (
        <div
          className={loaded ? "fade-up" : ""}
          style={{ padding: "16px 24px 0", animationDelay: "0.1s" }}
        >
          <div style={{ position: "relative" }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#BBB"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input
              className="search-input"
              type="text"
              placeholder="Search by address, unit, or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px 14px 46px",
                borderRadius: 14,
                border: "1.5px solid transparent",
                background: "#EEEDE9",
                fontSize: 14,
                color: "#1A1A1A",
                fontFamily: "'DM Sans', sans-serif",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}

      {/* Property Cards */}
      <div
        className="scroll-hide"
        style={{ overflowY: "auto", paddingBottom: 24 }}
      >
        <div style={{ padding: "16px 24px 0" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  background: "#EEEDE9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#CCC"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h3
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: 0,
                }}
              >
                {search ? "No properties found" : "No properties yet"}
              </h3>
              <p style={{ fontSize: 13, color: "#BBB", margin: "8px 0 0", lineHeight: 1.5 }}>
                {search ? "Try a different search" : "Start a new inspection to add a property"}
              </p>
              {!search && (
                <Link
                  href="/inspection/new"
                  className="cta-btn"
                  style={{
                    display: "inline-flex",
                    marginTop: 20,
                    background: "#9A88FD",
                    color: "#fff",
                    padding: "12px 24px",
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 4px 16px rgba(154,136,253,0.3)",
                  }}
                >
                  + New Inspection
                </Link>
              )}
            </div>
          ) : (
            filtered.map((property, i) => {
              const { status: propStatus, tenancy } = getPropertyStatus(property);
              const statusConfig = TENANCY_STATUS_CONFIG[propStatus] ?? TENANCY_STATUS_CONFIG.active;
              const inspections: InspectionRow[] = Array.isArray(tenancy?.inspections)
                ? tenancy!.inspections as InspectionRow[]
                : tenancy?.inspections
                  ? [tenancy.inspections as InspectionRow]
                  : [];

              const checkIn = inspections.find(
                (ins) => (ins.type ?? "").toLowerCase().includes("check-in")
              );
              const checkOut = inspections.find(
                (ins) => (ins.type ?? "").toLowerCase().includes("check-out")
              );
              const checkInDone =
                checkIn?.status === "completed" || checkIn?.status === "signed";
              const checkOutDone =
                checkOut?.status === "completed" || checkOut?.status === "signed";
              const checkInInProgress = checkIn?.status === "in_progress";
              const checkOutInProgress = checkOut?.status === "in_progress";

              const daysLeft =
                tenancy?.contract_from && tenancy?.contract_to
                  ? getTenancyDaysLeft(tenancy) ?? 0
                  : null;
              const totalDays =
                tenancy?.contract_from && tenancy?.contract_to
                  ? Math.ceil(
                      (new Date(tenancy.contract_to).getTime() -
                        new Date(tenancy.contract_from).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null;

              const isExpanded = expandedId === property.id;
              const isActive = ["active", "expiring_soon", "upcoming"].includes(propStatus);
              const iconColor = isActive ? "#9A88FD" : "#BBB";
              const iconBg = isActive ? "rgba(154,136,253,0.1)" : "#EEEDE9";

              const barColor =
                daysLeft !== null && daysLeft <= 30
                  ? "#EF4444"
                  : daysLeft !== null && daysLeft <= 90
                    ? "#FEDE80"
                    : "#9A88FD";

              return (
                <div
                  key={property.id}
                  className={`prop-card ${loaded ? "fade-up" : ""}`}
                  style={{
                    background: "#fff",
                    borderRadius: 22,
                    padding: 20,
                    marginBottom: 14,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    animationDelay: `${0.16 + i * 0.07}s`,
                    border: isExpanded
                      ? "1.5px solid #9A88FD"
                      : "1.5px solid transparent",
                  }}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : property.id)
                  }
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 15,
                        background: iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={iconColor}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#1A1A1A",
                            margin: 0,
                            fontFamily: "'Poppins', sans-serif",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "70%",
                          }}
                        >
                          {property.building_name ?? property.address ?? "Property"}
                        </h3>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={isExpanded ? "#9A88FD" : "#CCC"}
                          strokeWidth="2"
                          strokeLinecap="round"
                          style={{
                            transform: isExpanded ? "rotate(90deg)" : "none",
                            transition: "transform 0.25s ease, stroke 0.25s ease",
                            flexShrink: 0,
                          }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                      <p style={{ fontSize: 13, color: "#999", margin: "3px 0 0" }}>
                        {property.unit_number ? `Unit ${property.unit_number}` : "—"}
                        {property.property_type ? ` · ${property.property_type}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Tenant row */}
                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {tenancy ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            background: "#9A88FD",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#fff",
                            flexShrink: 0,
                          }}
                        >
                          {tenantInitials(tenancy.tenant_name)}
                        </div>
                        <span style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>
                          {tenancy.tenant_name ?? "Tenant"}
                        </span>
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/inspection/new?propertyId=${property.id}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            router.push(`/inspection/new?propertyId=${property.id}`);
                          }
                        }}
                        style={{
                          padding: "5px 14px",
                          borderRadius: 8,
                          border: "1.5px dashed #DDD",
                          fontSize: 12,
                          color: "#BBB",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        + Assign tenant
                      </div>
                    )}

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isActive ? "#9A88FD" : "#999",
                        background: isActive ? "rgba(154,136,253,0.1)" : "#EEEDE9",
                        padding: "4px 12px",
                        borderRadius: 100,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Check-in / Check-out chips */}
                  {isActive && (
                    <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                      {/* Check-in chip */}
                      <div
                        className="action-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (checkIn) {
                            router.push(`/inspection/${checkIn.id}/report`);
                          } else {
                            router.push(`/inspection/new?propertyId=${property.id}&type=check-in`);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          borderRadius: 12,
                          textAlign: "center",
                          background: checkInDone
                            ? "rgba(154,136,253,0.1)"
                            : checkInInProgress
                              ? "rgba(254,222,128,0.3)"
                              : "#EEEDE9",
                          fontSize: 12,
                          fontWeight: 600,
                          color: checkInDone
                            ? "#9A88FD"
                            : checkInInProgress
                              ? "#d97706"
                              : "#BBB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        {checkInDone && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#9A88FD"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {checkInInProgress && <span style={{ fontSize: 11 }}>⋯</span>}
                        Check-in
                      </div>

                      {/* Check-out chip */}
                      <div
                        className="action-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (checkOut) {
                            router.push(`/inspection/${checkOut.id}/report`);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          borderRadius: 12,
                          textAlign: "center",
                          background: checkOutDone
                            ? "rgba(154,136,253,0.1)"
                            : checkOutInProgress
                              ? "rgba(254,222,128,0.3)"
                              : "#EEEDE9",
                          fontSize: 12,
                          fontWeight: 600,
                          color: checkOutDone
                            ? "#9A88FD"
                            : checkOutInProgress
                              ? "#d97706"
                              : "#BBB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          cursor: checkOut ? "pointer" : "default",
                        }}
                      >
                        {checkOutDone && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#9A88FD"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {checkOutInProgress && <span style={{ fontSize: 11 }}>⋯</span>}
                        Check-out
                      </div>
                    </div>
                  )}

                  {/* Contract progress */}
                  {isActive && daysLeft !== null && totalDays !== null && totalDays > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#BBB", fontWeight: 500 }}>
                          Contract duration
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: barColor,
                          }}
                        >
                          {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 5,
                          background: "#EEEDE9",
                          borderRadius: 100,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100))}%`,
                            background: barColor,
                            borderRadius: 100,
                            transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: "1px solid #F0EFEC",
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      {property.property_type && (
                        <div
                          style={{
                            flex: 1,
                            background: "#F8F7F4",
                            borderRadius: 12,
                            padding: 12,
                            textAlign: "center",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 10,
                              color: "#BBB",
                              margin: 0,
                              fontWeight: 500,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            Type
                          </p>
                          <p
                            style={{
                              fontSize: 13,
                              color: "#1A1A1A",
                              margin: "4px 0 0",
                              fontWeight: 700,
                              fontFamily: "'Poppins', sans-serif",
                            }}
                          >
                            {property.property_type}
                          </p>
                        </div>
                      )}
                      {tenancy?.annual_rent != null && (
                        <div
                          style={{
                            flex: 1,
                            background: "#F8F7F4",
                            borderRadius: 12,
                            padding: 12,
                            textAlign: "center",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 10,
                              color: "#BBB",
                              margin: 0,
                              fontWeight: 500,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            Rent
                          </p>
                          <p
                            style={{
                              fontSize: 13,
                              color: "#1A1A1A",
                              margin: "4px 0 0",
                              fontWeight: 700,
                              fontFamily: "'Poppins', sans-serif",
                            }}
                          >
                            AED {tenancy.annual_rent.toLocaleString()}
                          </p>
                        </div>
                      )}
                      <div
                        role="button"
                        tabIndex={0}
                        className="cta-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/property/${property.id}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            router.push(`/property/${property.id}`);
                          }
                        }}
                        style={{
                          flex: 1,
                          background: "#9A88FD",
                          borderRadius: 12,
                          padding: 12,
                          textAlign: "center",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                          <rect x="9" y="3" width="6" height="4" rx="1" />
                          <path d="M9 14l2 2 4-4" />
                        </svg>
                        <span
                          style={{
                            fontSize: 10,
                            color: "#fff",
                            fontWeight: 600,
                            marginTop: 4,
                          }}
                        >
                          View
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
