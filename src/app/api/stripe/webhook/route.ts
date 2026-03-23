import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, skipped: true });
  }

  await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "payment") break;

        const companyId = session.metadata?.company_id || "";
        const packId = session.metadata?.pack_id || "";
        const userId = session.metadata?.supabase_user_id || "";
        const creditsFromMeta = Number(session.metadata?.credits ?? 0);

        let creditsToAdd = creditsFromMeta;
        let packName = "credits";
        if (packId) {
          const { data: pack } = await supabaseAdmin
            .from("credit_packs")
            .select("credits, name")
            .eq("id", packId)
            .single();
          if (pack?.credits) creditsToAdd = Number(pack.credits);
          if (pack?.name) packName = pack.name;
        }
        if (!creditsToAdd || Number.isNaN(creditsToAdd)) break;

        let targetCompanyId = companyId;
        if (!targetCompanyId && userId) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("company_id")
            .eq("id", userId)
            .single();
          targetCompanyId = profile?.company_id ?? "";
        }
        if (!targetCompanyId) break;

        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("credits_balance")
          .eq("id", targetCompanyId)
          .single();
        const newBalance = Number(company?.credits_balance ?? 0) + creditsToAdd;

        await supabaseAdmin
          .from("companies")
          .update({ credits_balance: newBalance })
          .eq("id", targetCompanyId);

        await supabaseAdmin.from("credit_transactions").insert({
          company_id: targetCompanyId,
          type: "purchase",
          credits: creditsToAdd,
          balance_after: newBalance,
          ...(packId ? { pack_id: packId } : {}),
          stripe_payment_intent_id: session.payment_intent as string,
          action: "pack_purchase",
          note: `Purchased ${packName} - ${creditsToAdd} credits`,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Stripe SDK v17+ uses parent.subscription_details instead of invoice.subscription
        const subscriptionId =
          (invoice as any).subscription ||
          (invoice as any).parent?.subscription_details?.subscription;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId as string
        );
        const companyId = subscription.metadata?.company_id;
        const planSlug = subscription.metadata?.plan_slug;
        if (!companyId || !planSlug) break;

        const { data: plan } = await supabaseAdmin
          .from("subscription_plans")
          .select("credits_per_month, roll_max_multiplier, name")
          .eq("slug", planSlug)
          .single();
        if (!plan) break;

        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("credits_balance")
          .eq("id", companyId)
          .single();

        const currentBalance = Number(company?.credits_balance ?? 0);
        const creditsPerMonth = Number(plan.credits_per_month ?? 0);
        const rollMax = creditsPerMonth * Number(plan.roll_max_multiplier ?? 1);
        const newBalance = Math.min(currentBalance + creditsPerMonth, rollMax);

        const billingPeriod =
          subscription.metadata?.billing_period ?? "monthly";

        await supabaseAdmin
          .from("companies")
          .update({
            credits_balance: newBalance,
            plan: planSlug,
            stripe_subscription_id: subscriptionId as string,
            billing_cycle_reset_at: new Date().toISOString(),
            billing_period: billingPeriod,
          })
          .eq("id", companyId);

        await supabaseAdmin.from("credit_transactions").insert({
          company_id: companyId,
          type: "purchase",
          credits: creditsPerMonth,
          balance_after: newBalance,
          note: `Monthly credits - ${plan.name} (${creditsPerMonth} credits, capped at ${rollMax})`,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const companyId = subscription.metadata?.company_id;
        if (!companyId) break;

        await supabaseAdmin
          .from("companies")
          .update({
            plan: "free",
            stripe_subscription_id: null,
          })
          .eq("id", companyId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const companyId = subscription.metadata?.company_id;
        let planSlug: string | undefined = subscription.metadata?.plan_slug;

        if (!companyId) break;

        if (!planSlug) {
          const priceId = subscription.items.data[0]?.price?.id;
          if (priceId) {
            const { data: planRow } = await supabaseAdmin
              .from("subscription_plans")
              .select("slug")
              .or(
                `stripe_price_id.eq.${priceId},stripe_price_id_annual.eq.${priceId}`
              )
              .maybeSingle();
            planSlug = planRow?.slug;
          }
        }

        if (!planSlug) break;

        const billingPeriod =
          subscription.metadata?.billing_period ?? "monthly";

        await supabaseAdmin
          .from("companies")
          .update({
            plan: planSlug,
            stripe_subscription_id: subscription.id,
            billing_period: billingPeriod,
          })
          .eq("id", companyId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          (invoice as any).subscription ||
          (invoice as any).parent?.subscription_details?.subscription;

        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId as string
        );
        const companyId = subscription.metadata?.company_id;
        if (!companyId) break;

        await supabaseAdmin
          .from("companies")
          .update({ plan: "free" })
          .eq("id", companyId);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({
      received: true,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
