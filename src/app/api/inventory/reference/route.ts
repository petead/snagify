import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/inventory/reference?property_id=xxx
// Returns active inventory reference items for a property
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('property_id')
  if (!propertyId) return NextResponse.json({ error: 'Missing property_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('inventory_reference')
    .select('*')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .order('category')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/inventory/reference
// Upsert inventory reference after check-in or check-out is signed
// Body: { property_id, items: [{ name, category, quantity, source }] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    property_id: string
    items: { name: string; category: string; quantity: number; source: string }[]
  }
  const { property_id, items } = body
  if (!property_id || !items?.length) {
    return NextResponse.json({ error: 'Missing property_id or items' }, { status: 400 })
  }

  // Verify ownership
  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, agent_id')
    .eq('id', property_id)
    .single()
  if (!property || property.agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Deactivate all existing items for this property
  await supabaseAdmin
    .from('inventory_reference')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('property_id', property_id)

  // Insert new items
  const toInsert = items.map(item => ({
    property_id,
    name: item.name,
    category: item.category,
    quantity: item.quantity ?? 1,
    source: item.source ?? 'manual',
    is_active: true,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('inventory_reference')
    .insert(toInsert)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}
