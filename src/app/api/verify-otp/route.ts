import { createClient } from "@supabase/supabase-js";

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
  }

  return Response.json({ success: true, bothSigned });
}
