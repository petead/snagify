import type { SupabaseClient } from "@supabase/supabase-js";

const ACTION = "checkout_standard";

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

export async function getCheckoutCreditCost(
  supabaseAdmin: SupabaseClient
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("credit_costs")
    .select("credits")
    .eq("action", ACTION)
    .maybeSingle();
  const n = Number(data?.credits);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

export async function hasCheckoutDebitForInspection(
  supabaseAdmin: SupabaseClient,
  inspectionId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("id")
    .eq("inspection_id", inspectionId)
    .eq("action", ACTION)
    .eq("type", "debit")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[checkoutReportDebit] hasCheckoutDebit lookup:", error.message);
    return false;
  }
  return !!data;
}

/**
 * Before generating a check-out PDF: ensure the company has enough credits
 * (unless this inspection was already debited — e.g. PDF regeneration).
 */
export async function assertCanDebitCheckoutReport(
  supabaseAdmin: SupabaseClient,
  inspectionId: string,
  agentId: string
): Promise<void> {
  if (await hasCheckoutDebitForInspection(supabaseAdmin, inspectionId)) {
    return;
  }
  const cost = await getCheckoutCreditCost(supabaseAdmin);
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", agentId)
    .single();
  if (pErr || !profile?.company_id) {
    throw new Error("No company found for agent");
  }
  const { data: company, error: cErr } = await supabaseAdmin
    .from("companies")
    .select("credits_balance")
    .eq("id", profile.company_id)
    .single();
  if (cErr || !company) {
    throw new Error("Company not found");
  }
  const balance = Number(company.credits_balance ?? 0);
  if (balance < cost) {
    throw new InsufficientCreditsError("Insufficient credits", balance, cost);
  }
}

/**
 * After a check-out PDF is generated and stored: deduct credits once per inspection.
 */
export async function debitCheckoutReportAfterPdfSuccess(
  supabaseAdmin: SupabaseClient,
  inspectionId: string,
  agentId: string
): Promise<void> {
  if (await hasCheckoutDebitForInspection(supabaseAdmin, inspectionId)) {
    return;
  }
  const cost = await getCheckoutCreditCost(supabaseAdmin);
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", agentId)
    .single();
  if (pErr || !profile?.company_id) {
    throw new Error("No company for debit");
  }
  const companyId = profile.company_id;

  const { data: company, error: cErr } = await supabaseAdmin
    .from("companies")
    .select("credits_balance")
    .eq("id", companyId)
    .single();
  if (cErr || !company) throw new Error("Company not found for debit");

  const balance = Number(company.credits_balance ?? 0);
  if (balance < cost) {
    throw new InsufficientCreditsError(
      "Insufficient credits after report generation",
      balance,
      cost
    );
  }

  const newBalance = balance - cost;
  const { data: updatedRow, error: updateError } = await supabaseAdmin
    .from("companies")
    .update({ credits_balance: newBalance })
    .eq("id", companyId)
    .eq("credits_balance", balance)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedRow) {
    throw new Error("Credit debit failed, please retry");
  }

  const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
    company_id: companyId,
    type: "debit",
    credits: -cost,
    balance_after: newBalance,
    action: ACTION,
    inspection_id: inspectionId,
    note: "Check-out report generated",
  });
  if (txError) {
    console.error("[checkoutReportDebit] transaction log failed:", txError.message);
  }
}
