import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { IN_PERSON_OTP_MS } from '@/lib/constants'

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
  const expiresAt = new Date(Date.now() + IN_PERSON_OTP_MS)

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

  // Fetch agency branding for email
  const { data: insp } = await supabaseAdmin
    .from('inspections')
    .select('agent:profiles(company:companies(name, primary_color, logo_url))')
    .eq('id', inspectionId)
    .single()

  const agencyName = (insp?.agent as any)?.company?.name || 'Snagify'
  const primaryColor = (insp?.agent as any)?.company?.primary_color || '#9A88FD'

  // Send OTP email via Resend
  await resend.emails.send({
    from: `${agencyName} <noreply@snagify.net>`,
    to: email,
    subject: 'Your signature verification code',
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <div style="background:${primaryColor};border-radius:16px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:18px;font-weight:800;color:white;">${agencyName}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">
            Property Inspection Report
          </div>
        </div>
        <h2 style="font-size:20px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">Your signature code</h2>
        <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
          ${name || 'You'} — enter this code to verify your identity and sign the inspection report.
        </p>
        <div style="background:#EDE9FF;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:${primaryColor};">
            ${otp}
          </span>
        </div>
        <p style="font-size:11px;color:#9B9BA8;text-align:center;line-height:1.5;">
          This code expires in 15 minutes. Do not share it with anyone.
        </p>
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #F3F3F8;
          text-align:center;font-size:11px;color:#C4C4C4;">
          Powered by Snagify · app.snagify.net
        </div>
      </div>
    `,
  })

  return NextResponse.json({ success: true, signatureId: sig.id })
}
