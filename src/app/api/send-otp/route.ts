import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
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

    console.log("send-otp called with:", { email, inspectionId, signerType });

    // 1. Init clients
    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Generate OTP + sign URL
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://snagify.vercel.app";
    const signUrl = `${appUrl}/sign?inspectionId=${inspectionId}&signerType=${signerType}&email=${encodeURIComponent(email)}`;

    console.log("Generated OTP:", otp, "Sign URL:", signUrl);

    // 3. Save to Supabase
    const { error: dbError } = await supabase.from("signatures").upsert(
      {
        inspection_id: inspectionId,
        signer_type: signerType,
        email,
        otp_code: otp,
        otp_verified: false,
        expires_at: expiresAt,
        sign_url: signUrl,
      },
      { onConflict: "inspection_id,signer_type" }
    );

    if (dbError) {
      console.error("Supabase error:", dbError);
      return Response.json({ error: dbError.message }, { status: 500 });
    }

    console.log("Saved to Supabase, sending email...");

    // 4. Send email
    const { data, error: emailError } = await resend.emails.send({
      from: "Snagify <noreply@snagify.net>",
      to: email,
      subject: `Sign your inspection report — ${propertyName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;">
          <h2 style="color:#9A88FD;">🏢 Snagify</h2>
          <p>Hi ${signerName},</p>
          <p>You have been invited to sign the <strong>${inspectionType}</strong> inspection report for <strong>${propertyName}</strong>.</p>
          <div style="background:#F8F7FF;border:2px solid #9A88FD;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
            <p style="margin:0;font-size:14px;color:#6B7280;">Your verification code</p>
            <p style="margin:8px 0 0;font-size:40px;font-weight:800;letter-spacing:12px;color:#9A88FD;">${otp}</p>
            <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">Valid for 30 minutes</p>
          </div>
          <a href="${signUrl}" style="display:block;background:#9A88FD;color:#fff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;">
            ✍️ Sign the Report →
          </a>
          <p style="margin-top:24px;font-size:12px;color:#9CA3AF;text-align:center;">
            Powered by Snagify • snagify.net
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return Response.json(
        { error: emailError.message },
        { status: 500 }
      );
    }

    console.log("Email sent successfully:", data);
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
