import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { requireAdmin } from '@/app/lib/admin-guard'


export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { user_id } = await req.json()
  await supabase.from('haru_permissions').delete().eq('user_id', user_id)
  await supabase.from('haru_users').delete().eq('id', user_id)
  return NextResponse.json({ ok: true })
}
