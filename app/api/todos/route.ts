import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const { title } = await req.json()

  const { data, error } = await supabase
    .from('todos')
    .insert({ title })
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(req: Request) {
  const { id, is_done } = await req.json()

  const { data, error } = await supabase
    .from('todos')
    .update({ is_done })
    .eq('id', id)
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: Request) {
  const { id } = await req.json()

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}