import type { SupabaseClient } from "@supabase/supabase-js";

export type ProAccessState =
  | "ok"
  | "no_subscription"
  | "no_credits";

export async function checkProAccess(
  companyId: string,
  requiredCredits: number,
  supabase: SupabaseClient
): Promise<{ state: ProAccessState; balance: number; plan: string }> {
  const { data: company } = await supabase
    .from("companies")
    .select("plan, credits_balance, stripe_subscription_id")
    .eq("id", companyId)
    .single();

  if (!company) return { state: "no_subscription", balance: 0, plan: "free" };

  const hasActivePlan =
    company.plan !== "free" &&
    company.plan !== null &&
    company.stripe_subscription_id !== null;

  // Individual users with purchased credit packs can proceed
  // even without a subscription — they just need credits
  const hasCredits = Number(company.credits_balance ?? 0) >= requiredCredits;
  const isIndividualWithCredits = !hasActivePlan && hasCredits;

  if (!hasActivePlan && !isIndividualWithCredits) {
    return {
      state: "no_subscription",
      balance: Number(company.credits_balance ?? 0),
      plan: company.plan ?? "free",
    };
  }

  if (Number(company.credits_balance ?? 0) < requiredCredits) {
    return {
      state: "no_credits",
      balance: Number(company.credits_balance ?? 0),
      plan: company.plan ?? "free",
    };
  }

  return {
    state: "ok",
    balance: Number(company.credits_balance ?? 0),
    plan: company.plan ?? "free",
  };
}

