import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL } from '@/app/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export async function POST(req: NextRequest) {
  const adminEmail = req.headers.get('x-admin-email') ?? ''
  if (adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { user_id, menu_keys } = await req.json()
  if (!user_id || !Array.isArray(menu_keys)) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  // 상태를 approved로 변경
  await supabase.from('haru_users').update({ status: 'approved' }).eq('id', user_id)

  // 기존 권한 삭제 후 새로 추가
  await supabase.from('haru_permissions').delete().eq('user_id', user_id)
  if (menu_keys.length > 0) {
    await supabase.from('haru_permissions').insert(
      menu_keys.map((k: string) => ({ user_id, menu_key: k }))
    )
  }

  return NextResponse.json({ ok: true })
}
