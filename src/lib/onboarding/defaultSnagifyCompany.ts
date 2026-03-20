import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_COMPANY_NAME = "Snagify";

/** Shared company row for personal (individual) accounts. */
export async function getDefaultSnagifyCompanyId(
  supabaseAdmin: SupabaseClient
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("name", DEFAULT_COMPANY_NAME)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("companies")
    .insert({
      name: DEFAULT_COMPANY_NAME,
      primary_color: "#9A88FD",
      logo_url: "https://app.snagify.net/icon-512x512.png",
      plan: "free",
      credits_balance: 0,
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    throw new Error(
      error?.message ??
        "Could not create or find default Snagify company for individual signups"
    );
  }
  return created.id;
}
