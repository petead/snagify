import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Call POST /api/stripe/setup-plans ONCE to create all products + prices
export async function POST() {
  const plans = [
    {
      slug: "starter",
      name: "Snagify Starter",
      price_monthly: 16300,
      price_annual: 178800,
    },
    {
      slug: "growth",
      name: "Snagify Growth",
      price_monthly: 27200,
      price_annual: 298800,
    },
    {
      slug: "agency",
      name: "Snagify Agency",
      price_monthly: 38100,
      price_annual: 418800,
    },
  ];

  const results: Array<{
    slug: string;
    monthly: string;
    annual: string;
    product: string;
  }> = [];

  for (const plan of plans) {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { plan_slug: plan.slug },
    });

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price_monthly,
      currency: "aed",
      recurring: { interval: "month" },
      metadata: { plan_slug: plan.slug, billing_period: "monthly" },
    });

    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price_annual,
      currency: "aed",
      recurring: { interval: "year" },
      metadata: { plan_slug: plan.slug, billing_period: "annual" },
    });

    await supabaseAdmin
      .from("subscription_plans")
      .update({
        stripe_price_id: monthlyPrice.id,
        stripe_price_id_annual: annualPrice.id,
        stripe_product_id: product.id,
      })
      .eq("slug", plan.slug);

    results.push({
      slug: plan.slug,
      monthly: monthlyPrice.id,
      annual: annualPrice.id,
      product: product.id,
    });
  }

  return NextResponse.json({ success: true, results });
}
