import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type InspectionType = "check-in" | "check-out";
export type AccountType = "pro" | "individual";

export class InsufficientCreditsError extends Error {
  constructor(
    message: string,
    public balance: number,
    public credits_needed: number
  ) {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export function creditActionFor(
  inspectionType: InspectionType,
  accountType: AccountType
): string {
  return accountType === "pro"
    ? inspectionType === "check-in"
      ? "pro_checkin"
      : "pro_checkout"
    : inspectionType === "check-in"
      ? "individual_checkin"
      : "individual_checkout";
}

export async function getCreditCost(
  inspectionType: InspectionType,
  accountType: AccountType
): Promise<number> {
  const action = creditActionFor(inspectionType, accountType);

  const { data, error } = await admin
    .from("credit_costs")
    .select("credits")
    .eq("action", action)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.error(`getCreditCost failed for ${action}:`, error);
    return inspectionType === "check-in" && accountType === "individual" ? 0 : 1;
  }

  return Number(data.credits ?? 0);
}

export async function deductCredits({
  supabaseAdmin,
  companyId,
  inspectionId,
  inspectionType,
  accountType,
}: {
  supabaseAdmin: SupabaseClient;
  companyId: string;
  inspectionId: string;
  inspectionType: InspectionType;
  accountType: AccountType;
}): Promise<{ success: boolean; newBalance: number; cost: number }> {
  const action = creditActionFor(inspectionType, accountType);
  const cost = await getCreditCost(inspectionType, accountType);

  if (cost === 0) {
    return { success: true, newBalance: -1, cost: 0 };
  }

  const { data: existingDebit } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, balance_after")
    .eq("inspection_id", inspectionId)
    .eq("action", action)
    .eq("type", "debit")
    .limit(1)
    .maybeSingle();
  if (existingDebit) {
    return {
      success: true,
      newBalance: Number(existingDebit.balance_after ?? -1),
      cost,
    };
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("credits_balance")
    .eq("id", companyId)
    .single();

  const balance = Number(company?.credits_balance ?? 0);
  if (!company || balance < cost) {
    return { success: false, newBalance: balance, cost };
  }

  const newBalance = balance - cost;

  await supabaseAdmin
    .from("companies")
    .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  await supabaseAdmin.from("credit_transactions").insert({
    company_id: companyId,
    type: "debit",
    credits: -cost,
    balance_after: newBalance,
    action,
    inspection_id: inspectionId,
    note: `${inspectionType} inspection — ${accountType} account`,
  });

  return { success: true, newBalance, cost };
}

