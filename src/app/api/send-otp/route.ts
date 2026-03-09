import { NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// Make sure NEXT_PUBLIC_APP_URL=https://snagify.vercel.app
// is set in Vercel environment variables

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  cleaned = cleaned.replace(/^0+/, "");
  if (cleaned.startsWith("971")) {
    cleaned = "+" + cleaned;
  } else if (!cleaned.startsWith("+")) {
    cleaned = "+971" + cleaned;
  }
  return cleaned;
}

export async function POST(request: Request) {
  const { inspectionId, signerType, phone } = (await request.json()) as {
    inspectionId: string;
    signerType: string;
    phone: string;
  };

  if (!inspectionId || !signerType || !phone) {
    return NextResponse.json(
      { error: "Missing inspectionId, signerType, or phone" },
      { status: 400 }
    );
  }

  const formattedPhone = normalizePhone(phone);
  if (!formattedPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }
  const whatsappTo = `whatsapp:${formattedPhone}`;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !whatsappFrom) {
    return NextResponse.json(
      { error: "Twilio is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)" },
      { status: 500 }
    );
  }

  const client = twilio(accountSid, authToken);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("signatures")
    .select("id")
    .eq("inspection_id", inspectionId)
    .eq("signer_type", signerType)
    .maybeSingle();

  if (existing) {
    const { error: updateErr } = await supabase
      .from("signatures")
      .update({
        otp_code: otp,
        token,
        phone,
        otp_verified: false,
        expires_at: expiresAt,
      })
      .eq("id", existing.id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  } else {
    const { error: insertErr } = await supabase.from("signatures").insert({
      inspection_id: inspectionId,
      signer_type: signerType,
      otp_code: otp,
      token,
      phone,
      otp_verified: false,
      expires_at: expiresAt,
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  const { data: inspection } = await supabase
    .from("inspections")
    .select("type, properties(building_name, unit_number)")
    .eq("id", inspectionId)
    .single();

  const prop = inspection?.properties as
    | { building_name?: string; unit_number?: string }
    | { building_name?: string; unit_number?: string }[]
    | null;
  const propObj = Array.isArray(prop) ? prop[0] : prop;
  const propertyName =
    propObj?.building_name != null && propObj?.unit_number != null
      ? `${propObj.building_name}, Unit ${propObj.unit_number}`
      : "the property";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://snagify.vercel.app";
  const signUrl = `${appUrl}/sign/${token}`;
  const inspectionType = inspection?.type === "check-in" ? "Check-In" : "Check-Out";

  console.log("Sending WhatsApp to:", whatsappTo);
  console.log("Sign URL:", signUrl);

  const body = `🏢 *Snagify — Property Inspection Report*

You have been invited to review and sign the ${inspectionType} inspection report for:
*${propertyName}*

Your verification code is:
*${otp}*

_Valid for 30 minutes_

To sign the report, tap the link below:
${signUrl}

_Powered by Snagify_`;

  try {
    await client.messages.create({
      from: whatsappFrom,
      to: whatsappTo,
      body,
    });
  } catch (twilioError: unknown) {
    console.error("Twilio error:", twilioError);
    const message = twilioError instanceof Error ? twilioError.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to send WhatsApp message: ${message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, token });
}
