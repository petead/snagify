import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      type?: "one_time" | "subscription";
      price_id?: string;
      packId?: string;
      pack_id?: string;
      plan_slug?: string;
      billing_period?: "monthly" | "annual";
      companyId?: string;
      userId?: string;
      successUrl?: string;
      cancelUrl?: string;
      pro_credits?: boolean;
      quantity?: number;
      price_per_credit?: number;
    };
    const { type, price_id, plan_slug, billing_period = "monthly" } = body;
    const packId = body.packId ?? body.pack_id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, company_id, company:companies(stripe_customer_id, plan)")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "No company found" }, { status: 400 });
    }

    const company = Array.isArray(profile.company) ? profile.company[0] : profile.company;

    let stripeCustomerId = company?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile.email || undefined,
        name: profile.full_name || undefined,
        metadata: {
          supabase_user_id: user.id,
          company_id: profile.company_id,
        },
      });
      stripeCustomerId = customer.id;

      await supabaseAdmin
        .from("companies")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", profile.company_id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.snagify.net";

    const isSubscription = type === "subscription";
    // Always use server-side company_id — never trust client input
    const checkoutCompanyId = profile.company_id;
    const successUrl = isSubscription
      ? (body.successUrl ?? `${appUrl}/profile?subscribed=true`)
      : (body.successUrl ?? `${appUrl}/dashboard?credits=success`);
    const cancelUrl = isSubscription
      ? (body.cancelUrl ?? `${appUrl}/profile`)
      : (body.cancelUrl ?? `${appUrl}/dashboard?payment=cancelled`);

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let checkoutCredits = 0;
    if (isSubscription) {
      let finalPriceId = price_id;

      if (!finalPriceId && plan_slug) {
        const { data: plan } = await supabaseAdmin
          .from("subscription_plans")
          .select("stripe_price_id, stripe_price_id_annual")
          .eq("slug", plan_slug)
          .single();

        finalPriceId =
          billing_period === "annual"
            ? plan?.stripe_price_id_annual ?? undefined
            : plan?.stripe_price_id ?? undefined;
      }

      if (!finalPriceId) {
        return NextResponse.json({ error: "Missing price_id" }, { status: 400 });
      }

      lineItems = [{ price: finalPriceId, quantity: 1 }];
    } else {
      // ── PRO: dynamic quantity × price_per_credit ──
      if (
        body.pro_credits &&
        body.quantity != null &&
        body.price_per_credit != null
      ) {
        const qty = Math.max(1, Math.min(50, Number(body.quantity)));
        const unitPrice = Number(body.price_per_credit);
        checkoutCredits = qty;

        lineItems = [
          {
            price_data: {
              currency: "aed",
              unit_amount: Math.round(unitPrice * 100),
              product_data: {
                name: "Snagify Credits",
                description: `${qty} inspection credit${qty > 1 ? "s" : ""} · ${body.plan_slug ?? ""} plan`,
              },
            },
            quantity: qty,
          },
        ];
      } else {
        // ── INDIVIDUAL: fixed pack — use stripe_price_id from DB ──
        if (!packId) {
          return NextResponse.json({ error: "Missing packId" }, { status: 400 });
        }
        const { data: pack } = await supabaseAdmin
          .from("credit_packs")
          .select("id, name, credits, price_aed, stripe_price_id, is_active")
          .eq("id", packId)
          .eq("is_active", true)
          .single();
        if (!pack) {
          return NextResponse.json({ error: "Pack not found" }, { status: 404 });
        }
        if (!pack.stripe_price_id) {
          return NextResponse.json(
            { error: "Pack not configured in Stripe yet" },
            { status: 400 }
          );
        }
        checkoutCredits = Number(pack.credits ?? 0);
        // Use the pre-created Stripe price ID — clean revenue reporting
        lineItems = [{ price: pack.stripe_price_id, quantity: 1 }];
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: isSubscription ? "subscription" : "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        supabase_user_id: user.id,
        company_id: checkoutCompanyId,
        type: type ?? "one_time",
        ...(packId ? { pack_id: packId } : {}),
        ...(body.pro_credits ? { pro_credits: "true" } : {}),
        ...(checkoutCredits ? { credits: String(checkoutCredits) } : {}),
        ...(plan_slug ? { plan_slug } : {}),
        ...(isSubscription
          ? { billing_period: billing_period ?? "monthly" }
          : {}),
      },
      ...(type === "subscription"
        ? {
            subscription_data: {
              metadata: {
                company_id: checkoutCompanyId,
                plan_slug: plan_slug || "",
                billing_period: billing_period ?? "monthly",
              },
            },
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
