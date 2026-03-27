import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/inventory/snapshots/by-property?property_id=xxx
// Returns inventory items from the most recent check-in inspection for a property
// Used to pre-populate the inventory selection for a new check-in
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('property_id')
  if (!propertyId) return NextResponse.json({ error: 'Missing property_id' }, { status: 400 })

  const { data: lastCheckin } = await supabaseAdmin
    .from('inspections')
    .select('id')
    .eq('property_id', propertyId)
    .eq('agent_id', user.id)
    .eq('type', 'check-in')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastCheckin) {
    return NextResponse.json({ items: [] })
  }

  const { data, error } = await supabaseAdmin
    .from('inventory_snapshots')
    .select('name, category, quantity, condition, source, is_tenant_item')
    .eq('inspection_id', lastCheckin.id)
    .eq('is_tenant_item', false)
    .order('category')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}
