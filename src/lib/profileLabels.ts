/**
 * profiles.role = team role: owner (one per company) | inspector (pro, invite-only).
 * profiles.account_type = subscription tier (individual | pro).
 */

export type ProfileRole = "owner" | "inspector";

export type AccountTier = "individual" | "pro";

/** Normalize company name for uniqueness checks (trim + collapse spaces + lower). */
export function normalizeCompanyNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeProfileRole(raw: string | null | undefined): ProfileRole {
  if (raw === "inspector") return "inspector";
  // legacy "agent" treated as owner
  if (raw === "owner" || raw === "agent") return "owner";
  return "owner";
}

export function formatProfileRoleLabel(role: ProfileRole): string {
  switch (role) {
    case "inspector":
      return "Inspector";
    case "owner":
    default:
      return "Owner";
  }
}

export function normalizeAccountTier(raw: string | null | undefined): AccountTier {
  return raw === "pro" ? "pro" : "individual";
}

export function formatAccountTierLabel(tier: AccountTier): string {
  return tier === "pro" ? "Pro" : "Individual";
}
