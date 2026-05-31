import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { data, error } = await supabase
    .from('daily_flowers')
    .select('image_data, image_mime')
    .eq('id', id)
    .single()

  if (error || !data?.image_data) {
    return new NextResponse(null, { status: 404 })
  }

  const buffer = Buffer.from(data.image_data, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': data.image_mime ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
