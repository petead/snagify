import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Capture IP address
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'

  const { inspectionId, signerType, email, name } = await req.json()

  if (!inspectionId || !signerType || !email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

  // Upsert signature record with in_person mode
  const { data: sig, error } = await supabaseAdmin
    .from('signatures')
    .upsert({
      inspection_id: inspectionId,
      signer_type: signerType,
      email,
      signer_name: name,
      otp_code: otp,
      otp_verified: false,
      expires_at: expiresAt.toISOString(),
      signing_mode: 'in_person',
      ip_address: ip,
      // Reset remote fields in case remote was sent before
      sign_url: null,
      signature_data: null,
      signed_at: null,
    }, {
      onConflict: 'inspection_id,signer_type',
      ignoreDuplicates: false,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send OTP email via Resend
  await resend.emails.send({
    from: 'Snagify <noreply@snagify.net>',
    to: email,
    subject: 'Your signature code',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;">
        <img src="https://app.snagify.net/logo-full.png"
          alt="Snagify" style="height:32px;margin-bottom:24px;" />
        <h2 style="color:#1A1A2E;margin-bottom:8px;">Your signature code</h2>
        <p style="color:#6B7280;margin-bottom:24px;">
          ${name || 'You'} — enter this code in the Snagify app to sign the inspection report.
        </p>
        <div style="background:#EDE9FF;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#9A88FD;">
            ${otp}
          </span>
        </div>
        <p style="color:#9B9BA8;font-size:12px;">
          This code expires in 15 minutes. Do not share it with anyone.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ success: true, signatureId: sig.id })
}
