import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Capture IP address at signature submission
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'

  const { inspectionId, signerType, signatureData } = await req.json()

  if (!signatureData) {
    return NextResponse.json({ error: 'No signature data' }, { status: 400 })
  }

  // Verify OTP was validated first (for in_person mode)
  // For remote mode, we allow direct signature submission
  const { data: sig } = await supabaseAdmin
    .from('signatures')
    .select('id, otp_verified, signing_mode')
    .eq('inspection_id', inspectionId)
    .eq('signer_type', signerType)
    .single()

  if (!sig) {
    return NextResponse.json({ error: 'Signature not found' }, { status: 404 })
  }

  // For in_person mode, OTP must be verified
  if (sig.signing_mode === 'in_person' && !sig.otp_verified) {
    return NextResponse.json({ error: 'OTP not verified' }, { status: 403 })
  }

  // Save signature with IP address
  await supabaseAdmin
    .from('signatures')
    .update({
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      ip_address: ip,
    })
    .eq('id', sig.id)

  // Check if all parties have signed → update inspection status
  const { data: allSigs } = await supabaseAdmin
    .from('signatures')
    .select('signed_at')
    .eq('inspection_id', inspectionId)

  const allSigned = allSigs?.every(s => s.signed_at != null)

  if (allSigned) {
    await supabaseAdmin
      .from('inspections')
      .update({ status: 'signed', signed_at: new Date().toISOString() })
      .eq('id', inspectionId)
  }

  return NextResponse.json({ success: true, allSigned })
}
