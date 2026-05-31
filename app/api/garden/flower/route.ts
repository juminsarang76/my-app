import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

function makeFlowerId(): string {
  const now = new Date(Date.now() + 9 * 3600_000) // KST
  const YY = String(now.getUTCFullYear()).slice(2)
  const MM = String(now.getUTCMonth() + 1).padStart(2, '0')
  const DD = String(now.getUTCDate()).padStart(2, '0')
  const HH = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  const SS = String(now.getUTCSeconds()).padStart(2, '0')
  return `DF_${YY}${MM}${DD}_${HH}${mm}_${SS}`
}

export async function GET() {
  const { data, error } = await supabase
    .from('daily_flowers')
    .select('id, created_at, flower_text, sent_at, image_mime')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST() {
  const id = makeFlowerId()
  const { data, error } = await supabase
    .from('daily_flowers')
    .insert({ id, flower_text: '' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data?.[0])
}
