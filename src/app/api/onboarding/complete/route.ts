import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getDefaultSnagifyCompanyId } from "@/lib/onboarding/defaultSnagifyCompany";
import { normalizeCompanyNameKey } from "@/lib/profileLabels";

const admin = createClient(
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

export async function POST(req: Request) {
  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
    error: tokenErr,
  } = await admin.auth.getUser(token);
  if (tokenErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let createdCompanyId: string | null = null;

  try {
    const body = (await req.json()) as {
      userId?: string;
      fullName?: string;
      email?: string;
      accountType?: string;
      companyName?: string;
      companyEmail?: string;
      phone?: string;
      address?: string;
      addressLine1?: string;
      city?: string;
      country?: string;
      tradeLicense?: string;
      primaryColor?: string;
      website?: string;
      reraNumber?: string;
      individualRole?: string;
    };

    const {
      userId,
      fullName,
      email,
      accountType,
      companyName,
      companyEmail,
      phone,
      address,
      addressLine1,
      city,
      country,
      tradeLicense,
      primaryColor,
      website,
      reraNumber,
      individualRole,
    } = body;

    if (!userId || userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!email || !fullName || !accountType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isPro = accountType === "pro";
    const individualRoleTrimmed = (individualRole ?? "").trim();
    if (!isPro) {
      if (
        individualRoleTrimmed !== "owner" &&
        individualRoleTrimmed !== "tenant"
      ) {
        return NextResponse.json(
          { error: "Please choose whether you are an owner or a tenant" },
          { status: 400 }
        );
      }
    }

    const line1Trimmed = (addressLine1 ?? address ?? "").trim();
    const cityTrimmed = (city ?? "").trim();
    const countryTrimmed = (country ?? "").trim();
    const companyNameTrimmed = (companyName ?? "").trim();
    const companyEmailTrimmed = (companyEmail ?? "").trim();
    const phoneTrimmed = (phone ?? "").trim();
    const tradeTrimmed = (tradeLicense ?? "").trim();
    const reraTrimmed = (reraNumber ?? "").trim();
    let websiteTrimmed = (website ?? "").trim();
    if (websiteTrimmed && !/^https?:\/\//i.test(websiteTrimmed)) {
      websiteTrimmed = `https://${websiteTrimmed}`;
    }

    let companyId: string;

    if (isPro) {
      if (!companyNameTrimmed) {
        return NextResponse.json(
          { error: "Company name is required for Pro accounts" },
          { status: 400 }
        );
      }
      if (
        !companyEmailTrimmed ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmailTrimmed)
      ) {
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

      const nameKey = normalizeCompanyNameKey(companyNameTrimmed);
      const { data: existingCompanies } = await admin
        .from("companies")
        .select("id, name");
      const duplicate = (existingCompanies ?? []).some(
        (c) =>
          normalizeCompanyNameKey(c.name ?? "") === nameKey && nameKey.length > 0
      );
      if (duplicate) {
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          {
            error:
              "COMPANY_EXISTS: A company with this name already exists. Please contact your manager to be invited as an inspector.",
          },
          { status: 400 }
        );
      }

      const companyColor = primaryColor?.trim() || "#9A88FD";
      const fullAddress = buildFullAddress(
        line1Trimmed,
        cityTrimmed,
        countryTrimmed
      );

      const { data: company, error: companyError } = await admin
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

      if (companyError) {
        console.error("[onboarding/complete] company:", companyError);
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: `Company creation failed: ${companyError.message}` },
          { status: 500 }
        );
      }
      if (!company?.id) {
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: "Company could not be created" },
          { status: 500 }
        );
      }
      companyId = company.id;
      createdCompanyId = company.id;
    } else {
      companyId = await getDefaultSnagifyCompanyId(admin);
    }

    const profileRow: Record<string, unknown> = {
      id: userId,
      full_name: fullName.trim() || null,
      email,
      company_id: companyId,
      onboarding_completed: true,
      role: "owner",
      receive_signed_report_email: true,
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
      profileRow.company_primary_color = (primaryColor?.trim() ||
        "#9A88FD") as string;
    } else {
      profileRow.account_type = "individual";
      profileRow.individual_role = individualRoleTrimmed;
    }

    if (reraTrimmed) {
      profileRow.rera_number = reraTrimmed;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (profileError) {
      console.error("[onboarding/complete] profile:", profileError);
      if (isPro && createdCompanyId) {
        await admin.from("companies").delete().eq("id", createdCompanyId);
      }
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Profile creation failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, companyId: companyId });
  } catch (err: unknown) {
    console.error("[onboarding/complete]", err);
    if (createdCompanyId) {
      await admin.from("companies").delete().eq("id", createdCompanyId);
    }
    const message = err instanceof Error ? err.message : "Onboarding failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
