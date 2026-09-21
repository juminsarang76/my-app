-- 서버 상태 저장소 (app_state)
--
-- 용도
--   kakao_token      갱신된 카카오 액세스·리프레시 토큰.
--                    예전에는 갱신 결과를 버리고 매번 환경변수에서 다시 시작해서,
--                    환경변수가 낡으면 조용히 실패했다.
--   kakao_last_send  마지막 전송 성공/실패. /ipsi-news 에 배지로 표시한다.
--
-- 이 테이블이 없어도 앱은 그대로 동작한다(저장만 건너뛴다).
-- 실행하면 토큰이 자동 갱신·보존되고 실패가 눈에 보이게 된다.
--
-- ⚠ 토큰이 들어가므로 anon 키에는 절대 열어주지 않는다. RLS 를 켜고 정책을 두지 않으면
--   서버(시크릿 키)만 접근할 수 있다 — 다른 테이블과 같은 방식이다.

create table if not exists public.app_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- 정책을 만들지 않는다 = anon/authenticated 전면 거부, service_role 만 접근.

-- 확인
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'app_state';
