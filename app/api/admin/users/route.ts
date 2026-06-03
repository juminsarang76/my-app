import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL } from '@/app/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export async function GET(req: NextRequest) {
  const adminEmail = req.headers.get('x-admin-email') ?? ''
  if (adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data: users } = await supabase
    .from('haru_users')
    .select('id, name, email, role, status, created_at')
    .neq('email', ADMIN_EMAIL.toLowerCase())  // admin 본인 제외
    .order('created_at', { ascending: false })

  const { data: perms } = await supabase
    .from('haru_permissions').select('user_id, menu_key')

  const result = (users ?? []).map(u => ({
    ...u,
    permissions: (perms ?? []).filter(p => p.user_id === u.id).map(p => p.menu_key),
  }))

  return NextResponse.json(result)
}
