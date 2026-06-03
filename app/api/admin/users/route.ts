import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL } from '@/app/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

function checkAdmin(req: NextRequest) {
  const email = req.headers.get('x-admin-email') ?? ''
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data: users } = await supabase
    .from('haru_users')
    .select('id, name, email, created_at')
    .order('created_at', { ascending: false })

  const { data: perms } = await supabase
    .from('haru_permissions')
    .select('user_id, menu_key')

  const result = (users ?? []).map(u => ({
    ...u,
    permissions: (perms ?? []).filter(p => p.user_id === u.id).map(p => p.menu_key),
  }))

  return NextResponse.json(result)
}
