import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  console.log("=== SEND OTP EMAIL DEBUG ===");
  console.log("RESEND_KEY exists:", !!process.env.RESEND_API_KEY);
  console.log("RESEND_KEY prefix:", process.env.RESEND_API_KEY?.slice(0, 8));

  const body = (await request.json()) as {
    email?: string;
    inspectionId?: string;
    signerType?: string;
    signerName?: string;
    propertyName?: string;
    inspectionType?: string;
  };
  console.log("email received:", body.email);

  const {
    email,
    inspectionId,
    signerType,
    signerName,
    propertyName,
    inspectionType,
  } = body;

  if (!email?.trim() || !inspectionId || !signerType) {
    return Response.json(
      { error: "Missing email, inspectionId, or signerType" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Generate sign URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://snagify.vercel.app";
  const signUrl = `${appUrl}/sign?inspectionId=${inspectionId}&signerType=${signerType}&email=${encodeURIComponent(email)}`;

  // Save OTP in Supabase
  const { error: dbError } = await supabase.from("signatures").upsert(
    {
      inspection_id: inspectionId,
      signer_type: signerType,
      email,
      otp_code: otp,
      otp_verified: false,
      expires_at: expiresAt,
      sign_url: signUrl,
      created_at: new Date().toISOString(),
    },
    { onConflict: "inspection_id,signer_type" }
  );

  if (dbError) {
    return Response.json({ error: dbError.message }, { status: 500 });
  }

  // Send email via Resend
  try {
    await resend.emails.send({
      from: "Snagify <noreply@snagify.net>",
      to: email,
      subject: `Sign your inspection report — ${propertyName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#9A88FD,#7B65FC);padding:32px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:16px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px;">🏢</div>
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;font-family:Poppins,Arial,sans-serif;">Snagify</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Property Inspection Report</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#1A1A1A;font-size:16px;margin:0 0 8px;">Hi ${signerName || "there"},</p>
      <p style="color:#6B7280;font-size:15px;margin:0 0 24px;line-height:1.6;">
        You have been invited to review and sign the 
        <strong style="color:#1A1A1A;">${inspectionType === "check-in" ? "Check-In" : "Check-Out"}</strong> 
        inspection report for:
      </p>

      <!-- Property Card -->
      <div style="background:#F8F7FF;border:1px solid #E8E4FF;border-radius:16px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#1A1A1A;font-family:Poppins,Arial,sans-serif;">
          🏢 ${propertyName || "the property"}
        </p>
      </div>

      <!-- OTP Code -->
      <p style="color:#6B7280;font-size:14px;margin:0 0 12px;text-align:center;">
        Your verification code
      </p>
      <div style="background:#F8F7FF;border:2px solid #9A88FD;border-radius:16px;padding:20px;text-align:center;margin-bottom:8px;">
        <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#9A88FD;font-family:Poppins,Arial,sans-serif;">
          ${otp}
        </p>
      </div>
      <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0 0 28px;">
        Valid for 30 minutes
      </p>

      <!-- CTA Button -->
      <a href="${signUrl}" 
        style="display:block;background:#9A88FD;color:#ffffff;text-decoration:none;text-align:center;padding:16px;border-radius:14px;font-size:16px;font-weight:700;font-family:Poppins,Arial,sans-serif;margin-bottom:16px;">
        ✍️ Sign the Report →
      </a>

      <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0 0 24px;">
        Or copy this link in your browser:<br>
        <span style="color:#9A88FD;">${signUrl}</span>
      </p>

      <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;">

      <p style="color:#D1D5DB;font-size:11px;text-align:center;margin:0;">
        This email was sent by Snagify on behalf of your property agent.<br>
        If you have questions, contact your agent directly.
      </p>
    </div>
  </div>
</body>
</html>
      `,
    });

    return Response.json({ success: true, signUrl });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("Resend error:", err);
    return Response.json({ error: e.message ?? "Email failed" }, { status: 500 });
  }
}
