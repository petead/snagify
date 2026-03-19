import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { formatPropertyBuildingUnit } from '@/lib/formatPropertyAddress'
import { REMOTE_OTP_MS } from '@/lib/constants'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { inspectionId, signerType } = await req.json()

  // Fetch existing signature + inspection data
  const { data: sig } = await supabaseAdmin
    .from('signatures')
    .select('id, email, signer_name, sign_url, signed_at')
    .eq('inspection_id', inspectionId)
    .eq('signer_type', signerType)
    .single()

  if (!sig) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (sig.signed_at) return NextResponse.json({ error: 'Already signed' }, { status: 400 })
  if (!sig.sign_url) return NextResponse.json({ error: 'No sign URL' }, { status: 400 })

  // Fetch agency branding
  const { data: insp } = await supabaseAdmin
    .from('inspections')
    .select(`
      type, created_at,
      property:properties(location, unit_number, building_name),
      agent:profiles(company:companies(name, logo_url, primary_color))
    `)
    .eq('id', inspectionId)
    .single()

  const agencyName = (insp?.agent as any)?.company?.name || 'Snagify'
  const primaryColor = (insp?.agent as any)?.company?.primary_color || '#9A88FD'
  const agencyLogo = (insp?.agent as any)?.company?.logo_url
  const property = insp?.property as { location?: string; building_name?: string; unit_number?: string }
  const propertyLabel = formatPropertyBuildingUnit(property)
  const propertyAddress = propertyLabel !== '—' ? propertyLabel : 'the property'

  // Reset opened_at so tracking is fresh
  await supabaseAdmin
    .from('signatures')
    .update({
      opened_at: null,
      expires_at: new Date(Date.now() + REMOTE_OTP_MS).toISOString(),
    })
    .eq('id', sig.id)

  // Resend the email (same template as original send)
  await resend.emails.send({
    from: `${agencyName} <noreply@snagify.net>`,
    to: sig.email,
    subject: `Reminder: Please sign the inspection report`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;
        margin:0 auto;padding:32px 24px;">
        
        <div style="background:${primaryColor};border-radius:16px;
          padding:20px 24px;margin-bottom:24px;">
          ${agencyLogo
            ? `<img src="${agencyLogo}" alt="${agencyName}"
                style="height:44px;border-radius:10px;" />`
            : `<div style="font-size:18px;font-weight:800;color:white;">
                ${agencyName}</div>`
          }
        </div>

        <h2 style="font-size:20px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">
          Reminder: Your signature is needed
        </h2>
        <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
          Hi ${sig.signer_name || signerType}, this is a reminder to sign
          the inspection report for <strong>${propertyAddress}</strong>.
        </p>

        <a href="${sig.sign_url}"
          style="display:block;background:${primaryColor};color:white;
          text-align:center;padding:16px 24px;border-radius:14px;
          font-size:15px;font-weight:800;text-decoration:none;
          margin-bottom:16px;">
          Review &amp; Sign Report →
        </a>

        <p style="font-size:11px;color:#9B9BA8;text-align:center;
          line-height:1.5;margin:0;">
          This link expires in 30 minutes. If you didn't expect this,
          please ignore it.
        </p>

        <div style="margin-top:32px;padding-top:16px;
          border-top:1px solid #F3F3F8;text-align:center;
          font-size:11px;color:#C4C4C4;">
          Powered by Snagify · app.snagify.net
        </div>
      </div>
    `,
  })

  return NextResponse.json({ success: true })
}
