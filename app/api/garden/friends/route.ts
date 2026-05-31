import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export async function GET() {
  const { data, error } = await supabase
    .from('garden_friends')
    .select('*')
    .order('id', { ascending: true })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { name, kakao_uuid } = await req.json()
  if (!name?.trim() || !kakao_uuid?.trim()) {
    return NextResponse.json({ error: '이름과 UUID를 입력하세요.' }, { status: 400 })
  }

  // 최대 5명 제한
  const { count } = await supabase
    .from('garden_friends')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: '친구는 최대 5명까지 등록 가능합니다.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('garden_friends')
    .insert({ name: name.trim(), kakao_uuid: kakao_uuid.trim() })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data?.[0])
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('garden_friends').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
