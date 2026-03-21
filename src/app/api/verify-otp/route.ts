import { createClient } from "@supabase/supabase-js";
import { sendSignedPdfEmail } from "@/lib/sendSignedPdfEmail";
import { formatPropertyBuildingUnit } from "@/lib/formatPropertyAddress";

export async function POST(request: Request) {
  const { email, otp, signatureData, inspectionId, signerType } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find signature record
  const { data: signature, error } = await supabase
    .from("signatures")
    .select("id, otp_code, expires_at, signature_data, signed_at")
    .eq("inspection_id", inspectionId)
    .eq("signer_type", signerType)
    .single();

  if (error || !signature) {
    return Response.json(
      { error: "No OTP found. Please request a new code." },
      { status: 400 }
    );
  }

  if (signature.signature_data && signature.signed_at) {
    return Response.json({ error: "Already signed." }, { status: 400 });
  }

  if (new Date(signature.expires_at) < new Date()) {
    return Response.json(
      { error: "Code expired. Please request a new one." },
      { status: 400 }
    );
  }

  if (signature.otp_code !== otp) {
    return Response.json({ error: "Invalid code. Please try again." }, { status: 400 });
  }

  // Mark verified + save signature
  await supabase
    .from("signatures")
    .update({
      otp_verified: true,
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    })
    .eq("inspection_id", inspectionId)
    .eq("signer_type", signerType);

  // Check if both signed
  const { data: allSigs } = await supabase
    .from("signatures")
    .select("signer_type, signed_at")
    .eq("inspection_id", inspectionId);

  const bothSigned = allSigs?.every((s) => !!s.signed_at) ?? false;

  if (bothSigned) {
    await supabase
      .from("inspections")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
      })
      .eq("id", inspectionId);

    // ── Fetch everything needed to send the signed PDF email ──
    try {
      const { data: insp } = await supabase
        .from("inspections")
        .select(
          `
          type, created_at, report_url,
          property:properties(building_name, unit_number, location),
          agent:profiles(
            full_name, email,
            receive_signed_report_email,
            company:companies(name, logo_url, primary_color)
          )
        `
        )
        .eq("id", inspectionId)
        .single();

      const { data: sigs } = await supabase
        .from("signatures")
        .select("signer_type, signer_name, email")
        .eq("inspection_id", inspectionId);

      const landlordSig = sigs?.find((s) => s.signer_type === "landlord");
      const tenantSig = sigs?.find((s) => s.signer_type === "tenant");

      const agent = insp?.agent as {
        full_name?: string | null;
        email?: string | null;
        receive_signed_report_email?: boolean | null;
        company?: { name?: string | null; logo_url?: string | null; primary_color?: string | null } | null;
      } | undefined;
      const company = agent?.company;
      const propertyRow = insp?.property as {
        building_name?: string | null;
        unit_number?: string | null;
        location?: string | null;
      } | null;
      const propertyAddress = formatPropertyBuildingUnit(propertyRow) || "Property";

      const pdfUrl = insp?.report_url;
      if (!pdfUrl) throw new Error("No report_url on inspection");

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
        inspectionType: insp?.type || "check-in",
        inspectionDate: insp?.created_at
          ? new Date(insp.created_at).toLocaleDateString("en-AE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—",
        pdfUrl,
      });
    } catch (emailErr) {
      // Log but don't fail the response — signing succeeded even if email fails
      console.error("[verify-otp] Failed to send signed PDF email:", emailErr);
    }
  }

  return Response.json({ success: true, bothSigned });
}
