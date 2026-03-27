import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/inventory/snapshots?inspection_id=xxx
// Returns snapshot items for a given inspection
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const inspectionId = searchParams.get('inspection_id')
  if (!inspectionId) return NextResponse.json({ error: 'Missing inspection_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('inventory_snapshots')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('category')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/inventory/snapshots
// Save inventory snapshot for a check-in or check-out
// Body: { inspection_id, items: [...] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    inspection_id: string
    items: {
      reference_item_id?: string
      name: string
      category: string
      quantity: number
      condition_checkin?: string
      photo_url?: string
      status_checkout?: string
      notes?: string
      photo_url_checkout?: string
      quantity_checkout?: number
      is_tenant_item?: boolean
      source?: string
    }[]
  }
  const { inspection_id, items } = body
  if (!inspection_id || !items?.length) {
    return NextResponse.json({ error: 'Missing inspection_id or items' }, { status: 400 })
  }

  // Verify ownership
  const { data: inspection } = await supabaseAdmin
    .from('inspections')
    .select('id, agent_id, type')
    .eq('id', inspection_id)
    .single()
  if (!inspection || inspection.agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // For check-out: update existing snapshots instead of inserting
  if (inspection.type === 'check-out') {
    const updates = items.map(async (item) => {
      if (item.reference_item_id) {
        return supabaseAdmin
          .from('inventory_snapshots')
          .update({
            status_checkout: item.status_checkout,
            notes: item.notes,
            photo_url_checkout: item.photo_url_checkout,
            quantity_checkout: item.quantity_checkout,
          })
          .eq('inspection_id', inspection_id)
          .eq('reference_item_id', item.reference_item_id)
      }
      // New item added at check-out (tenant's own or newly discovered)
      return supabaseAdmin
        .from('inventory_snapshots')
        .insert({
          inspection_id,
          name: item.name,
          category: item.category,
          quantity: item.quantity ?? 1,
          status_checkout: item.status_checkout ?? 'ok',
          notes: item.notes,
          is_tenant_item: item.is_tenant_item ?? false,
          source: item.source ?? 'manual',
        })
    })
    await Promise.all(updates)
    return NextResponse.json({ success: true })
  }

  // For check-in: delete any existing and insert fresh
  await supabaseAdmin
    .from('inventory_snapshots')
    .delete()
    .eq('inspection_id', inspection_id)

  const toInsert = items.map(item => ({
    inspection_id,
    reference_item_id: item.reference_item_id ?? null,
    name: item.name,
    category: item.category,
    quantity: item.quantity ?? 1,
    condition_checkin: item.condition_checkin ?? null,
    photo_url: item.photo_url ?? null,
    notes: item.notes ?? null,
    is_tenant_item: item.is_tenant_item ?? false,
    source: item.source ?? 'manual',
  }))

  const { data, error } = await supabaseAdmin
    .from('inventory_snapshots')
    .insert(toInsert)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}
