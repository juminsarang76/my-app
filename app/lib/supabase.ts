import { createClient } from '@supabase/supabase-js'

// 이 클라이언트는 전부 서버(Route Handler·서버 컴포넌트)에서만 쓰인다.
// publishable(anon) 키는 브라우저 번들에 그대로 실려 나가므로, RLS를 켜고 나면
// 그 키로는 아무것도 못 읽게 된다. 서버는 SUPABASE_SERVICE_ROLE_KEY 로 접근한다.
// 서비스 키가 없으면 기존 동작을 유지하도록 publishable 키로 폴백한다.
// SUPABASE_SECRET_KEY = 신규 형식(sb_secret_…), SUPABASE_SERVICE_ROLE_KEY = 레거시 JWT.
// 둘 다 RLS를 우회하는 서버 전용 키다. 어느 쪽 이름으로 넣어도 동작한다.
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
