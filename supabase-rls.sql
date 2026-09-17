-- Supabase RLS 적용 스크립트
--
-- 배경: 현재 모든 테이블에 RLS가 꺼져 있어, 브라우저 번들에 노출되는 publishable(anon) 키로
-- 누구나 전체 데이터를 읽고 쓰고 지울 수 있다. haru_users 의 비밀번호 해시도 조회된다.
--
-- 이 앱은 DB 접근이 전부 서버(Route Handler·서버 컴포넌트)에서만 일어나므로,
-- anon 역할에는 아무 권한도 주지 않고 서버는 service_role 키로 접근하면 된다.
-- service_role 은 RLS를 우회하므로 별도 정책이 필요 없다.
--
-- 실행 전 반드시:
--   1) Vercel 과 .env.local 에 SUPABASE_SECRET_KEY 를 먼저 설정하고 재배포할 것
--      (Supabase 대시보드 → Project Settings → API Keys → Secret keys)
--      레거시 JWT 형식을 쓰면 SUPABASE_SERVICE_ROLE_KEY 로 넣어도 된다.
--   2) 그 다음 이 스크립트를 SQL Editor 에서 실행할 것
--   순서를 바꾸면 앱이 DB를 못 읽어 즉시 장애가 난다.

alter table public.haru_users        enable row level security;
alter table public.haru_permissions  enable row level security;
alter table public.reports           enable row level security;
alter table public.todos             enable row level security;

-- 정책을 하나도 만들지 않으면 anon/authenticated 는 전부 거부된다.
-- (service_role 은 RLS 우회이므로 서버 동작에는 영향이 없다.)

-- 적용 확인
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
