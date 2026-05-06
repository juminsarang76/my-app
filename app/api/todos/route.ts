import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// 전체 목록 조회
export async function GET() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// 새 항목 추가
export async function POST(req: Request) {
  const { title } = await req.json()

  const { data, error } = await supabase
    .from('todos')
    .insert({ title })
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}