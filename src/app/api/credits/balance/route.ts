import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("account_type, company:companies(credits_balance, plan)")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const company = Array.isArray(data?.company) ? data.company[0] : data?.company;

  return NextResponse.json({
    balance: company?.credits_balance ?? 0,
    plan: company?.plan ?? "free",
    account_type: data?.account_type ?? "individual",
  });
}
