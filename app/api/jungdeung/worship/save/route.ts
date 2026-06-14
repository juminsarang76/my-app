import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export const dynamic = 'force-dynamic'

// 저장된 가정예배 목록
export async function GET() {
  const { data, error } = await supabase
    .from('family_worship')
    .select('id, created_at, scripture, hymn')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// 가정예배 저장
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.scripture || !body?.hymn) {
    return NextResponse.json({ error: '저장할 예배 데이터가 없습니다.' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('family_worship')
    .insert({ scripture: body.scripture, hymn: body.hymn, data: body })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}
