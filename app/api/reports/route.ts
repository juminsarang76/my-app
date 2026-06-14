import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'


export async function GET() {
  const { data, error } = await supabase
    .from('reports')
    .select('id, date, summary')
    .not('date', 'like', 'rt_%')
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()

  // 내용 없는 항목 일괄 삭제
  if (body.deleteEmpty) {
    const { error } = await supabase
      .from('reports')
      .delete()
      .or('summary.is.null,summary.eq.')
      .not('date', 'like', 'rt_%')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // 개별 삭제
  const { date } = body
  if (!date) return NextResponse.json({ error: 'date 필요' }, { status: 400 })
  const { error } = await supabase.from('reports').delete().eq('date', date)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
