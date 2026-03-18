import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { inspectionId, signerType, signatureData } = await req.json()

  if (!signatureData) {
    return NextResponse.json({ error: 'No signature data' }, { status: 400 })
  }

  // Verify OTP was validated first
  const { data: sig } = await supabaseAdmin
    .from('signatures')
    .select('id, otp_verified')
    .eq('inspection_id', inspectionId)
    .eq('signer_type', signerType)
    .eq('signing_mode', 'in_person')
    .single()

  if (!sig?.otp_verified) {
    return NextResponse.json({ error: 'OTP not verified' }, { status: 403 })
  }

  // Save signature
  await supabaseAdmin
    .from('signatures')
    .update({
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
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
