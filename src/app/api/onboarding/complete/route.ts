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

    // #region agent log
    fetch("http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "116434",
      },
      body: JSON.stringify({
        sessionId: "116434",
        runId: "signup-onboarding-pre-fix",
        hypothesisId: "H1",
        location: "src/app/api/onboarding/complete/route.ts:39",
        message: "onboarding payload summary",
        data: {
          hasUserId: Boolean(userId),
          accountType,
          hasCompanyName: Boolean(companyName),
          hasAddress: Boolean(address),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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

      // #region agent log
      fetch("http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "116434",
        },
        body: JSON.stringify({
          sessionId: "116434",
          runId: "signup-onboarding-pre-fix",
          hypothesisId: "H3",
          location: "src/app/api/onboarding/complete/route.ts:125",
          message: "company insert result",
          data: {
            ok: !companyError,
            companyIdReturned: company?.id ?? null,
            companyErrorCode: companyError?.code ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

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

    // #region agent log
    fetch("http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "116434",
      },
      body: JSON.stringify({
        sessionId: "116434",
        runId: "signup-onboarding-pre-fix",
        hypothesisId: "H1",
        location: "src/app/api/onboarding/complete/route.ts:194",
        message: "profile upsert fields/result",
        data: {
          keys: Object.keys(profilePayload),
          hasCompanyAddress: Object.prototype.hasOwnProperty.call(
            profilePayload,
            "company_address"
          ),
          hasWhatsappNumber: Object.prototype.hasOwnProperty.call(
            profilePayload,
            "whatsapp_number"
          ),
          profileErrorCode: profileError?.code ?? null,
          profileErrorMessage: profileError?.message ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (profileError) {
      console.error("Profile error:", profileError);
      return NextResponse.json(
        { error: `Profile update failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, companyId });
  } catch (err: unknown) {
    // #region agent log
    fetch("http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "116434",
      },
      body: JSON.stringify({
        sessionId: "116434",
        runId: "signup-onboarding-pre-fix",
        hypothesisId: "H4",
        location: "src/app/api/onboarding/complete/route.ts:213",
        message: "route catch",
        data: {
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    console.error("Onboarding complete error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
