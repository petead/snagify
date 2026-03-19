import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { photoId, damage_tags } = await req.json()
    if (!photoId) return NextResponse.json({ error: 'Missing photoId' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('photos')
      .update({ damage_tags })
      .eq('id', photoId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
