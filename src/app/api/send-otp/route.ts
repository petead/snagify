import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const normalizePhone = (phone: string) => {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "").replace(/^0+/, "");
  if (cleaned.startsWith("971")) cleaned = "+" + cleaned;
  else if (!cleaned.startsWith("+")) cleaned = "+971" + cleaned;
  return cleaned;
};

export async function POST(request: Request) {
  console.log("=== ENV CHECK ===");
  console.log("ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + "...");
  console.log("AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN?.substring(0, 10) + "...");
  console.log("SMS_FROM:", process.env.TWILIO_SMS_FROM);
  console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30));
  console.log("SERVICE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + "...");

  // Return early to test env only:
  // return Response.json({
  //   sid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 10),
  //   token: process.env.TWILIO_AUTH_TOKEN?.substring(0, 10),
  //   from: process.env.TWILIO_SMS_FROM,
  // });

  const { phone, inspectionId, signerType } = await request.json();

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const formattedPhone = normalizePhone(phone);

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Generate sign URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://snagify.vercel.app";
  const signUrl = `${appUrl}/sign?inspectionId=${inspectionId}&signerType=${signerType}&phone=${encodeURIComponent(formattedPhone)}`;

  // Save OTP in Supabase
  const { error: dbError } = await supabase.from("signatures").upsert(
    {
      inspection_id: inspectionId,
      signer_type: signerType,
      phone: formattedPhone,
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

  // Send single SMS with OTP + sign link
  try {
    await client.messages.create({
      from: process.env.TWILIO_SMS_FROM!,
      to: formattedPhone,
      body: `🏢 Snagify Inspection Report

Your verification code: ${otp}
Valid for 30 minutes.

Sign your report here:
${signUrl}`,
    });

    return Response.json({ success: true, signUrl });
  } catch (smsError: unknown) {
    const err = smsError as { message?: string };
    console.error("SMS error:", err.message);
    return Response.json({ error: err.message ?? "SMS failed" }, { status: 500 });
  }
}
