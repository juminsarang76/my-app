import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL, ALL_MENUS, hashPassword } from '@/app/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: '이름, 이메일, 비밀번호를 모두 입력하세요.' }, { status: 400 })
  }

  const lowerEmail = email.trim().toLowerCase()
  const adminUser = isAdminEmail(lowerEmail)
  const role = adminUser ? 'admin' : 'viewer'
  const status = adminUser ? 'approved' : 'pending'

  // 중복 이메일 체크
  const { data: existing } = await supabase
    .from('haru_users')
    .select('id')
    .eq('email', lowerEmail)
    .single()

  if (existing) return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 })

  const { data, error } = await supabase
    .from('haru_users')
    .insert({ name: name.trim(), email: lowerEmail, password: hashPassword(password), role, status })
    .select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userId = data![0].id

  // Admin은 모든 권한 자동 부여
  if (adminUser) {
    await supabase.from('haru_permissions').insert(
      ALL_MENUS.map(m => ({ user_id: userId, menu_key: m.key }))
    )
  }

  const { data: perms } = await supabase
    .from('haru_permissions').select('menu_key').eq('user_id', userId)

  return NextResponse.json({
    id: userId, name: name.trim(), email: lowerEmail,
    role, status, permissions: perms?.map(p => p.menu_key) ?? [],
  })
}

function isAdminEmail(email: string) {
  return email === ADMIN_EMAIL.toLowerCase()
}
