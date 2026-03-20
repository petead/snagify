import { NextResponse } from "next/server";
import { normalizeCompanyNameKey } from "@/lib/profileLabels";
import {
  requireBearerUser,
  supabaseAdmin,
} from "@/lib/onboarding/requireBearerUser";

function buildFullAddress(
  line1: string,
  city: string,
  country: string
): string {
  return [line1.trim(), city.trim(), country.trim()].filter(Boolean).join(", ");
}

export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as {
      userId?: string;
      companyName?: string;
      companyEmail?: string;
      phone?: string;
      addressLine1?: string;
      city?: string;
      country?: string;
      tradeLicense?: string;
      primaryColor?: string;
      website?: string;
      reraNumber?: string;
    };

    const {
      userId,
      companyName,
      companyEmail,
      phone,
      addressLine1,
      city,
      country,
      tradeLicense,
      primaryColor,
      website,
    } = body;

    if (!userId || userId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyNameTrimmed = (companyName ?? "").trim();
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
    const { data: existingCompanies } = await supabaseAdmin
      .from("companies")
      .select("id, name");
    const duplicate = (existingCompanies ?? []).some(
      (c) =>
        normalizeCompanyNameKey(c.name ?? "") === nameKey && nameKey.length > 0
    );
    if (duplicate) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
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

    if (companyError) {
      console.error("create-company:", companyError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: companyError.message },
        { status: 500 }
      );
    }
    if (!company?.id) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Company could not be created" },
        { status: 500 }
      );
    }

    return NextResponse.json({ companyId: company.id });
  } catch (e: unknown) {
    console.error("create-company:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
