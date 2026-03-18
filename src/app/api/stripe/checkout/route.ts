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
      pack_id?: string;
      plan_slug?: string;
    };
    const { type, price_id, pack_id, plan_slug } = body;

    if (!price_id) {
      return NextResponse.json({ error: "Missing price_id" }, { status: 400 });
    }

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
    const successUrl = isSubscription
      ? `${appUrl}/profile?subscribed=true`
      : `${appUrl}/dashboard?payment=success`;
    const cancelUrl = isSubscription
      ? `${appUrl}/profile`
      : `${appUrl}/dashboard?payment=cancelled`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        supabase_user_id: user.id,
        company_id: profile.company_id,
        type: type ?? "one_time",
        ...(pack_id ? { pack_id } : {}),
        ...(plan_slug ? { plan_slug } : {}),
      },
      ...(type === "subscription"
        ? {
            subscription_data: {
              metadata: {
                company_id: profile.company_id,
                plan_slug: plan_slug || "",
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
