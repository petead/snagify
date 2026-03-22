import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { REMOTE_OTP_MS } from "@/lib/constants";
import { formatPropertyBuildingUnit } from "@/lib/formatPropertyAddress";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      inspectionId,
      signerType,
      signerName,
      propertyName,
      inspectionType,
    } = body;

    // Capture IP address
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "0.0.0.0";

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.snagify.net";
    
    // TODO: migrate sign_url to use token-based URLs
    // Format: /sign?token=<unique_token>
    // Token stored in signatures.token, looked up server-side
    // This hides inspectionId and email from the URL
    const signUrl = `${appUrl}/sign?inspectionId=${inspectionId}&signerType=${signerType}&email=${encodeURIComponent(email)}`;

    // 30-minute expiration for remote links
    const expiresAt = new Date(Date.now() + REMOTE_OTP_MS).toISOString();

    // Fetch inspection details for branded email
    const { data: inspection } = await supabaseAdmin
      .from("inspections")
      .select(`
        created_at,
        property:properties(building_name, unit_number, location),
        agent:profiles(
          company:companies(name, logo_url, primary_color)
        )
      `)
      .eq("id", inspectionId)
      .single();

    const propertyRow = inspection?.property as
      | { building_name?: string | null; unit_number?: string | null; location?: string | null }
      | null
      | undefined;
    const propertyFromDb = formatPropertyBuildingUnit(propertyRow ?? null);
    const emailPropertyName =
      propertyFromDb !== "—" ? propertyFromDb : propertyName || "Property";

    const company = (inspection?.agent as any)?.company;
    const primaryColor = company?.primary_color || "#9A88FD";
    const agencyName = company?.name || "Snagify";
    const agencyLogo = company?.logo_url;
    const inspectionDate = inspection?.created_at
      ? new Date(inspection.created_at).toLocaleDateString("en-AE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

    const signingWindowMs = 7 * 24 * 60 * 60 * 1000;
    const { data: existingSig } = await supabaseAdmin
      .from("signatures")
      .select("refuse_token, refuse_token_expires_at")
      .eq("inspection_id", inspectionId)
      .eq("signer_type", signerType)
      .maybeSingle();

    const refuseToken =
      existingSig?.refuse_token ?? randomUUID();
    const refuseTokenExpiresAt =
      existingSig?.refuse_token_expires_at ??
      new Date(Date.now() + signingWindowMs).toISOString();

    // Upsert signature record with remote mode
    const { error: dbError } = await supabaseAdmin.from("signatures").upsert(
      {
        inspection_id: inspectionId,
        signer_type: signerType,
        email,
        signer_name: signerName,
        sign_url: signUrl,
        signing_mode: "remote",
        expires_at: expiresAt,
        ip_address: ip,
        refuse_token: refuseToken,
        refuse_token_expires_at: refuseTokenExpiresAt,
        // Reset in_person fields in case it was attempted before
        otp_code: null,
        otp_verified: false,
        signature_data: null,
        signed_at: null,
      },
      { onConflict: "inspection_id,signer_type", ignoreDuplicates: false }
    );

    if (dbError) {
      console.error("Supabase error:", dbError);
      return Response.json({ error: dbError.message }, { status: 500 });
    }

    const refuseUrl = `${appUrl}/sign/refuse?token=${encodeURIComponent(
      refuseToken
    )}&inspectionId=${encodeURIComponent(
      inspectionId
    )}&signerType=${encodeURIComponent(
      signerType
    )}&email=${encodeURIComponent(email)}`;

    // Build agency header HTML
    const agencyHeader = agencyLogo
      ? `<img src="${agencyLogo}" alt="${agencyName}" style="width:44px;height:44px;border-radius:10px;object-fit:contain;background:rgba(255,255,255,0.2);" />`
      : `<div style="width:44px;height:44px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;">${agencyName.charAt(0)}</div>`;

    // Send branded email (NO OTP code - remote flow uses link only)
    const { error: emailError } = await resend.emails.send({
      from: `${agencyName} <noreply@snagify.net>`,
      to: email,
      subject: `Sign your inspection report — ${emailPropertyName}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          
          <!-- Agency header -->
          <div style="background:${primaryColor};border-radius:16px;padding:20px 24px;margin-bottom:24px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  ${agencyHeader}
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:18px;font-weight:800;color:white;">${agencyName}</div>
                  <div style="font-size:12px;color:rgba(255,255,255,0.75);">Property Inspection Report</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Greeting -->
          <h2 style="font-size:20px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">
            Your signature is requested
          </h2>
          <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
            Hi ${signerName || "there"}, you have been invited to sign the inspection report for
            <strong style="color:#1A1A2E;">${emailPropertyName}</strong>.
          </p>

          <!-- Report details -->
          <div style="background:#F8F7F4;border-radius:12px;padding:16px;margin-bottom:24px;">
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr>
                <td style="color:#9B9BA8;padding:4px 0;">Property</td>
                <td style="color:#1A1A2E;font-weight:600;text-align:right;">${emailPropertyName}</td>
              </tr>
              <tr>
                <td style="color:#9B9BA8;padding:4px 0;">Type</td>
                <td style="color:#1A1A2E;font-weight:600;text-align:right;">${inspectionType || "Inspection"}</td>
              </tr>
              <tr>
                <td style="color:#9B9BA8;padding:4px 0;">Date</td>
                <td style="color:#1A1A2E;font-weight:600;text-align:right;">${inspectionDate}</td>
              </tr>
              <tr>
                <td style="color:#9B9BA8;padding:4px 0;">Your role</td>
                <td style="color:#1A1A2E;font-weight:600;text-align:right;text-transform:capitalize;">${signerType}</td>
              </tr>
            </table>
          </div>

          <!-- CTA -->
          <a href="${signUrl}" 
            style="display:block;background:${primaryColor};color:white;text-align:center;
            padding:16px 24px;border-radius:14px;font-size:15px;font-weight:800;
            text-decoration:none;margin-bottom:16px;">
            Review &amp; Sign Report →
          </a>

          <!-- Legal -->
          <p style="font-size:11px;color:#9B9BA8;text-align:center;line-height:1.5;margin:0;">
            This link expires in 30 minutes. By signing, you agree to the findings of this report.
            If you didn't expect this email, please ignore it.
          </p>

          <!-- Refuse option -->
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #F0EFEC;text-align:center;">
            <p style="font-size:12px;color:#9B9BA8;margin:0 0 8px;line-height:1.5;">
              Do you contest the findings of this report?
            </p>
            <a href="${refuseUrl}"
              style="font-size:12px;color:#EF4444;font-weight:600;text-decoration:none;">
              Refuse to sign this report →
            </a>
          </div>

          <!-- Footer -->
          <div style="margin-top:32px;padding-top:16px;border-top:1px solid #F3F3F8;
            text-align:center;font-size:11px;color:#C4C4C4;">
            Powered by Snagify · app.snagify.net
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return Response.json({ error: emailError.message }, { status: 500 });
    }

    return Response.json({ success: true, signUrl });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Unexpected error:", err);
    return Response.json(
      { error: e.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
