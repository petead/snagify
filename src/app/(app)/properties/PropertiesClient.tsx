"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getTenancyStatus } from "@/lib/tenancy";

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
  location: string | null;
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

function getPropertyStatus(property: PropertyRow): "active" | "vacant" {
  const tenancies = normalizeTenancies(property.tenancies);
  for (const t of tenancies) {
    const s = (t.status as string) || getTenancyStatus(t);
    if (["active", "expiring_soon", "upcoming"].includes(s)) return "active";
  }
  return "vacant";
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

export function PropertiesClient({ properties: initialProperties, fullName, userEmail }: PropertiesClientProps) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");

  const normalizeProperties = useCallback(
    (rows: PropertyRow[]) =>
      (rows ?? []).map((p) => ({
        ...p,
        tenancies: normalizeTenancies(p.tenancies),
      })),
    []
  );

  const [properties, setProperties] = useState(() => normalizeProperties(initialProperties));

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    setProperties(normalizeProperties(initialProperties));
  }, [initialProperties, normalizeProperties]);

  const filtered =
    search.trim() === ""
      ? properties
      : properties.filter((p) => {
          const q = search.toLowerCase();
          const active = getActiveTenancy(normalizeTenancies(p.tenancies));
          return (
            p.building_name?.toLowerCase().includes(q) ||
            p.unit_number?.toLowerCase().includes(q) ||
            (p.location ?? "").toLowerCase().includes(q) ||
            active?.tenant_name?.toLowerCase().includes(q)
          );
        });

  const activeCount = properties.filter((p) => getPropertyStatus(p) === "active").length;
  const vacantCount = properties.filter((p) => getPropertyStatus(p) === "vacant").length;
  const initials = getInitials(fullName, userEmail);

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
      {/* Fixed header — logo, title, search */}
      <div style={{ flexShrink: 0, padding: "16px 20px 12px" }}>
        <div
          className={loaded ? "fade-up" : ""}
          style={{ animationDelay: "0s" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Image
                src="/icon-512x512.png"
                alt="Snagify"
                width={32}
                height={32}
                style={{ width: 32, height: 32, borderRadius: 10, objectFit: "contain" }}
                priority
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A", letterSpacing: -0.3, fontFamily: "'Poppins', sans-serif" }}>
                Snagify
              </span>
            </div>
            <Link
              href="/profile"
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

        <div
          className={loaded ? "fade-up" : ""}
          style={{ paddingTop: 12, animationDelay: "0.06s" }}
        >
          <p style={{ fontSize: 13, color: "#BBB", margin: 0, fontWeight: 500, letterSpacing: 1.2, textTransform: "uppercase" }}>
            Portfolio
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 800, margin: 0, color: "#1A1A1A", letterSpacing: -0.5 }}>
              My Properties
            </h1>
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
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

        <div className={loaded ? "fade-up" : ""} style={{ paddingTop: 12, animationDelay: "0.1s" }}>
          <div style={{ position: "relative" }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#BBB"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input
              className="search-input"
              type="text"
              placeholder="Search by location, unit, or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px 14px 46px",
                borderRadius: 14,
                border: "1.5px solid transparent",
                background: "#EEEDE9",
                fontSize: 16,
                color: "#1A1A1A",
                outline: "none",
                fontFamily: "'DM Sans', sans-serif",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="scroll-hide"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          paddingBottom: 24,
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
          background: #F8F7F4 !important;
        }
        .search-input {
          transition: all 0.3s ease;
          border: 1.5px solid transparent;
        }
        .search-input:focus {
          border-color: #9A88FD;
          background: #fff;
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
      `}</style>

      {/* Property Cards */}
      <div style={{ paddingBottom: 24 }}>
        <div style={{ padding: "16px 24px 0" }}>
          {filtered.map((property, i) => {
            const status = getPropertyStatus(property);
            const name = property.building_name ?? property.location ?? "Property";
            const unit = property.unit_number ? `Unit ${property.unit_number}` : "—";
            const type = property.property_type ?? "";

            return (
              <div
                key={property.id}
                className={`prop-card ${loaded ? "fade-up" : ""}`}
                onClick={() => router.push(`/property/${property.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/property/${property.id}`)}
                style={{
                  background: "#fff",
                  borderRadius: 18,
                  padding: "16px 18px",
                  marginBottom: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  animationDelay: `${0.16 + i * 0.08}s`,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: status === "active" ? "rgba(154,136,253,0.1)" : "#EEEDE9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={status === "active" ? "#9A88FD" : "#BBB"}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#1A1A1A",
                      margin: 0,
                      fontFamily: "'Poppins', sans-serif",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </h3>
                  <p style={{ fontSize: 13, color: "#999", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[unit, type].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: status === "active" ? "#9A88FD" : "#999",
                      background: status === "active" ? "rgba(154,136,253,0.1)" : "#EEEDE9",
                      padding: "4px 10px",
                      borderRadius: 100,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {status}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
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
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
                {search ? "No properties found" : "No properties yet"}
              </h3>
              <p style={{ fontSize: 13, color: "#BBB", margin: "8px 0 0" }}>
                {search ? "Try a different search term" : "Start a new inspection to add a property"}
              </p>
              {!search && (
                <Link
                  href="/inspection/new"
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
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
