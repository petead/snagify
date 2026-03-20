import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getDefaultSnagifyCompanyId } from "@/lib/onboarding/defaultSnagifyCompany";
import { normalizeCompanyNameKey } from "@/lib/profileLabels";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildFullAddress(
  line1: string,
  city: string,
  country: string
): string {
  return [line1.trim(), city.trim(), country.trim()].filter(Boolean).join(", ");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      fullName,
      accountType,
      individualRole,
      primaryColor,
      companyName,
      reraNumber,
      companyEmail,
      phone,
      addressLine1,
      city,
      country,
      tradeLicense,
      website,
    } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      accountType?: string;
      /** Required when accountType is individual */
      individualRole?: string;
      primaryColor?: string;
      companyName?: string;
      reraNumber?: string;
      companyEmail?: string;
      phone?: string;
      addressLine1?: string;
      city?: string;
      country?: string;
      tradeLicense?: string;
      website?: string;
    };

    if (!email || !password || !fullName || !accountType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isPro = accountType === "pro";
    const individualRoleTrimmed = (individualRole ?? "").trim();
    if (!isPro) {
      if (individualRoleTrimmed !== "owner" && individualRoleTrimmed !== "tenant") {
        return NextResponse.json(
          { error: "Please choose whether you are an owner or a tenant" },
          { status: 400 }
        );
      }
    }
    const companyNameTrimmed = (companyName ?? "").trim();
    const reraTrimmed = (reraNumber ?? "").trim();
    const companyEmailTrimmed = (companyEmail ?? "").trim();
    const phoneTrimmed = (phone ?? "").trim();
    const line1Trimmed = (addressLine1 ?? "").trim();
    const cityTrimmed = (city ?? "").trim();
    const countryTrimmed = (country ?? "").trim();
    const tradeTrimmed = (tradeLicense ?? "").trim();
    let websiteTrimmed = (website ?? "").trim();
    if (websiteTrimmed && !/^https?:\/\//i.test(websiteTrimmed)) {
      websiteTrimmed = `https://${websiteTrimmed}`;
    }

    if (isPro && !companyNameTrimmed) {
      return NextResponse.json(
        { error: "Company name is required for Pro accounts" },
        { status: 400 }
      );
    }

    if (isPro) {
      if (!companyEmailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmailTrimmed)) {
        return NextResponse.json(
          { error: "Valid company email is required for Pro accounts" },
          { status: 400 }
        );
      }
      if (!phoneTrimmed) {
        return NextResponse.json(
          { error: "Phone number is required for Pro accounts" },
          { status: 400 }
        );
      }
      if (!line1Trimmed || !cityTrimmed || !countryTrimmed) {
        return NextResponse.json(
          { error: "Address, city, and country are required for Pro accounts" },
          { status: 400 }
        );
      }
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
      const fullAddress = buildFullAddress(line1Trimmed, cityTrimmed, countryTrimmed);

      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          name: companyNameTrimmed,
          primary_color: companyColor,
          logo_url: "https://app.snagify.net/icon-512x512.png",
          plan: "free",
          credits_balance: 0,
          website: websiteTrimmed || null,
          address: fullAddress || null,
          trade_license: tradeTrimmed || null,
        })
        .select("id")
        .single();
      if (companyError) throw companyError;
      if (!company?.id) throw new Error("Company could not be created");
      companyId = company.id;
    } else {
      companyId = await getDefaultSnagifyCompanyId(supabaseAdmin);
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
      profileRow.individual_role = null;
      profileRow.company_email = companyEmailTrimmed;
      profileRow.whatsapp_number = phoneTrimmed;
      profileRow.company_address = buildFullAddress(
        line1Trimmed,
        cityTrimmed,
        countryTrimmed
      );
      profileRow.company_trade_license = tradeTrimmed || null;
      profileRow.company_website = websiteTrimmed || null;
      profileRow.company_primary_color = (primaryColor?.trim() || "#9A88FD") as string;
    } else {
      profileRow.account_type = "individual";
      profileRow.individual_role = individualRoleTrimmed;
    }
    if (reraTrimmed) {
      profileRow.rera_number = reraTrimmed;
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert(profileRow);
    if (profileError) throw profileError;

    return NextResponse.json({ success: true, userId });
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
