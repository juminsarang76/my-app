# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Node.js is **not in the system PATH**. Use absolute paths via the Bash tool:

```bash
# Dev server
"/c/Program Files/nodejs/node.exe" "./node_modules/next/dist/bin/next" dev

# Type check (no output = no errors)
"/c/Program Files/nodejs/node.exe" "./node_modules/typescript/bin/tsc" --noEmit

# Build
"/c/Program Files/nodejs/node.exe" "./node_modules/next/dist/bin/next" build

# Lint
"/c/Program Files/nodejs/node.exe" "./node_modules/eslint/bin/eslint.js" .
```

`node_modules/.bin/` 안의 파일은 sh 래퍼(`#!/bin/sh`)라 node.exe로 직접 실행하면 `SyntaxError`가 납니다. 위처럼 패키지의 실제 JS 진입점을 쓰세요.

PowerShell aliases `curl` → `Invoke-WebRequest`. Use `curl.exe` for HTTP requests in PowerShell.  
Path alias `@/*` → project root (e.g. `@/app/lib/news`).

## Next.js 16 breaking changes to know

- **`params` is a Promise** in dynamic routes and layouts — always `await params` before destructuring.
- **`viewport` meta** is auto-injected by Next.js — never add `<meta name="viewport">` manually in `<head>`.
- Route Handlers are **not cached by default**; use `export const dynamic = 'force-static'` to opt in.
- Read `node_modules/next/dist/docs/` before adding new Next.js features.

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS v4 · Supabase (postgres) · Groq `llama-3.3-70b-versatile` · Kakao Talk API · Yahoo Finance

### Pages

| Route | Component type | Purpose |
|-------|---------------|---------|
| `/` | Client | 할 일 목록 — CRUD via `/api/todos` |
| `/reports` | Server | 정기요약 목록 — queries Supabase, filters out `rt_` rows |
| `/reports/[date]` | Server | 정기요약 상세 — `date` param matches Supabase `date` column |
| `/realtime` | Client | 실시간요약 — auto-POSTs `/api/realtime-report` on mount, shows result, "카카오톡 전송" button calls `/api/send-kakao` |
| `/stocks` | Server | 증시지수 — Yahoo Finance data, TradingView links, 5 min revalidate |
| `/ipsi-news` | Client | 오늘 입시뉴스 — `/api/admission-news/daily` 조회, 카카오톡 전송 |
| `/password` | Client | 비밀번호 변경 — 본인 세션 토큰으로 인가 |
| `/reset` | Client | 비밀번호 재설정 — 카카오톡으로 받은 1회성 토큰 사용 |
| `/photos` | Server | 플레이스홀더 |

### 정적 문서 (`public/`)

허브 HTML이 같은 폴더의 형제 파일을 상대경로로 링크한다. **파일을 옮기면 허브 링크와 `ALL_MENUS`의 href를 함께 고쳐야 한다.**

```
public/
├── univ/              ← 입시전쟁 계열 (개인정보 — .gitignore·.vercelignore 로 제외, 로컬 전용)
│   └── 입시전쟁.html   허브. 13개 형제 문서 + "오늘 입시뉴스" 섹션
├── docs/
│   ├── minjun/        민준입시.html 허브 + 2027 대입 자료 + 면접준비.html
│   │   └── snu/       SNU 스마트시스템과학과 자료
│   │                   교수연구_통합분석.html = 구 「분석대시보드」+「실험·결과 심층분석」 통합본
│   ├── lecture/       강의.html 허브 + 강의 자료
│   └── wow/
├── MD/                ← `/articlemd` 가 참조. 옮기지 말 것
├── lecture-slides/    ← `/lecture` 가 manifest.json 참조. 옮기지 말 것
└── *.svg
```

`univ/입시전쟁.html`은 `a[data-web]` 링크를 claude.ai 아티팩트로 치환하는 스크립트를 갖고 있으나, `/univ/` 경로에서 서빙될 때는 형제 파일이 함께 있으므로 치환을 건너뛴다.

### Vercel 크론 (`vercel.json`)

| 스케줄(UTC) | KST | 경로 |
|---|---|---|
| `0 21 * * *` | 06:00 | `/api/news-report?hour=06` |
| `0 13 * * *` | 22:00 | `/api/admission-news/daily?run=1` |

**Vercel 함수 기본 타임아웃은 10초다.** LLM·외부 수집이 있는 라우트는 `export const maxDuration`을 반드시 둔다 (뉴스 사슬 60초, 나머지 30초).
크론 라우트는 저장이 카카오 전송보다 앞서므로, 타임아웃이 나면 **데이터는 남고 메시지만 안 가는** 형태로 조용히 실패한다.

`?hour=` 파라미터는 라우트가 읽지 않는다 (`getKSTHour()`로 직접 판단) — 남은 `?hour=06`도 표식일 뿐이다.
Hobby 플랜은 크론 2개가 상한이므로 더 추가하려면 기존 것을 빼야 한다.

### API routes

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/todos` | GET POST PATCH DELETE | Supabase `todos` table |
| `/api/news-report` | GET | 정기요약 생성. KST 06:00–12:00 제한; `?force=true`로 우회 가능 |
| `/api/realtime-report` | GET | 최신 `rt_` 행 조회 |
| `/api/realtime-report` | POST | 수집 → 요약 → Supabase 저장. Kakao 전송 없음 |
| `/api/send-kakao` | POST | `{ summary, date, title?, link? }` body → Kakao Talk 전송. `title`/`link` 생략 시 실시간요약 문구 |
| `/api/auth/change-password` | POST | 본인 비밀번호 변경. `Authorization: Bearer <세션토큰>` 필요 |
| `/api/auth/forgot` | POST | 비밀번호 찾기. **관리자 계정 전용** — 카카오 "나에게 보내기"는 앱 소유자에게만 가기 때문. 계정 유무와 무관하게 같은 응답 |
| `/api/auth/reset` | POST | 1회성 토큰으로 새 비밀번호 설정 |
| `/api/admin/reset-password` | POST | 관리자가 타 사용자 비밀번호를 임시값으로 초기화. 관리자 본인은 불가 |
| `/api/admission-news` | GET | 2027 대입 뉴스 분석 (6월~오늘, 저장 없음) |
| `/api/admission-news/daily` | GET | 최신 `ipsi_` 행 조회 — `입시전쟁.html`이 호출 |
| `/api/admission-news/daily?run=1` | GET | 오늘 입시뉴스 수집 → 요약 → 저장 → Kakao 전송. Vercel 크론이 매일 KST 22:00 호출 (Vercel 크론은 GET만 보내므로 생성도 GET) |

### Shared lib (`app/lib/`)

**`news.ts`** — all news pipeline logic:
- `fetchAllNews()` — 4개 소스 병렬 fetch (RSS + Atom 자동 감지)
- `summarizeNews(news)` — Groq API 호출, 전체 5줄·카테고리 3줄 이내 요약 반환
- `buildReportPayload(news, summary)` — Supabase upsert용 객체 생성. **`ionq_news: []` 포함 필수** (NOT NULL 제약)
- `getKSTDate()` / `getKSTHour()` — UTC+9 변환

**`admission.ts`** — 오늘 입시뉴스 파이프라인:
- `fetchTodayAdmissionNews()` — Google News RSS 5개 쿼리 병렬 수집. 최근 36시간·공지성 제목 필터.
  **중복 제거 1겹**: 제목 글자 바이그램 자카드 유사도 0.45 이상이면 같은 기사로 보고 버린다 (매체별 표현 차이 흡수)
- `summarizeAdmissionNews(news)` — LLM 호출, 전체 3줄 + 건별 120자 요약·태그(통계/분석/유리/불리/결정).
  **중복 제거 2겹**: 같은 사안을 다룬 기사를 LLM이 하나로 묶는다(`duplicates`). 대표 기사만 남고 나머지 매체명은 `alsoReported` 로 들어간다
- `buildAdmissionPayload(digest)` — `reports` upsert용. 항목은 **`quantum_news` 컬럼에 담는다** (테이블 공용 사용)
- `admissionKey(date)` — `ipsi_YYYY-MM-DD`

**`kakao.ts`** — `sendKakaoMessage(text, label?)`:
- 토큰은 `app_state` 의 `kakao_token` 에 저장된 값을 우선 쓰고, 만료 1분 전이면 미리 갱신한다.
  저장된 값이 없을 때만 환경변수로 시작한다 — 갱신 결과를 버리지 않으므로 환경변수가 낡아도 계속 동작한다.
  카카오가 새 refresh token 을 주면(잔여 기간이 짧을 때) 그것으로 갈아끼운다.
- 성공·실패를 `app_state` 의 `kakao_last_send` 에 남긴다. `/ipsi-news` 가 실패 시 배지로 띄운다.
  **자동 발송 실패는 예전에 아무 흔적 없이 사라졌다.**

**`state.ts`** — `app_state` 키-값 저장소(`getState`/`setState`). 테이블이 없으면 조용히 건너뛴다.
  생성은 `supabase-app-state.sql` 참고.

### News sources

| 카테고리 | Feed URL | 형식 |
|---------|---------|------|
| 양자뉴스 | Google News RSS — `양자컴퓨터 OR IONQ` | RSS |
| 유튜브 | Google News RSS — `AI 인공지능 site:youtube.com` | RSS |
| 요즘IT | `yozm.wishket.com/magazine/feed/` | RSS |
| Geeks | `news.hada.io/rss/news` | Atom (`<entry>`) |

모든 fetch에 Chrome User-Agent 헤더 필요 (GeekNews 403 우회).

### Supabase `reports` table

```
date         text UNIQUE  -- 정기: "YYYY-MM-DD" / 실시간: "rt_YYYY-MM-DD_HHMM" / 오늘입시뉴스: "ipsi_YYYY-MM-DD"
summary      text
ionq_news    jsonb NOT NULL DEFAULT '[]'   ← 레거시. upsert 시 반드시 [] 포함
quantum_news jsonb                            ← ipsi_ 행에서는 입시뉴스 항목이 여기 들어간다
youtube_news jsonb
yozm_news    jsonb
geeks_news   jsonb
```

### 보안

- **인가**: 로그인 시 서버가 HMAC-SHA256 으로 서명한 세션 토큰을 발급한다(`app/lib/session.ts`, TTL 14일).
  관리자 라우트는 `app/lib/admin-guard.ts`의 `requireAdmin(req)`로 `Authorization: Bearer <token>`을 검증한다.
  예전의 `x-admin-email` 헤더 방식은 누구나 위조할 수 있어 제거했다. **다시 도입하지 말 것.**
- `AUTH_SECRET` 미설정 시 관리자 라우트는 503으로 닫힌다 (fail-closed).
- **DB 접근**: 전부 서버 측이다. `SUPABASE_SECRET_KEY`(신규 `sb_secret_…` 형식) 또는 `SUPABASE_SERVICE_ROLE_KEY`(레거시 JWT)가 있으면 그것을 쓰고, 없으면 publishable 키로 폴백한다.
  RLS 적용은 `supabase-rls.sql` 참고 — **서비스 키 설정·배포 후에** 실행해야 한다.
- **크론 라우트**: `CRON_SECRET`이 설정돼 있으면 `Authorization: Bearer`를 검증한다(`app/lib/cron.ts`).
  `/api/news-report`와 `/api/admission-news/daily?run=1`은 호출만으로 LLM·카카오·DB 쓰기를 유발하므로 외부 노출을 막는다.
  수동 실행 시에도 같은 헤더가 필요하다.
- **비밀번호**: `app/lib/password.ts`. 신규는 `scrypt$<salt>$<derived>` 형식으로 저장한다.
  기존 솔트 없는 SHA-256 해시는 로그인에 성공하는 순간 자동으로 scrypt 로 교체된다(`needsUpgrade`) — 별도 마이그레이션 불필요.
- **비밀번호 재설정**: 링크에는 난수 원문, 서버(`app_state.password_reset`)에는 sha256 해시만 둔다.
  TTL 30분, 사용 즉시 무효화하는 1회성이다(`app/lib/reset.ts`).
  비밀번호는 복호화가 불가능하므로 **조회 기능은 만들 수 없다** — 재설정만 가능하다.
- 보안 헤더는 `next.config.ts`의 `headers()`에서 전 경로에 적용한다.

### Color palette

| 영역 | 값 |
|------|---|
| 네비게이션 배경 | `#EFF8FF` |
| 네비게이션 텍스트 | `#0369A1` |
| 카드/섹션 배경 | `#EFF8FF`, 테두리 `#BAE6FD` |
| 요약 박스 배경 | `#E0F2FE` |
| 버튼·링크 | `#1D9E75` |
| 증시 상승 | `#E24B4A` |
| 증시 하락 | `#0369A1` |

### Environment variables

`.env.local` 필수 키: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_ACCESS_TOKEN`, `KAKAO_REFRESH_TOKEN`, `GROQ_API_KEY`, `NEXT_PUBLIC_API_URL`

콘솔에서 **클라이언트 시크릿**을 켠 경우 `KAKAO_CLIENT_SECRET`을 추가한다. 환경변수가 있을 때만 토큰 요청에 실려 나가므로, 끈 상태면 넣지 않아도 된다.

Kakao 액세스 토큰 유효기간 6시간, 리프레시 토큰 60일. 만료 시 OAuth 인가 코드 흐름(`kauth.kakao.com/oauth/authorize`)으로 재발급.
