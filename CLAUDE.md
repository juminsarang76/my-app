# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Node.js is **not in the system PATH**. Use the full path or Bash tool:

```bash
# Dev server
"/c/Program Files/nodejs/node.exe" "./node_modules/.bin/next" dev

# Type check
"/c/Program Files/nodejs/node.exe" "./node_modules/typescript/bin/tsc" --noEmit

# Build
"/c/Program Files/nodejs/node.exe" "./node_modules/.bin/next" build
```

PowerShell `curl` is aliased to `Invoke-WebRequest` — use `curl.exe` for HTTP requests.

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS v4 · Supabase · Groq (llama-3.3-70b) · Kakao Talk API

### Route map

| Route | Type | Description |
|-------|------|-------------|
| `/` | Client | 할 일 목록 (Todo CRUD) |
| `/reports` | Server | 정기요약 목록 (Supabase `reports` table, excludes `rt_` rows) |
| `/reports/[date]` | Server | 정기요약 상세 — date param is the Supabase `date` key |
| `/realtime` | Client | 실시간요약 — auto-fetches on mount via POST `/api/realtime-report` |
| `/stocks` | Server | 증시지수 — Yahoo Finance + TradingView links |
| `/photos` | Server | 플레이스홀더 |

### API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/todos` | GET/POST/PATCH/DELETE | Todo CRUD against Supabase |
| `/api/news-report` | GET | 정기요약 생성 (KST 06–12시 제한, `?force=true`로 우회) |
| `/api/realtime-report` | GET | 최신 실시간요약 조회 (`rt_` prefix rows) |
| `/api/realtime-report` | POST | 실시간요약 수집·요약·저장 (Kakao 전송 없음) |
| `/api/send-kakao` | POST | 현재 요약을 Kakao Talk으로 전송 |

### Shared libraries (`app/lib/`)

- **`news.ts`** — RSS/Atom 수집(`fetchAllNews`), Groq 요약(`summarizeNews`), Supabase payload 빌드(`buildReportPayload`), KST 시간 유틸. Atom 피드(`<entry>`)와 RSS(`<item>`) 모두 파싱 지원.
- **`kakao.ts`** — Kakao Talk 전송(`sendKakaoMessage`). 401 시 refresh token으로 자동 재발급 후 재시도.

### Supabase `reports` table schema

```
id            bigint PK
date          text UNIQUE  -- 정기: "YYYY-MM-DD", 실시간: "rt_YYYY-MM-DD_HHMM"
summary       text
ionq_news     jsonb NOT NULL DEFAULT '[]'  -- 레거시, 항상 빈 배열 저장
quantum_news  jsonb
youtube_news  jsonb
yozm_news     jsonb
geeks_news    jsonb
created_at    timestamptz
```

`ionq_news`는 NOT NULL 제약이 있어 `buildReportPayload`에서 빈 배열로 항상 포함해야 한다.

### News sources

| 카테고리 | URL | 형식 |
|---------|-----|------|
| 양자뉴스 | Google News RSS (`양자컴퓨터 OR IONQ`) | RSS |
| 유튜브 | Google News RSS (`AI 인공지능 site:youtube.com`) | RSS |
| 요즘IT | `yozm.wishket.com/magazine/feed/` | RSS |
| Geeks | `news.hada.io/rss/news` | Atom |

모든 RSS fetch에 브라우저 User-Agent 헤더를 사용한다 (GeekNews 봇 차단 우회).

### Color theme

| 영역 | 색상 |
|------|------|
| 네비게이션 바 | `#EFF8FF` bg + `#0369A1` 텍스트 |
| 섹션/카드 배경 | `#EFF8FF` + `#BAE6FD` 테두리 |
| 요약 박스 | `#E0F2FE` |
| 버튼·링크 | `#1D9E75` (초록) |
| 증시 상승 | `#E24B4A` (빨강) |
| 증시 하락 | `#0369A1` (파랑) |

### Environment variables (`.env.local`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_ACCESS_TOKEN`, `KAKAO_REFRESH_TOKEN`, `GROQ_API_KEY`, `NEXT_PUBLIC_API_URL`

Kakao 액세스 토큰은 6시간, 리프레시 토큰은 60일 만료. 만료 시 `https://kauth.kakao.com/oauth/authorize` 흐름으로 재발급 필요.
