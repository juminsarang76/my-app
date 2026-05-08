# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Node.js is **not in the system PATH**. Use absolute paths via the Bash tool:

```bash
# Dev server
"/c/Program Files/nodejs/node.exe" "./node_modules/.bin/next" dev

# Type check (no output = no errors)
"/c/Program Files/nodejs/node.exe" "./node_modules/typescript/bin/tsc" --noEmit

# Build
"/c/Program Files/nodejs/node.exe" "./node_modules/.bin/next" build

# Lint
"/c/Program Files/nodejs/node.exe" "./node_modules/.bin/eslint" .
```

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
| `/photos` | Server | 플레이스홀더 |

### API routes

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/todos` | GET POST PATCH DELETE | Supabase `todos` table |
| `/api/news-report` | GET | 정기요약 생성. KST 06:00–12:00 제한; `?force=true`로 우회 가능 |
| `/api/realtime-report` | GET | 최신 `rt_` 행 조회 |
| `/api/realtime-report` | POST | 수집 → 요약 → Supabase 저장. Kakao 전송 없음 |
| `/api/send-kakao` | POST | `{ summary, date }` body → Kakao Talk 전송 |

### Shared lib (`app/lib/`)

**`news.ts`** — all news pipeline logic:
- `fetchAllNews()` — 4개 소스 병렬 fetch (RSS + Atom 자동 감지)
- `summarizeNews(news)` — Groq API 호출, 전체 5줄·카테고리 3줄 이내 요약 반환
- `buildReportPayload(news, summary)` — Supabase upsert용 객체 생성. **`ionq_news: []` 포함 필수** (NOT NULL 제약)
- `getKSTDate()` / `getKSTHour()` — UTC+9 변환

**`kakao.ts`** — `sendKakaoMessage(text)`: 401 응답 시 refresh token으로 자동 재발급 후 1회 재시도.

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
date         text UNIQUE  -- 정기: "YYYY-MM-DD" / 실시간: "rt_YYYY-MM-DD_HHMM"
summary      text
ionq_news    jsonb NOT NULL DEFAULT '[]'   ← 레거시. upsert 시 반드시 [] 포함
quantum_news jsonb
youtube_news jsonb
yozm_news    jsonb
geeks_news   jsonb
```

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

Kakao 액세스 토큰 유효기간 6시간, 리프레시 토큰 60일. 만료 시 OAuth 인가 코드 흐름(`kauth.kakao.com/oauth/authorize`)으로 재발급.
