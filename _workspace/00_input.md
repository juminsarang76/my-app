# 유튜브 자막 페이지 기능 완성 요청

## 앱 설명
기존 Next.js 웹앱(haruflower.vercel.app)의 `/youtube` 페이지 버그 수정 및 기능 완성

## 핵심 수정 요구사항
1. **자막 붙여넣기 즉시 원문 표시** - 텍스트 붙여넣기 시 원문 탭에 바로 표시 (버튼 불필요)
2. **번역 탭** - 자막 있으면 클릭 시 한글 번역 자동 실행 후 표시
3. **동시보기 탭** - 원문 + 번역 좌우 나란히 동시 스크롤
4. **한글요약 탭** - 클릭 시 자동 요약 실행 후 표시
5. **저장 버튼 활성화** - 자막 있으면 노션저장/옵시디언저장/둘다저장 활성화

## 기술 스택
- Next.js 16 App Router + React 19 + TypeScript
- Vercel 배포
- Groq API (번역/요약)
- Supabase, GitHub API, Notion API (저장)

## 기존 코드 위치
- 메인 파일: `app/youtube/page.tsx`
- API: `app/api/youtube/transcript/route.ts`, `translate/`, `summary/`, `save-notion/`, `save-github/`

## 실행 모드
**프론트 모드** (API는 구현됨, 프론트 버그 수정)
