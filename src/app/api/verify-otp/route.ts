import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const normalizePhone = (phone: string) => {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "").replace(/^0+/, "");
  if (cleaned.startsWith("971")) cleaned = "+" + cleaned;
  else if (!cleaned.startsWith("+")) cleaned = "+971" + cleaned;
  return cleaned;
};

export async function POST(request: Request) {
  const { phone, otp, signatureData, inspectionId, signerType } = await request.json();

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  const formattedPhone = normalizePhone(phone);

  try {
    // Verify OTP with Twilio
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({
        to: formattedPhone,
        code: otp,
      });

    if (check.status !== "approved") {
      return Response.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    // Save signature in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from("signatures").upsert(
      {
        inspection_id: inspectionId,
        signer_type: signerType,
        phone: formattedPhone,
        otp_verified: true,
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
      },
      { onConflict: "inspection_id,signer_type" }
    );

    // Check if both landlord + tenant have signed
    const { data: allSigs } = await supabase
      .from("signatures")
      .select("signer_type, otp_verified")
      .eq("inspection_id", inspectionId);

    const bothSigned = allSigs?.every((s) => s.otp_verified) ?? false;

    if (bothSigned) {
      await supabase
        .from("inspections")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
        })
        .eq("id", inspectionId);
    }

    return Response.json({ success: true, bothSigned });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Verify check error:", err.message);
    return Response.json({ error: err.message ?? "Verify check failed" }, { status: 500 });
  }
}
