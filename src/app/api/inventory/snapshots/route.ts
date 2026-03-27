import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const inspectionId = searchParams.get('inspection_id')
  if (!inspectionId) return NextResponse.json({ error: 'Missing inspection_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('inventory_snapshots')
    .select('id, inspection_id, inspection_type, name, category, quantity, condition, photo_url, notes, source, is_tenant_item, created_at')
    .eq('inspection_id', inspectionId)
    .order('category')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    inspection_id: string
    inspection_type: 'check-in' | 'check-out'
    items: {
      name: string
      category: string
      quantity: number
      condition?: string | null
      photo_url?: string | null
      notes?: string | null
      is_tenant_item?: boolean
      source?: string
    }[]
  }

  const { inspection_id, inspection_type, items } = body
  if (!inspection_id || !items?.length) {
    return NextResponse.json({ error: 'Missing inspection_id or items' }, { status: 400 })
  }

  const { data: inspection } = await supabaseAdmin
    .from('inspections')
    .select('id, agent_id, type')
    .eq('id', inspection_id)
    .single()
  if (!inspection || inspection.agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Always DELETE + INSERT for this inspection
  await supabaseAdmin
    .from('inventory_snapshots')
    .delete()
    .eq('inspection_id', inspection_id)

  const toInsert = items.map(item => ({
    inspection_id,
    inspection_type: inspection_type ?? (inspection.type?.includes('check-out') ? 'check-out' : 'check-in'),
    name: item.name,
    category: item.category,
    quantity: item.quantity ?? 1,
    condition: item.condition ?? null,
    photo_url: item.photo_url?.startsWith('http') ? item.photo_url : null,
    notes: item.notes ?? null,
    is_tenant_item: item.is_tenant_item ?? false,
    source: item.source ?? 'manual',
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('inventory_snapshots')
    .insert(toInsert)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}
