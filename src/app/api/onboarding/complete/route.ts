import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getDefaultSnagifyCompanyId } from "@/lib/onboarding/defaultSnagifyCompany";

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
  try {
    const body = await req.json();
    const {
      userId,
      fullName,
      email,
      accountType,
      individualRole,
      companyName,
      companyEmail,
      phone,
      address,
      city,
      country,
      tradeLicense,
      primaryColor,
      website,
      reraNumber,
    } = body as Record<string, string | undefined | null>;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!email || !fullName || !accountType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isPro = accountType === "pro";
    const individualRoleTrimmed = String(individualRole ?? "").trim();

    if (!isPro) {
      if (individualRoleTrimmed !== "owner" && individualRoleTrimmed !== "tenant") {
        return NextResponse.json(
          { error: "Please choose whether you are an owner or a tenant" },
          { status: 400 }
        );
      }
    }

    let companyId: string | null = null;

    // ── 1. Create company for Pro accounts ──
    if (isPro) {
      const name = (companyName ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "Company name is required for Pro accounts" },
          { status: 400 }
        );
      }
      const companyEmailTrimmed = (companyEmail ?? "").trim();
      if (
        !companyEmailTrimmed ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmailTrimmed)
      ) {
        return NextResponse.json(
          { error: "Valid company email is required for Pro accounts" },
          { status: 400 }
        );
      }
      const phoneTrimmed = (phone ?? "").trim();
      if (!phoneTrimmed) {
        return NextResponse.json(
          { error: "Phone number is required for Pro accounts" },
          { status: 400 }
        );
      }

      const line1 = (address ?? "").trim();
      const cityT = (city ?? "").trim();
      const countryT = (country ?? "").trim();
      if (!line1 || !cityT || !countryT) {
        return NextResponse.json(
          { error: "Address, city, and country are required for Pro accounts" },
          { status: 400 }
        );
      }

      let websiteT = (website ?? "").trim();
      if (websiteT && !/^https?:\/\//i.test(websiteT)) {
        websiteT = `https://${websiteT}`;
      }

      const { data: company, error: companyError } = await admin
        .from("companies")
        .insert({
          name,
          address: buildFullAddress(line1, cityT, countryT) || null,
          trade_license: (tradeLicense ?? "").trim() || null,
          primary_color: (primaryColor ?? "").trim() || "#9A88FD",
          website: websiteT || null,
          logo_url: "https://app.snagify.net/icon-512x512.png",
        })
        .select("id")
        .single();

      if (companyError) {
        console.error("Company error:", companyError);
        return NextResponse.json(
          { error: `Company creation failed: ${companyError.message}` },
          { status: 500 }
        );
      }
      companyId = company.id;
    } else {
      companyId = await getDefaultSnagifyCompanyId(admin);
    }

    const line1 = (address ?? "").trim();
    const cityT = (city ?? "").trim();
    const countryT = (country ?? "").trim();
    let websiteT = (website ?? "").trim();
    if (websiteT && !/^https?:\/\//i.test(websiteT)) {
      websiteT = `https://${websiteT}`;
    }

    // ── 2. Upsert profile (DB trigger may have created a minimal row) ──
    const profilePayload: Record<string, unknown> = {
      id: userId,
      full_name: (fullName ?? "").trim() || null,
      email,
      account_type: accountType,
      individual_role: isPro ? null : individualRoleTrimmed,
      company_id: companyId,
      rera_number: (reraNumber ?? "").trim() || null,
      onboarding_completed: true,
      receive_signed_report_email: true,
      role: "owner",
    };

    if (isPro) {
      profilePayload.company_email = (companyEmail ?? "").trim() || null;
      profilePayload.whatsapp_number = (phone ?? "").trim() || null;
      profilePayload.company_address = buildFullAddress(line1, cityT, countryT);
      profilePayload.company_trade_license = (tradeLicense ?? "").trim() || null;
      profilePayload.company_website = websiteT || null;
      profilePayload.company_primary_color =
        (primaryColor ?? "").trim() || "#9A88FD";
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      console.error("Profile error:", profileError);
      return NextResponse.json(
        { error: `Profile update failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, companyId });
  } catch (err: unknown) {
    console.error("Onboarding complete error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
