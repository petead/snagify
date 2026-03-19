import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { normalizeCompanyNameKey } from "@/lib/profileLabels";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_COMPANY_NAME = "Snagify";

/** Shared company row for personal (individual) accounts. */
async function getDefaultSnagifyCompanyId(): Promise<string> {
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
      error?.message ?? "Could not create or find default Snagify company for individual signups"
    );
  }
  return created.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      fullName,
      accountType,
      primaryColor,
      companyName,
    } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      accountType?: string;
      primaryColor?: string;
      companyName?: string;
    };

    if (!email || !password || !fullName || !accountType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isPro = accountType === "pro";
    const companyNameTrimmed = (companyName ?? "").trim();

    if (isPro && !companyNameTrimmed) {
      return NextResponse.json(
        { error: "Company name is required for Pro accounts" },
        { status: 400 }
      );
    }

    let companyId: string;

    if (isPro) {
      const nameKey = normalizeCompanyNameKey(companyNameTrimmed);
      const { data: existingCompanies } = await supabaseAdmin
        .from("companies")
        .select("id, name");
      const duplicate = (existingCompanies ?? []).some(
        (c) => normalizeCompanyNameKey(c.name ?? "") === nameKey && nameKey.length > 0
      );
      if (duplicate) {
        return NextResponse.json(
          {
            error:
              "COMPANY_EXISTS: A company with this name already exists. Please contact your manager to be invited as an inspector.",
          },
          { status: 400 }
        );
      }

      const companyColor = primaryColor?.trim() || "#9A88FD";

      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          name: companyNameTrimmed,
          primary_color: companyColor,
          logo_url: "https://app.snagify.net/icon-512x512.png",
          plan: "free",
          credits_balance: 0,
        })
        .select("id")
        .single();
      if (companyError) throw companyError;
      if (!company?.id) throw new Error("Company could not be created");
      companyId = company.id;
    } else {
      companyId = await getDefaultSnagifyCompanyId();
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          account_type: accountType,
          ...(isPro && companyNameTrimmed ? { company_name: companyNameTrimmed } : {}),
        },
      });
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) throw new Error("User creation failed");

    const profileRow: Record<string, unknown> = {
      id: userId,
      full_name: fullName.trim() || null,
      email,
      company_id: companyId,
      onboarding_completed: true,
      role: "owner",
    };
    if (isPro) {
      profileRow.account_type = "pro";
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert(profileRow);
    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Signup error:", err);
    const message =
      String(err).includes("already registered")
        ? "An account with this email already exists."
        : String(err).includes("Password")
          ? "Password must be at least 8 characters."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
