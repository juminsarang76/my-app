import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { requireAdmin } from '@/app/lib/admin-guard'


// 권한 부여
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { user_id, menu_key } = await req.json()
  const { error } = await supabase
    .from('haru_permissions')
    .upsert({ user_id, menu_key }, { onConflict: 'user_id,menu_key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 권한 취소
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { user_id, menu_key } = await req.json()
  const { error } = await supabase
    .from('haru_permissions')
    .delete()
    .eq('user_id', user_id)
    .eq('menu_key', menu_key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
