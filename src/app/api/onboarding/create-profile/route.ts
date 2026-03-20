import { NextResponse } from "next/server";
import { getDefaultSnagifyCompanyId } from "@/lib/onboarding/defaultSnagifyCompany";
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

  let companyIdForRollback: string | null = null;
  const userId = auth.user.id;

  try {
    const body = (await req.json()) as {
      userId?: string;
      fullName?: string;
      email?: string;
      accountType?: string;
      companyId?: string | null;
      individualRole?: string;
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
      userId: bodyUserId,
      fullName,
      email,
      accountType,
      companyId: bodyCompanyId,
      individualRole,
      companyEmail,
      phone,
      addressLine1,
      city,
      country,
      tradeLicense,
      primaryColor,
      website,
      reraNumber,
    } = body;

    if (!bodyUserId || bodyUserId !== auth.user.id) {
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

    let companyId: string;

    if (isPro) {
      if (!bodyCompanyId || typeof bodyCompanyId !== "string") {
        return NextResponse.json(
          { error: "Company id is required for Pro accounts" },
          { status: 400 }
        );
      }
      companyId = bodyCompanyId;
      companyIdForRollback = companyId;
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
    } else {
      companyId = await getDefaultSnagifyCompanyId(supabaseAdmin);
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

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert(profileRow);

    if (profileError) {
      console.error("create-profile insert:", profileError);
      if (isPro && companyIdForRollback) {
        await supabaseAdmin
          .from("companies")
          .delete()
          .eq("id", companyIdForRollback);
      }
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("create-profile:", e);
    if (companyIdForRollback) {
      await supabaseAdmin
        .from("companies")
        .delete()
        .eq("id", companyIdForRollback);
    }
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
