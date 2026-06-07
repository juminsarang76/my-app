# 아키텍처 설계 문서 — YouTube 자막 페이지 분석

> 분석 대상: `app/youtube/page.tsx` (총 739줄)  
> 분석 일자: 2026-06-07

---

## 1. 현재 구조 요약

### 컴포넌트 구조

```
YoutubePage (Client Component)
├── 상태(State)
│   ├── url, videoId, videoTitle          — 영상 식별
│   ├── items: SubItem[]                   — 파싱된 자막 배열 (핵심)
│   ├── translated: string[]               — 번역 결과
│   ├── summary: string                    — 한글 요약
│   ├── tab: Tab                           — 현재 활성 탭 ('원문'|'번역'|'동시보기'|'한글요약')
│   ├── loading* (4종)                     — 각 비동기 작업 로딩 상태
│   ├── saving* (2종)                      — Notion/GitHub 저장 상태
│   ├── showPasteInput, pasteText          — 수동 붙여넣기 패널
│   ├── obsidianToken, obsidianPort        — Obsidian REST API 설정
│   └── error, toast, lang, noCaption     — UX 피드백
│
├── 핵심 함수
│   ├── parseSubtitleText(raw)            — SRT/VTT/TXT 파싱 (순수함수)
│   ├── handleFetch()                      — API /api/youtube/transcript 호출
│   ├── handleWhisper()                    — API /api/youtube/whisper 호출
│   ├── handleTranslate()                  — API /api/youtube/translate 호출
│   ├── handleSummary()                    — API /api/youtube/summary 호출
│   ├── handlePasteSubmit()               — 버튼 클릭 시 수동 파싱 (현재 미사용)
│   ├── handleGithub()                     — API /api/youtube/save-github 호출
│   ├── handleNotion()                     — API /api/youtube/save-notion 호출
│   └── handleSaveBoth()                   — GitHub + Notion 동시 저장
│
└── 렌더링 구조
    ├── Obsidian 설정 모달
    ├── 토스트 알림
    ├── URL 입력 + 자막 가져오기 버튼
    ├── 에러 박스 (Whisper 버튼 포함)
    ├── 수동 붙여넣기 패널 (textarea)
    ├── 영상 정보 + 액션 버튼 바 (번역/요약/저장)
    └── 탭 + 탭 콘텐츠
        ├── 탭 없을 때: 안내 메시지 (items.length === 0)
        └── 탭 있을 때: 원문/번역/동시보기/한글요약 (items.length > 0)
```

### 호출하는 API 라우트

| API 경로 | 메서드 | 설명 |
|----------|--------|------|
| `/api/youtube/transcript` | POST | 자막 자동 추출 |
| `/api/youtube/whisper` | POST | Whisper AI 음성 인식 |
| `/api/youtube/translate` | POST | 한글 번역 |
| `/api/youtube/summary` | POST | 한글 요약 |
| `/api/youtube/save-github` | POST | GitHub 저장 |
| `/api/youtube/save-notion` | POST | Notion 저장 |

---

## 2. 분석 결과 — 항목별

### 2-1. `parseSubtitleText` — 일반 텍스트 파싱 (라인 43~44)

```typescript
// 라인 43-44
const lines = text.split(/\r?\n/).filter(l => l.trim())
return lines.map((line, i) => ({ text: line.trim(), start: i * 5, duration: 5 }))
```

**판정: 정상**

- 빈 줄을 `filter`로 제거하고, 각 줄을 `SubItem`으로 변환한다.
- `start`는 줄 인덱스 × 5초로 할당하여 타임스탬프가 없는 순수 텍스트에도 대응한다.
- SRT 감지 정규식(라인 13), VTT 감지 정규식(라인 28) 이후 fallback으로 실행되므로 우선순위가 올바르다.
- 결과가 항상 `SubItem[]`을 반환하므로 후속 `setItems` 호출에 안전하다.

### 2-2. `onPaste` / `onChange` 핸들러와 `setItems` 호출 (라인 491~524)

**판정: 정상이나 중복 처리 주의 필요**

`onChange` (라인 491~508):
```typescript
onChange={e => {
  const val = e.target.value
  setPasteText(val)
  if (val.trim()) {
    const parsed = parseSubtitleText(val)
    if (parsed.length > 0) {
      setItems(parsed)        // setItems 호출 확인
      ...
    }
  } else {
    setItems([])
  }
}}
```

`onPaste` (라인 509~524):
```typescript
onPaste={e => {
  const pasted = e.clipboardData.getData('text')
  if (pasted.trim()) {
    const parsed = parseSubtitleText(pasted)
    if (parsed.length > 0) {
      setItems(parsed)        // setItems 호출 확인
      ...
      setPasteText(pasted)
    }
  }
}}
```

두 핸들러 모두 `setItems`를 올바르게 호출한다. 단, `onPaste`가 먼저 실행된 후 `onChange`도 연달아 실행되어 **동일한 텍스트로 `parseSubtitleText`가 두 번 호출**된다. 순수함수이므로 결과는 동일하지만 불필요한 연산과 두 번의 리렌더링이 발생한다.

### 2-3. `items.length > 0` 조건부 렌더링 (라인 622~735)

```typescript
// 라인 614~619: 자막 없을 때
{!items.length && !loadingTranscript && (
  <div>YouTube URL을 입력하거나 자막을 붙여넣어 주세요</div>
)}

// 라인 622~735: 자막 있을 때
{items.length > 0 && (
  <>
    {tab === '원문' && (...)}
    {tab === '번역' && (...)}
    {tab === '동시보기' && (...)}
    {tab === '한글요약' && (...)}
  </>
)}
```

**판정: 정상**

`items.length > 0`이 참일 때 탭 콘텐츠 전체가 렌더링된다. 빈 배열일 때는 안내 메시지가 표시되고 탭 콘텐츠는 마운트되지 않는다. 조건 분기가 명확하고 상호 배타적이다.

**주의 사항**: `loadingTranscript`가 `true`인 동안에는 `!items.length && !loadingTranscript`가 `false`이므로 안내 메시지도 숨겨진다. 그러나 로딩 스피너나 스켈레톤 UI가 없어서 자막 가져오는 동안 탭 영역이 비어 보인다. 버그는 아니지만 UX 공백이다.

### 2-4. 번역/요약/저장 버튼 활성화 조건 (라인 561~584)

**판정: 정상**

| 버튼 | `disabled` 조건 | 확인 |
|------|-----------------|------|
| 한글 번역 | `loadingTranslate \|\| !items.length` | 정상 |
| 한글 요약 | `loadingSummary \|\| !items.length` | 정상 |
| 노션 저장 | `savingNotion \|\| !items.length` | 정상 |
| 옵시디언 저장 (GitHub) | `savingGithub \|\| !items.length` | 정상 |
| 둘다 저장 | `savingNotion \|\| savingGithub \|\| !items.length` | 정상 |

모든 버튼이 `!items.length` 조건으로 비활성화된다. 스타일(배경색·커서)도 동일 조건으로 처리되어 시각적으로 일관성이 있다.

### 2-5. 탭 구조 (라인 346, 591~611)

**판정: 정상**

```typescript
const TABS: Tab[] = ['원문', '번역', '동시보기', '한글요약']
```

- 탭은 4개이며 `Tab` 유니온 타입과 정확히 대응한다.
- 탭 클릭 시 `setTab(t)` 호출 후, `한글요약` 탭은 요약 없으면 `handleSummary()` 자동 실행, `번역` 탭은 번역 없으면 `handleTranslate()` 자동 실행한다.
- 탭은 `items.length`와 무관하게 **항상 렌더링**되어 있지만 콘텐츠 영역(`items.length > 0`)은 조건부로 표시된다. 이는 의도된 설계로 보인다.

---

## 3. 버그 위치 및 수정 방향

### BUG-01: `onPaste` 이후 `onChange` 중복 실행 (라인 509~524, 491~508)

| 항목 | 내용 |
|------|------|
| 위치 | 라인 509 (`onPaste`) + 라인 491 (`onChange`) |
| 심각도 | Low (기능 오작동 없음, 불필요한 이중 파싱) |
| 현상 | 클립보드 붙여넣기 시 `onPaste` → `onChange` 순서로 두 번 `parseSubtitleText` 실행 및 `setItems` 호출 |
| 원인 | `onPaste`에서 `setPasteText(pasted)` 후 `onChange`도 동일 값으로 트리거됨 |

**수정 방향:**

```typescript
// 방법 A: onChange에서 pasteText 상태 비교로 중복 방지
onChange={e => {
  const val = e.target.value
  setPasteText(val)
  if (val === pasteText) return  // onPaste가 이미 처리한 경우 건너뜀
  ...
}}

// 방법 B (권장): onPaste를 제거하고 onChange만 사용
// React의 onChange는 붙여넣기 이벤트도 처리하므로 onPaste 중복 불필요
// onChange에서 e.target.value로 읽으면 붙여넣기 후 최신값을 얻을 수 있음
```

### BUG-02: `handlePasteSubmit` 함수가 UI에 연결되지 않음 (라인 281~298)

| 항목 | 내용 |
|------|------|
| 위치 | 라인 281~298 (`handlePasteSubmit` 함수 정의), 라인 540~545 (닫기 버튼만 있는 하단 버튼 영역) |
| 심각도 | Low (onChange 자동 파싱으로 실질 기능은 동작함) |
| 현상 | `handlePasteSubmit`이 정의되어 있으나 어떤 버튼에도 `onClick`으로 연결되지 않음 |
| 원인 | 초기에는 "적용" 버튼이 있었을 것으로 추정되나, onChange 자동 파싱 도입 후 버튼 제거 시 함수를 삭제하지 않은 데드 코드 |

**수정 방향:** `handlePasteSubmit` 함수를 삭제하거나, 명시적 적용 버튼이 필요하다면 하단 버튼 영역에 추가한다.

```typescript
// 삭제 대상 (라인 281~298 전체)
function handlePasteSubmit() { ... }
```

### BUG-03: 자막 로딩 중 UI 공백 (라인 614~619)

| 항목 | 내용 |
|------|------|
| 위치 | 라인 614~619 |
| 심각도 | Low (UX 이슈) |
| 현상 | `loadingTranscript`가 `true`인 동안 안내 메시지도 숨겨지고 탭 콘텐츠도 없어 탭 하단 영역이 빈 공간으로 표시됨 |

**수정 방향:**

```typescript
{!items.length && !loadingTranscript && (
  <div>안내 메시지</div>
)}
{!items.length && loadingTranscript && (
  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
    자막을 가져오는 중입니다...
  </div>
)}
```

---

## 4. 전체 평가

| 분석 항목 | 판정 | 비고 |
|-----------|------|------|
| `parseSubtitleText` 일반 텍스트 파싱 | 정상 | SRT/VTT 우선 감지 후 fallback |
| `onPaste`/`onChange` → `setItems` 호출 | 정상 (중복 주의) | BUG-01 참조 |
| `items.length > 0` 조건부 렌더링 | 정상 | 명확한 분기 |
| 번역/요약/저장 버튼 비활성화 | 정상 | 전 버튼 `!items.length` 조건 일관 적용 |
| 탭 구조 4개 | 정상 | 자동 실행 로직 포함 |
| `handlePasteSubmit` 데드코드 | 버그 | BUG-02 참조 |
| 로딩 중 UI 공백 | UX 이슈 | BUG-03 참조 |

**핵심 결론**: 주요 기능(파싱, 렌더링, 버튼 활성화, 탭 구조)은 모두 올바르게 구현되어 있다. 발견된 이슈는 데드 코드 1건, 이중 파싱 1건, UX 공백 1건으로 모두 Low 심각도이며 기능 오작동은 없다.
