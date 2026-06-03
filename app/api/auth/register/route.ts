import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL, ALL_MENUS } from '@/app/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { name, email } = await req.json()
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: '이름과 이메일을 입력하세요.' }, { status: 400 })
  }

  // 이미 등록된 이메일이면 기존 정보 반환
  const { data: existing } = await supabase
    .from('haru_users')
    .select('id, name, email')
    .eq('email', email.trim().toLowerCase())
    .single()

  let userId: string

  if (existing) {
    userId = existing.id
  } else {
    const { data, error } = await supabase
      .from('haru_users')
      .insert({ name: name.trim(), email: email.trim().toLowerCase() })
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    userId = data![0].id

    // Admin이면 모든 권한 자동 부여
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      await supabase.from('haru_permissions').insert(
        ALL_MENUS.map(m => ({ user_id: userId, menu_key: m.key }))
      )
    }
  }

  // 권한 조회
  const { data: perms } = await supabase
    .from('haru_permissions')
    .select('menu_key')
    .eq('user_id', userId)

  return NextResponse.json({
    id: userId,
    name: existing?.name ?? name.trim(),
    email: email.trim().toLowerCase(),
    permissions: perms?.map(p => p.menu_key) ?? [],
  })
}
