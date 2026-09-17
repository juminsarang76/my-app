-- Supabase RLS 적용 스크립트 (2단계)
--
-- 배경: 모든 테이블에 RLS가 꺼져 있어, 브라우저 번들에 노출되는 publishable(anon) 키로
-- 누구나 전체 데이터를 읽고 쓰고 지울 수 있다. haru_users 의 비밀번호 해시도 조회된다.
--
-- 이 앱은 DB 접근이 전부 서버(Route Handler·서버 컴포넌트)에서만 일어난다.
-- 따라서 anon 역할에는 정책을 하나도 주지 않고(= 전면 거부),
-- 서버는 SUPABASE_SECRET_KEY 로 접근하면 된다. 시크릿 키는 RLS를 우회한다.
--
-- ⚠ 주의: 앱이 200을 반환한다고 해서 시크릿 키를 쓰고 있다는 뜻이 아니다.
--    RLS가 꺼져 있는 동안에는 publishable 키로 폴백해도 똑같이 동작한다.
--    그래서 아래처럼 한 테이블로 먼저 시험한 뒤 나머지를 켠다.


-- ────────────────────────────────────────────────
-- 1단계: todos 한 테이블만 켜고 앱이 살아 있는지 확인
-- ────────────────────────────────────────────────
alter table public.todos enable row level security;

-- 실행 후 브라우저에서 확인:
--   https://haruflower.vercel.app/api/todos
--
--   200 + 기존 목록  → 서버가 시크릿 키로 붙고 있다. 2단계로 진행.
--   빈 배열 또는 오류 → publishable 키로 폴백 중이다. 아래로 즉시 되돌리고
--                      Vercel 의 SUPABASE_SECRET_KEY 설정과 재배포를 먼저 점검할 것.
--
--   되돌리기:  alter table public.todos disable row level security;


-- ────────────────────────────────────────────────
-- 2단계: 1단계가 정상이면 나머지도 켠다
-- ────────────────────────────────────────────────
-- alter table public.haru_users        enable row level security;
-- alter table public.haru_permissions  enable row level security;
-- alter table public.reports           enable row level security;

-- 정책을 하나도 만들지 않으면 anon/authenticated 는 전부 거부된다.
-- (시크릿 키는 RLS 우회이므로 서버 동작에는 영향이 없다.)


-- ────────────────────────────────────────────────
-- 적용 상태 확인
-- ────────────────────────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
