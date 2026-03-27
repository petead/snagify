import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSignedPdfEmail } from "@/lib/sendSignedPdfEmail";
import { formatPropertyBuildingUnit } from "@/lib/formatPropertyAddress";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { token, reason } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const { data: sig } = await supabase
      .from("signatures")
      .select(
        "id, inspection_id, signer_type, signer_name, email, signed_at, refused_at, refuse_token_expires_at"
      )
      .eq("refuse_token", token)
      .maybeSingle();

    if (!sig) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    if (sig.signed_at) {
      return NextResponse.json(
        { error: "You have already signed this report" },
        { status: 400 }
      );
    }
    if (sig.refused_at) {
      return NextResponse.json(
        { error: "You have already refused this report" },
        { status: 400 }
      );
    }

    if (
      sig.refuse_token_expires_at &&
      new Date(sig.refuse_token_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "This link has expired" },
        { status: 400 }
      );
    }

    await supabase
      .from("signatures")
      .update({
        refused_at: new Date().toISOString(),
        refused_reason: reason || null,
        refuse_token: null,
      })
      .eq("id", sig.id);

    await supabase
      .from("inspections")
      .update({ status: "disputed" })
      .eq("id", sig.inspection_id);

    const { data: insp } = await supabase
      .from("inspections")
      .select(
        `
        type, created_at, report_url, agent_id,
        property:properties(building_name, unit_number, location),
        agent:profiles(
          full_name, email, receive_signed_report_email,
          company:companies(name, logo_url, primary_color)
        )
      `
      )
      .eq("id", sig.inspection_id)
      .single();

    const { data: allSigs } = await supabase
      .from("signatures")
      .select("signer_type, signer_name, email, signed_at, refused_at")
      .eq("inspection_id", sig.inspection_id);

    const landlordSig = allSigs?.find((s) => s.signer_type === "landlord");
    const tenantSig = allSigs?.find((s) => s.signer_type === "tenant");
    const landlordExpressed = !!(landlordSig?.signed_at || landlordSig?.refused_at);
    const tenantExpressed = !!(tenantSig?.signed_at || tenantSig?.refused_at);
    const allExpressed = landlordExpressed && tenantExpressed;
    const agent = insp?.agent as {
      full_name?: string | null;
      email?: string | null;
      receive_signed_report_email?: boolean | null;
      company?:
        | { name?: string | null; logo_url?: string | null; primary_color?: string | null }
        | { name?: string | null; logo_url?: string | null; primary_color?: string | null }[]
        | null;
    } | null;
    const companyRaw = agent?.company;
    const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
    const propertyAddress =
      formatPropertyBuildingUnit(
        insp?.property as {
          building_name?: string | null;
          unit_number?: string | null;
          location?: string | null;
        } | null
      ) || "Property";

    if (allExpressed && insp?.report_url) {
      // Regenerate PDF so refused state is embedded before sending
      let finalPdfUrl = insp.report_url;
      try {
        const { buildPdfAndUpload } = await import("@/app/api/generate-pdf/route");
        if (insp.agent_id) {
          const { data: inspProfile } = await supabase
            .from("profiles")
            .select("account_type, company_id")
            .eq("id", insp.agent_id)
            .maybeSingle();

          // Only regenerate if we have enough context
          if (inspProfile) {
            const result = await buildPdfAndUpload(sig.inspection_id, supabase);
            if (result.report_url) finalPdfUrl = result.report_url;
          }
        }
      } catch (pdfErr) {
        console.error("[refuse] PDF regen failed, using existing URL:", pdfErr);
        // Non-blocking — fall back to existing PDF
      }

      const bothRefused = !!landlordSig?.refused_at && !!tenantSig?.refused_at;

      const propRow = insp?.property as {
        building_name?: string | null;
        unit_number?: string | null;
      } | null;

      await sendSignedPdfEmail({
        landlordName: landlordSig?.signer_name || "Landlord",
        landlordEmail: landlordSig?.email || "",
        tenantName: tenantSig?.signer_name || "Tenant",
        tenantEmail: tenantSig?.email || "",
        inspectorName: agent?.full_name || "Inspector",
        inspectorEmail: agent?.email || "",
        includeInspectorRecipient: agent?.receive_signed_report_email !== false,
        agencyName: company?.name || "Snagify",
        agencyLogo: company?.logo_url ?? null,
        primaryColor: company?.primary_color || "#9A88FD",
        propertyAddress,
        inspectionType: insp?.type || "check-out",
        buildingName: propRow?.building_name ?? null,
        unitNumber: propRow?.unit_number ?? null,
        inspectionDate: insp?.created_at
          ? new Date(insp.created_at).toLocaleDateString("en-AE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—",
        pdfUrl: finalPdfUrl.split("?")[0],
        refusalInfo: bothRefused
          ? {
              refusedParty: "both",
              refusedReason: reason || null,
              refusedAt: new Date().toISOString(),
            }
          : {
              refusedParty: sig.signer_type as "landlord" | "tenant",
              refusedReason: reason || null,
              refusedAt: new Date().toISOString(),
            },
      });
    }

    return NextResponse.json({ success: true, refusedBy: sig.signer_type });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[refuse]", err);
    return NextResponse.json(
      { error: e.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
