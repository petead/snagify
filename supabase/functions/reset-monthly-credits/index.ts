import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("id, plan, credits_balance")
      .in("plan", ["pro_solo", "pro_agency", "pro_max"]);

    if (!companies?.length) {
      return new Response(JSON.stringify({ reset: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: plans } = await supabaseAdmin
      .from("subscription_plans")
      .select("slug, credits_per_month, roll_max_multiplier")
      .in("slug", ["pro_solo", "pro_agency", "pro_max"]);

    const planMap = Object.fromEntries((plans || []).map((p) => [p.slug, p]));

    let resetCount = 0;

    for (const company of companies) {
      const plan = planMap[company.plan as string];
      if (!plan) continue;

      const creditsPerMonth = Number(plan.credits_per_month ?? 0);
      const rollMax = creditsPerMonth * Number(plan.roll_max_multiplier ?? 1);
      const newBalance = Math.min(
        Number(company.credits_balance ?? 0) + creditsPerMonth,
        rollMax
      );

      await supabaseAdmin
        .from("companies")
        .update({
          credits_balance: newBalance,
          billing_cycle_reset_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      await supabaseAdmin.from("credit_transactions").insert({
        company_id: company.id,
        type: "rollover_reset",
        credits: creditsPerMonth,
        balance_after: newBalance,
        note: `Monthly reset - ${plan.slug} (${creditsPerMonth} credits added, capped at ${rollMax})`,
      });

      resetCount++;
    }

    return new Response(
      JSON.stringify({ success: true, companies_reset: resetCount }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    console.error("Reset error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
