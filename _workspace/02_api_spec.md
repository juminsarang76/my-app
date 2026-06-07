# 수정 내용 요약 — app/youtube/page.tsx

> 수정 일자: 2026-06-07  
> 커밋: `5dd1896`  
> 브랜치: master

## 문제

사용자가 자막 텍스트를 textarea에 붙여넣어도 원문 탭에 표시되지 않음.

## 원인 (아키텍트 분석)

- `onPaste` + `onChange` 이중 처리로 인한 혼선: `onPaste`에서 `setPasteText(pasted)` 호출이 React의 controlled input 상태와 충돌, 이후 `onChange`가 빈 값 또는 이전 값으로 덮어쓸 수 있었음
- `handlePasteSubmit` 함수가 어디에도 연결되지 않은 데드코드로 존재

## 수정 내용

### 1. textarea 핸들러 단순화

`onPaste` 핸들러를 완전히 제거하고 `onChange` 단일 처리로 통일.

- 파싱 조건을 `val.trim()` 에서 `val.trim().length > 10` 으로 변경해 짧은 입력에서 불필요한 파싱 방지
- `setNoCaption(false)` 추가로 에러 상태 완전 초기화
- `rows` 6 → 8, `fontFamily` `sans-serif` → `monospace`, `background: '#FAFAFA'` 추가

### 2. `handlePasteSubmit` 데드코드 삭제

라인 281~298 해당 함수 전체 삭제.

### 3. `parseSubtitleText` 형식 추가

`[MM:SS] text` 및 `MM:SS text` 타임스탬프 형식 파싱 지원 추가.

```typescript
// [MM:SS] text 또는 MM:SS text 타임스탬프 형식
if (/^\[\d{2}:\d{2}\]|\d{2}:\d{2}\s+\w/.test(text.split('\n')[0])) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  return lines.map((line, i) => {
    const m = line.match(/^\[?(\d{2}):(\d{2})\]?\s+(.+)/)
    if (m) {
      const start = parseInt(m[1]) * 60 + parseInt(m[2])
      return { text: m[3].trim(), start, duration: 5 }
    }
    return { text: line.trim(), start: i * 5, duration: 5 }
  }).filter(item => item.text)
}
```

지원 형식 전체:
1. SRT (`00:00:00,000 --> 00:00:00,000`)
2. VTT (`WEBVTT` 헤더 또는 `00:00:00.000 -->`)
3. `[MM:SS] text` / `MM:SS text` (신규 추가)
4. 일반 텍스트 (줄 단위)

## TypeScript 검사

`tsc --noEmit` 통과 (오류 없음).
