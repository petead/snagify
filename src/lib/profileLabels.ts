/**
 * profiles.role = what the user does (owner | agent | inspector).
 * profiles.account_type = subscription tier (individual | pro).
 */

export type ProfileRole = "owner" | "agent" | "inspector";

export type AccountTier = "individual" | "pro";

export function normalizeProfileRole(raw: string | null | undefined): ProfileRole {
  if (raw === "owner" || raw === "agent" || raw === "inspector") return raw;
  return "owner";
}

export function formatProfileRoleLabel(role: ProfileRole): string {
  switch (role) {
    case "inspector":
      return "Inspector";
    case "agent":
      return "Agent";
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
