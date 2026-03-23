import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildPdfAndUpload } from '@/app/api/generate-pdf/route'
import { sendSignedPdfEmail } from '@/lib/sendSignedPdfEmail'
import {
  notifySignatureSigned,
  notifyAllPartiesSigned,
} from '@/lib/pushSignatureNotifications'
import { formatPropertyBuildingUnit } from '@/lib/formatPropertyAddress'

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
      signed_ip_address: ip,
    })
    .eq('id', sig.id)

  // Await push notifications — must complete before Vercel terminates function
  try {
    await Promise.all([
      notifySignatureSigned(sig.id),
      notifyAllPartiesSigned(inspectionId),
    ])
  } catch (err) {
    console.error('[Push] signature notification error:', err)
  }

  // Fetch ALL signatures for this inspection
  const { data: allSigs } = await supabaseAdmin
    .from('signatures')
    .select('signer_type, signed_at, signature_data, refused_at, refused_reason')
    .eq('inspection_id', inspectionId)

  // Required parties: landlord AND tenant must BOTH exist AND be signed
  // Inspector does not sign
  const landlordSig = allSigs?.find(s => s.signer_type === 'landlord')
  const tenantSig = allSigs?.find(s => s.signer_type === 'tenant')

  // allSigned = true ONLY when:
  // 1. Both landlord and tenant signature ROWS exist in DB
  // 2. Both have a non-null signed_at
  // 3. Both have non-null signature_data (pad was actually submitted)
  const allSigned =
    !!landlordSig?.signed_at &&
    !!landlordSig?.signature_data &&
    !!tenantSig?.signed_at &&
    !!tenantSig?.signature_data
  const landlordExpressed = !!(landlordSig?.signed_at || landlordSig?.refused_at)
  const tenantExpressed = !!(tenantSig?.signed_at || tenantSig?.refused_at)
  const allExpressed = landlordExpressed && tenantExpressed
  const anyRefused = !!(landlordSig?.refused_at || tenantSig?.refused_at)

  if (allSigned) {
    const now = new Date().toISOString()

    // Update inspection status
    await supabaseAdmin
      .from('inspections')
      .update({ status: 'signed', signed_at: now })
      .eq('id', inspectionId)

    // Fetch full data needed for email
    const { data: fullInspection } = await supabaseAdmin
      .from('inspections')
      .select(`
        id, type, created_at, report_url, pdf_sent_at, agent_id,
        property:properties(location, unit_number, building_name),
        tenancy:tenancies(
          tenant_name, tenant_email,
          landlord_name, landlord_email
        ),
        agent:profiles(
          full_name, email,
          company:companies(name, logo_url, primary_color)
        )
      `)
      .eq('id', inspectionId)
      .single()

    // Regenerate PDF so landlord/tenant/inspector signatures are embedded, then email once
    if (fullInspection && !fullInspection.pdf_sent_at) {
      try {
        const { report_url: freshReportUrl } = await buildPdfAndUpload(inspectionId)
        if (!freshReportUrl) {
          console.error('[submit-pad] buildPdfAndUpload returned no report_url; skipping signed email')
        } else {
        const company = (fullInspection.agent as any)?.company
        const tenancy = fullInspection.tenancy as any
        const property = fullInspection.property as { location?: string; building_name?: string; unit_number?: string }
        const agent = fullInspection.agent as any

        const propertyLabel = formatPropertyBuildingUnit(property)
        const propertyAddress = propertyLabel !== '—' ? propertyLabel : 'the property'

        const inspectionDate = new Date(fullInspection.created_at)
          .toLocaleDateString('en-AE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })

        let includeInspectorRecipient = true
        const agentId = (fullInspection as { agent_id?: string | null }).agent_id
        if (agentId) {
          const { data: agentPrefs } = await supabaseAdmin
            .from('profiles')
            .select('receive_signed_report_email')
            .eq('id', agentId)
            .maybeSingle()
          includeInspectorRecipient = agentPrefs?.receive_signed_report_email !== false
        }

        await sendSignedPdfEmail({
          landlordName:  tenancy?.landlord_name  || 'Landlord',
          landlordEmail: tenancy?.landlord_email || '',
          tenantName:    tenancy?.tenant_name    || 'Tenant',
          tenantEmail:   tenancy?.tenant_email   || '',
          inspectorName: agent?.full_name        || 'Inspector',
          inspectorEmail: agent?.email           || '',
          includeInspectorRecipient,
          agencyName:    company?.name           || 'Snagify',
          agencyLogo:    company?.logo_url,
          primaryColor:  company?.primary_color  || '#9A88FD',
          propertyAddress,
          inspectionType: fullInspection.type,
          inspectionDate,
          pdfUrl: freshReportUrl.split('?')[0],
        })

        await supabaseAdmin
          .from('inspections')
          .update({ pdf_sent_at: now })
          .eq('id', inspectionId)
        }
      } catch (emailErr) {
        console.error('Failed to regenerate PDF or send signed PDF email:', emailErr)
      }
    }
  } else if (allExpressed && anyRefused) {
    const { data: fullInspection } = await supabaseAdmin
      .from('inspections')
      .select(`
        id, type, created_at, report_url, pdf_sent_at, agent_id,
        property:properties(location, unit_number, building_name),
        tenancy:tenancies(
          tenant_name, tenant_email,
          landlord_name, landlord_email
        ),
        agent:profiles(
          full_name, email,
          company:companies(name, logo_url, primary_color)
        )
      `)
      .eq('id', inspectionId)
      .single()

    if (fullInspection && !fullInspection.pdf_sent_at && fullInspection.report_url) {
      const company = (fullInspection.agent as any)?.company
      const tenancy = fullInspection.tenancy as any
      const property = fullInspection.property as {
        location?: string
        building_name?: string
        unit_number?: string
      }
      const agent = fullInspection.agent as any
      const propertyLabel = formatPropertyBuildingUnit(property)

      let includeInspectorRecipient = true
      const agentId = (fullInspection as any).agent_id
      if (agentId) {
        const { data: agentPrefs } = await supabaseAdmin
          .from('profiles')
          .select('receive_signed_report_email')
          .eq('id', agentId)
          .maybeSingle()
        includeInspectorRecipient = agentPrefs?.receive_signed_report_email !== false
      }

      const refusedSig = landlordSig?.refused_at ? landlordSig : tenantSig
      await sendSignedPdfEmail({
        landlordName: tenancy?.landlord_name || 'Landlord',
        landlordEmail: tenancy?.landlord_email || '',
        tenantName: tenancy?.tenant_name || 'Tenant',
        tenantEmail: tenancy?.tenant_email || '',
        inspectorName: agent?.full_name || 'Inspector',
        inspectorEmail: agent?.email || '',
        includeInspectorRecipient,
        agencyName: company?.name || 'Snagify',
        agencyLogo: company?.logo_url ?? null,
        primaryColor: company?.primary_color || '#9A88FD',
        propertyAddress: propertyLabel !== '—' ? propertyLabel : 'the property',
        inspectionType: fullInspection.type,
        inspectionDate: new Date(fullInspection.created_at).toLocaleDateString('en-AE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        pdfUrl: fullInspection.report_url.split('?')[0],
        refusalInfo: {
          refusedParty: (refusedSig?.signer_type ?? 'tenant') as 'landlord' | 'tenant',
          refusedReason: refusedSig?.refused_reason ?? null,
          refusedAt: refusedSig?.refused_at ?? new Date().toISOString(),
        },
      })

      await supabaseAdmin
        .from('inspections')
        .update({ pdf_sent_at: new Date().toISOString() })
        .eq('id', inspectionId)
    }
  }

  return NextResponse.json({ success: true, allSigned })
}
