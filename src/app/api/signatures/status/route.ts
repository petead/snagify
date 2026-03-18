import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const inspectionId = req.nextUrl.searchParams.get('inspectionId')
  if (!inspectionId) return NextResponse.json({ error: 'Missing' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('signatures')
    .select('signer_type, signed_at, opened_at, signing_mode, sign_url, email, expires_at')
    .eq('inspection_id', inspectionId)

  return NextResponse.json({ signatures: data || [] })
}
