import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Pro onboarding / profile: upload inspector signature to storage + profiles + profile-level signatures row (inspection_id null).
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("signature");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/signature.png`;

  const { error: upErr } = await supabaseAdmin.storage
    .from("signatures")
    .upload(path, buffer, {
      upsert: true,
      contentType: "image/png",
    });

  if (upErr) {
    console.error("[inspector-signature] storage:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from("signatures").getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error: profErr } = await supabaseAdmin
    .from("profiles")
    .update({ signature_image_url: publicUrl })
    .eq("id", user.id);

  if (profErr) {
    console.error("[inspector-signature] profile update:", profErr);
  }

  await supabaseAdmin
    .from("signatures")
    .delete()
    .eq("user_id", user.id)
    .is("inspection_id", null);

  const signatureDataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  const { error: insErr } = await supabaseAdmin.from("signatures").insert({
    user_id: user.id,
    inspection_id: null,
    signer_type: "profile_inspector",
    signature_data: signatureDataUrl,
    signed_at: new Date().toISOString(),
  });

  if (insErr) {
    console.warn(
      "[inspector-signature] signatures row (optional columns / migration):",
      insErr.message
    );
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
