import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const inspectionId = searchParams.get('inspectionId')
  const signerType = searchParams.get('signerType')
  const email = searchParams.get('email')

  if (!inspectionId || !signerType || !email) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // Security gate: verify this email is a valid signer for this inspection
  const { data: sig } = await supabaseAdmin
    .from('signatures')
    .select('id, signed_at, otp_verified, signing_mode, opened_at')
    .eq('inspection_id', inspectionId)
    .eq('signer_type', signerType)
    .eq('email', decodeURIComponent(email))
    .single()

  if (!sig) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Set opened_at on first open (tracking when signer opens the link)
  if (!sig.opened_at) {
    await supabaseAdmin
      .from('signatures')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', sig.id)
  }

  // Fetch full inspection data
  const { data: inspection, error } = await supabaseAdmin
    .from('inspections')
    .select(`
      id, type, status, report_url, signed_at, created_at,
      key_handover, executive_summary,
      property:properties(
        id, address, unit_number, property_type, building_name
      ),
      tenancy:tenancies(
        tenant_name, tenant_email,
        landlord_name, landlord_email,
        contract_from, contract_to, annual_rent
      ),
      agent:profiles(
        full_name,
        company:companies(name, logo_url, primary_color, website)
      ),
      rooms(id, name),
      signatures(signer_type, signed_at, otp_verified)
    `)
    .eq('id', inspectionId)
    .single()

  if (error || !inspection) {
    return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
  }

  return NextResponse.json({
    inspection,
    mySig: sig,
  })
}
