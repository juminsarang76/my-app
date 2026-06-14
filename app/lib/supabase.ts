import { createClient } from '@supabase/supabase-js'

// 공용 Supabase 클라이언트 (anon/publishable 키)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)
