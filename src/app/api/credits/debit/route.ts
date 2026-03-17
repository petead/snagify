import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CREDITS_NEEDED = 2;
const ACTION = "checkout_standard";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inspection_id } = (await req.json()) as { inspection_id?: string | null };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id, account_type")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "No company found" }, { status: 400 });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("credits_balance, plan")
      .eq("id", profile.company_id)
      .single();
    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 400 });
    }

    const balance = Number(company.credits_balance ?? 0);
    if (balance < CREDITS_NEEDED) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          credits_balance: balance,
          credits_needed: CREDITS_NEEDED,
          plan: company.plan ?? "free",
          account_type: profile.account_type ?? "individual",
        },
        { status: 402 }
      );
    }

    const newBalance = balance - CREDITS_NEEDED;

    // Optimistic lock on current balance to avoid double debit races.
    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from("companies")
      .update({ credits_balance: newBalance })
      .eq("id", profile.company_id)
      .eq("credits_balance", balance)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedRow) {
      return NextResponse.json(
        { error: "Credit debit failed, please retry" },
        { status: 500 }
      );
    }

    const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
      company_id: profile.company_id,
      type: "debit",
      credits: -CREDITS_NEEDED,
      balance_after: newBalance,
      action: ACTION,
      inspection_id: inspection_id ?? null,
      note: "Check-out started",
    });
    if (txError) {
      console.error("Credit transaction log failed:", txError.message);
    }

    return NextResponse.json({
      success: true,
      credits_debited: CREDITS_NEEDED,
      balance_after: newBalance,
    });
  } catch (err: unknown) {
    console.error("Credit debit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
