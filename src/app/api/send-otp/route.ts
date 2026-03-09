import twilio from "twilio";

const normalizePhone = (phone: string) => {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "").replace(/^0+/, "");
  if (cleaned.startsWith("971")) cleaned = "+" + cleaned;
  else if (!cleaned.startsWith("+")) cleaned = "+971" + cleaned;
  return cleaned;
};

export async function POST(request: Request) {
  const { phone, inspectionId, signerType } = await request.json();

  if (!phone || !inspectionId || !signerType) {
    return Response.json(
      { error: "Missing phone, inspectionId, or signerType" },
      { status: 400 }
    );
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  const formattedPhone = normalizePhone(phone);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://snagify.vercel.app";
  const signUrl = `${appUrl}/sign?inspectionId=${inspectionId}&signerType=${signerType}&phone=${encodeURIComponent(formattedPhone)}`;

  try {
    // Twilio Verify sends OTP via SMS
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({
        to: formattedPhone,
        channel: "sms",
      });

    // Send sign URL in a follow-up SMS
    await client.messages.create({
      from: process.env.TWILIO_SMS_FROM!,
      to: formattedPhone,
      body: `Sign your Snagify inspection report here:\n${signUrl}`,
    });

    return Response.json({ success: true, signUrl });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Verify error:", err.message);
    return Response.json({ error: err.message ?? "Verify failed" }, { status: 500 });
  }
}
