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

export async function GET() {
  try {
    // Fetch all individual packs from DB
    const { data: packs } = await supabaseAdmin
      .from("credit_packs")
      .select("id, name, credits, price_aed")
      .eq("target", "individual")
      .eq("is_active", true)
      .order("sort_order");

    if (!packs?.length) {
      return NextResponse.json(
        { error: "No individual packs found" },
        { status: 404 }
      );
    }

    const results = [];

    for (const pack of packs) {
      // Create Stripe product
      const product = await stripe.products.create({
        name: `Snagify Credits — ${pack.name}`,
        description: `${pack.credits} inspection credit${Number(pack.credits) > 1 ? "s" : ""} for Snagify`,
        metadata: {
          pack_id: pack.id,
          credits: String(pack.credits),
          target: "individual",
        },
      });

      // Create one-time price in AED
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(Number(pack.price_aed) * 100), // in fils (AED cents)
        currency: "aed",
        metadata: {
          pack_id: pack.id,
          credits: String(pack.credits),
        },
      });

      // Save price ID back to DB
      await supabaseAdmin
        .from("credit_packs")
        .update({
          stripe_price_id: price.id,
          stripe_product_id: product.id,
        })
        .eq("id", pack.id);

      results.push({
        pack: pack.name,
        credits: pack.credits,
        price_aed: pack.price_aed,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[setup-plans GET]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
