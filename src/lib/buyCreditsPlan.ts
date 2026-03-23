/** Normalize company plan from DB to subscription slug for pro credit top-up. */
export function planSlugForBuyCredits(plan: string): string {
  if (plan === "pro_solo") return "starter";
  if (plan === "pro_agency") return "growth";
  if (plan === "pro_max") return "agency";
  return plan;
}

/** Extra credit AED price tier (align with PricingGrid / subscription_plans). */
export function pricePerCreditForBuy(plan: string): number {
  const s = planSlugForBuyCredits(plan);
  if (s === "starter") return 18;
  if (s === "growth") return 15;
  if (s === "agency") return 13;
  return 18;
}
