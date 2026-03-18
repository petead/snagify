import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { inspectionId, signerType, otpCode } = await req.json()

  const { data: sig, error } = await supabaseAdmin
    .from('signatures')
    .select('id, otp_code, expires_at, otp_verified')
    .eq('inspection_id', inspectionId)
    .eq('signer_type', signerType)
    .eq('signing_mode', 'in_person')
    .single()

  if (error || !sig) {
    return NextResponse.json({ error: 'Signature not found' }, { status: 404 })
  }

  if (sig.otp_verified) {
    return NextResponse.json({ error: 'Already verified' }, { status: 400 })
  }

  if (new Date(sig.expires_at) < new Date()) {
    return NextResponse.json({ error: 'OTP expired' }, { status: 400 })
  }

  if (sig.otp_code !== otpCode) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  // Mark OTP as verified
  await supabaseAdmin
    .from('signatures')
    .update({ otp_verified: true })
    .eq('id', sig.id)

  return NextResponse.json({ success: true, signatureId: sig.id })
}
