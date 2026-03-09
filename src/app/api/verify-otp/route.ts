import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token: string;
    otp: string;
    signatureData?: string | null;
  };
  const { token, otp, signatureData } = body;

  if (!token || !otp) {
    return NextResponse.json(
      { error: "Missing token or otp" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: signature, error: fetchErr } = await supabase
    .from("signatures")
    .select("*")
    .eq("token", token)
    .single();

  if (fetchErr || !signature) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  if (signature.otp_verified && signature.signed_at) {
    return NextResponse.json({ error: "Already signed" }, { status: 400 });
  }

  const expiresAt = signature.expires_at as string | null;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Code expired. Please request a new one." },
      { status: 400 }
    );
  }

  if (signature.otp_code !== otp) {
    return NextResponse.json(
      { error: "Invalid code. Please try again." },
      { status: 400 }
    );
  }

  if (signatureData) {
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
    const { error: updateErr } = await supabase
      .from("signatures")
      .update({
        otp_verified: true,
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        ip_address: ip,
      })
      .eq("token", token);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { data: allSignatures } = await supabase
      .from("signatures")
      .select("signer_type, otp_verified, signed_at")
      .eq("inspection_id", signature.inspection_id);

    const bothSigned = (allSignatures ?? []).every(
      (s) => s.otp_verified && (s as { signed_at?: string | null }).signed_at
    );

    if (bothSigned) {
      await supabase
        .from("inspections")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
        })
        .eq("id", signature.inspection_id);
    }

    return NextResponse.json({
      success: true,
      bothSigned,
      inspectionId: signature.inspection_id,
    });
  }

  await supabase
    .from("signatures")
    .update({ otp_verified: true })
    .eq("token", token);

  return NextResponse.json({ success: true });
}
