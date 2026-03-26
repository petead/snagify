import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target") || "individual";

  const { data: packs } = await supabase
    .from("credit_packs")
    .select("id, name, credits, price_aed, stripe_price_id, sort_order")
    .eq("target", target)
    .eq("is_active", true)
    .order("sort_order");

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select(
      [
        "id",
        "slug",
        "name",
        "price_aed_monthly",
        "price_aed_monthly_billing",
        "price_aed_annual",
        "credits_per_month",
        "stripe_price_id",
        "stripe_price_id_annual",
        "white_label",
        "max_users",
        "highlight",
        "extra_credit_price_aed",
        "sort_order",
      ].join(", ")
    )
    .eq("is_active", true)
    .order("sort_order");

  return NextResponse.json({
    packs: packs || [],
    plans: plans || [],
  });
}
