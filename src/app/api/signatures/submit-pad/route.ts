import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSignedPdfEmail } from '@/lib/sendSignedPdfEmail'

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
    .select('signed_at, signer_type')
    .eq('inspection_id', inspectionId)

  // Check if ALL REQUIRED parties (landlord + tenant) have signed
  // Inspector does not sign — filter to only required signer types
  const requiredSignerTypes = ['landlord', 'tenant']
  const requiredSigs = allSigs?.filter(
    s => requiredSignerTypes.includes(s.signer_type)
  ) || []

  const allSigned =
    requiredSigs.length >= 2 &&
    requiredSigs.every(s => s.signed_at != null)

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
        id, type, created_at, report_url, pdf_sent_at,
        property:properties(address, unit_number, building_name),
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

    // Only send if not already sent + report exists
    if (
      fullInspection &&
      fullInspection.report_url &&
      !fullInspection.pdf_sent_at
    ) {
      try {
        const company = (fullInspection.agent as any)?.company
        const tenancy = fullInspection.tenancy as any
        const property = fullInspection.property as any
        const agent = fullInspection.agent as any

        const propertyAddress = [
          property?.building_name,
          property?.address,
          property?.unit_number ? `Unit ${property.unit_number}` : null,
        ].filter(Boolean).join(', ') || 'the property'

        const inspectionDate = new Date(fullInspection.created_at)
          .toLocaleDateString('en-AE', {
            day: 'numeric', month: 'long', year: 'numeric',
          })

        await sendSignedPdfEmail({
          landlordName:  tenancy?.landlord_name  || 'Landlord',
          landlordEmail: tenancy?.landlord_email || '',
          tenantName:    tenancy?.tenant_name    || 'Tenant',
          tenantEmail:   tenancy?.tenant_email   || '',
          inspectorName: agent?.full_name        || 'Inspector',
          inspectorEmail: agent?.email           || '',
          agencyName:    company?.name           || 'Snagify',
          agencyLogo:    company?.logo_url,
          primaryColor:  company?.primary_color  || '#9A88FD',
          propertyAddress,
          inspectionType: fullInspection.type,
          inspectionDate,
          pdfUrl: fullInspection.report_url.split('?')[0],
        })

        // Mark as sent
        await supabaseAdmin
          .from('inspections')
          .update({ pdf_sent_at: now })
          .eq('id', inspectionId)

      } catch (emailErr) {
        // Log but don't fail the signature submission
        console.error('Failed to send signed PDF email:', emailErr)
      }
    }
  }

  return NextResponse.json({ success: true, allSigned })
}
