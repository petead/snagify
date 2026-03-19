import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { normalizeCompanyNameKey } from "@/lib/profileLabels";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      fullName,
      accountType,
      agencyName,
      primaryColor,
      companyName,
    } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      accountType?: string;
      agencyName?: string;
      primaryColor?: string;
      companyName?: string;
    };

    if (!email || !password || !fullName || !accountType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const companyNameTrimmed = (companyName ?? "").trim();
    if (!companyNameTrimmed) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const resolvedCompanyName =
      accountType === "pro"
        ? (agencyName?.trim() || companyNameTrimmed)
        : companyNameTrimmed;

    const nameKey = normalizeCompanyNameKey(resolvedCompanyName);
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
            "COMPANY_EXISTS: This company already exists. Please contact your manager to be invited as an inspector.",
        },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) throw new Error("User creation failed");

    // Pro: use chosen color. Individual: always Snagify purple default
    const companyColor =
      accountType === "pro" && primaryColor ? primaryColor : "#9A88FD";

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: resolvedCompanyName || null,
        primary_color: companyColor,
        // Default logo = Snagify icon (overrideable later by pro users)
        logo_url: "https://app.snagify.net/icon-512x512.png",
        plan: "free",
        credits_balance: 0,
      })
      .select("id")
      .single();
    if (companyError) throw companyError;
    if (!company?.id) throw new Error("Company could not be created");

    const profileRow: Record<string, unknown> = {
      id: userId,
      full_name: fullName.trim() || null,
      email,
      company_id: company.id,
      onboarding_completed: true,
    };
    if (accountType === "pro") {
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
