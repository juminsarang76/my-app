# 테스트 계획 — youtube/page.tsx 기능 검증

> 대상: `app/youtube/page.tsx`
> 검증일: 2026-06-07
> 검증 목표: 자막 붙여넣기 → 원문 표시 기능이 완전히 동작하는가

---

## 종합 판정

**배포 준비 상태**: 수정 후 배포 (1개 결함, 2개 권장 수정)

- 핵심 기능 흐름(붙여넣기 → 파싱 → 원문 탭 표시)은 정상 동작
- `handlePasteSubmit`, `onPaste` 데드코드는 이미 제거됨 — 양호
- 10자 임계값 조건이 짧은 자막 줄을 누락하는 결함 존재 (필수 수정)
- `else if (!val.trim())` 분기가 1~10자 입력 구간에서 items를 초기화하지 않는 로직 허점 (권장 수정)

---

## 1. 파싱 함수 검증 (`parseSubtitleText`, 라인 9–58)

### 1-1. 일반 텍스트(줄별 자막) 입력 → SubItem[] 반환

**판정: 정상**

라인 56–57의 폴백 경로가 모든 줄을 `{ text, start: i*5, duration: 5 }` 형태로 반환한다.
SRT/VTT/타임스탬프 패턴에 매칭되지 않으면 자동으로 이 경로를 탄다.

```
입력: "안녕하세요\n오늘 날씨가 좋습니다\n유튜브 영상입니다"
기대: [{text:"안녕하세요",start:0,...}, {text:"오늘 날씨가 좋습니다",start:5,...}, ...]
실제: 동일 — 정상
```

### 1-2. `[MM:SS] text` 형식 파싱

**판정: 정상 (단, 첫 줄 패턴 감지에 의존)**

라인 43의 감지 조건:
```
/^\[\d{2}:\d{2}\]|\d{2}:\d{2}\s+\w/.test(text.split('\n')[0])
```
첫 줄이 `[00:05]` 또는 `00:05 text` 형식일 때만 이 경로로 진입한다.
라인 46의 파싱 정규식 `^\[?(\d{2}):(\d{2})\]?\s+(.+)` 은 양쪽 형식을 모두 커버한다.

**엣지 케이스**: 첫 줄이 타임스탬프 없는 제목 줄이고, 이후 줄에만 타임스탬프가 있으면 폴백 경로로 떨어진다. 기능상 자막은 표시되나 start 값이 0, 5, 10...으로 대체된다. 허용 가능한 수준.

### 1-3. SRT 형식 파싱

**판정: 정상**

라인 13의 감지 정규식:
```
/\d+\r?\n\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(text)
```
표준 SRT 형식을 정확히 감지한다.
타임코드를 초 단위로 변환하고, 시퀀스 번호 줄과 타임코드 줄을 필터링하여 텍스트만 추출한다.

**잠재적 문제**: `blocks.flatMap(block => ...).filter(Boolean)` 에서 `.filter(Boolean)` 은 TypeScript 상 `SubItem[]` 타입에서 빈 배열 `[]` 은 truthy이므로 필터링되지 않는다. 그러나 실제로는 `flatMap`이 `[]`를 펼치므로 최종 결과는 올바르다.

### 1-4. VTT 형식 파싱

**판정: 정상**

라인 28의 감지 조건은 `WEBVTT` 헤더 또는 VTT 스타일 타임코드를 인식한다.
라인 37의 `replace(/<[^>]+>/g, '')` 로 VTT 인라인 태그(`<c>`, `<i>` 등)를 제거한다.

**경계값**: VTT 큐 식별자(숫자/텍스트 ID 행)가 남을 수 있다. 현재 필터 조건이 `!/-->/.test(l)` 만 적용하므로 큐 ID 행이 텍스트에 포함될 수 있다. 영향은 경미하나 권장 수정 대상.

### 1-5. 빈 문자열 입력 → 빈 배열 반환

**판정: 조건부 정상**

라인 10: `const text = raw.trim()` 후 폴백 경로(라인 56)에서:
```js
const lines = text.split(/\r?\n/).filter(l => l.trim())
```
빈 문자열을 trim하면 `""`, split하면 `[""]`, filter로 falsy 제거하면 `[]`, map 결과 `[]` → 빈 배열 반환. 정상.

---

## 2. onChange 핸들러 검증 (라인 484–501)

```js
onChange={e => {
  const val = e.target.value
  setPasteText(val)
  if (val.trim().length > 10) {           // [A]
    const parsed = parseSubtitleText(val)
    if (parsed.length > 0) {              // [B]
      setItems(parsed)
      setTranslated([])
      setSummary('')
      setTab('원문')                       // [C]
      setLang(`수동입력 (${parsed.length}줄)`)
      setError('')
      setNoCaption(false)
    }
  } else if (!val.trim()) {              // [D]
    setItems([])
  }
}}
```

### 2-1. `val.trim().length > 10` 조건 적절성

**판정: 결함 — 필수 수정**

10자 이하의 유효한 자막이 파싱되지 않는다.

예시 케이스:
- `"Hello"` (5자) → 조건 실패, 파싱 건너뜀
- `"안녕하세요"` (6자) → 조건 실패
- `"00:00 Hi"` (8자) → 조건 실패, 타임스탬프 형식도 무시됨

단일 줄 자막이나 짧은 문장 자막은 원문 탭에 표시되지 않는다.

**권장 임계값**: `> 0` 또는 최대 `> 2` (공백/줄바꿈 방지용)

**수정 라인**: 487번 줄

```diff
- if (val.trim().length > 10) {
+ if (val.trim().length > 0) {
```

### 2-2. `setTab('원문')` 호출 존재 여부

**판정: 정상**

라인 493에서 `setTab('원문')` 이 `setItems(parsed)` 호출 직후 실행된다.
파싱 성공 시 원문 탭으로 자동 전환된다.

### 2-3. `parsed.length > 0` 체크 로직

**판정: 정상**

라인 489의 `if (parsed.length > 0)` 조건이 빈 파싱 결과 시 items를 덮어쓰지 않도록 보호한다.

### 2-4. `else if (!val.trim())` 분기 로직 허점

**판정: 권장 수정**

조건 `[A]`(`> 10`)도 `[D]`(`!val.trim()`)도 아닌 구간, 즉 `1 ~ 10`자 입력 시 아무 동작도 없다.

시나리오:
1. 사용자가 긴 자막 붙여넣기 → items에 100줄 설정됨
2. textarea를 전체 선택 후 5자 타이핑으로 교체
3. `> 10` 실패, `!val.trim()` 실패 → items가 100줄인 채로 유지

이전 자막과 현재 입력이 불일치하는 상태가 발생한다.

**수정 라인**: 498번 줄

```diff
- } else if (!val.trim()) {
+ } else {
    setItems([])
  }
```

또는:

```diff
  if (val.trim().length > 0) {
    const parsed = parseSubtitleText(val)
    if (parsed.length > 0) {
      setItems(parsed)
      ...
    } else {
      setItems([])
    }
  } else {
    setItems([])
  }
```

---

## 3. 탭 렌더링 검증 (라인 566–712)

### 3-1. `items.length > 0` 조건 위치

**판정: 정상**

라인 590–595: items 없을 때 안내 메시지 표시
라인 598–711: items 있을 때 탭 콘텐츠 렌더링

두 블록이 명확히 분리되어 있고 조건이 올바른 위치에 있다.

### 3-2. 4개 탭 존재 여부

**판정: 정상**

라인 339:
```js
const TABS: Tab[] = ['원문', '번역', '동시보기', '한글요약']
```
라인 6:
```ts
type Tab = '원문' | '번역' | '동시보기' | '한글요약'
```

4개 탭 모두 정의됨. 라인 567–587에서 TABS 배열을 map하여 버튼 렌더링.

### 3-3. 원문 탭 선택 시 items 렌더링

**판정: 정상**

라인 601–612: `tab === '원문'` 조건 하에 items.map으로 각 자막 줄을 `formatTime(item.start)` + `item.text` 형식으로 렌더링한다.

---

## 4. 버튼 활성화 검증

### 4-1. 번역/요약 버튼 비활성화

**판정: 정상**

번역 버튼 (라인 538):
```js
disabled={loadingTranslate || !items.length}
```

요약 버튼 (라인 543):
```js
disabled={loadingSummary || !items.length}
```

items가 없으면 disabled 속성이 true이고 cursor/색상도 시각적으로 비활성 처리됨.

### 4-2. 저장 버튼 비활성화

**판정: 정상**

노션 저장 (라인 549):
```js
disabled={savingNotion || !items.length}
```

옵시디언 저장 (라인 553):
```js
disabled={savingGithub || !items.length}
```

둘다 저장 (라인 558):
```js
disabled={savingNotion || savingGithub || !items.length}
```

3개 버튼 모두 `!items.length` 조건으로 비활성화됨.

**참고**: 옵시디언 저장 버튼 옆 설정 버튼 (라인 556) 은 items.length와 무관하게 항상 활성화됨. 의도된 동작으로 판단.

---

## 5. 데드코드 확인

### 5-1. `handlePasteSubmit` 함수

**판정: 정상 — 해당 함수 없음**

파일 전체에서 `handlePasteSubmit` 식별자가 존재하지 않는다. 이미 제거된 상태.

### 5-2. `onPaste` 핸들러

**판정: 정상 — 해당 핸들러 없음**

textarea에 `onPaste` prop이 존재하지 않는다. onChange 핸들러만 사용하는 설계로 올바르게 정리됨.

---

## 발견 사항 요약

### 필수 수정 (1건)

**[ISSUE-01] 10자 임계값으로 짧은 자막 누락**

- 위치: `app/youtube/page.tsx` 라인 487
- 심각도: 기능 결함
- 현상: 10자 이하 텍스트는 onChange에서 파싱을 건너뛰어 원문 탭에 표시되지 않음
- 영향: 짧은 자막 줄, 단어 단위 자막, 테스트 입력 등이 모두 무시됨
- 수정:
  ```diff
  - if (val.trim().length > 10) {
  + if (val.trim().length > 0) {
  ```

### 권장 수정 (2건)

**[ISSUE-02] 1~10자 입력 시 이전 items 상태 잔존**

- 위치: `app/youtube/page.tsx` 라인 498
- 심각도: 상태 불일치
- 현상: 이전 자막 붙여넣기 후 10자 이하로 수정하면 items가 초기화되지 않음
- 수정:
  ```diff
  - } else if (!val.trim()) {
  + } else {
      setItems([])
    }
  ```

**[ISSUE-03] VTT 큐 식별자 줄이 텍스트에 혼입될 수 있음**

- 위치: `app/youtube/page.tsx` 라인 37
- 심각도: 데이터 품질
- 현상: VTT 파일에 큐 식별자(`NOTE`, 숫자 ID, 텍스트 레이블)가 있으면 텍스트 내용에 포함됨
- 수정: 현재 필터 `!/-->/.test(l)` 에 큐 ID 필터 추가
  ```diff
  - const textContent = lines.filter(l => !/-->/.test(l)).join(' ').replace(/<[^>]+>/g, '').trim()
  + const textContent = lines.filter(l => !/-->/.test(l) && !/^[\w\s-]+$/.test(l.trim()) || l.includes(' ')).join(' ').replace(/<[^>]+>/g, '').trim()
  ```
  (또는 더 안전하게: NOTE/STYLE/REGION 키워드 블록을 사전에 필터링)

### 참고 사항

- `formatTime` 함수는 초 단위를 MM:SS로 정확히 변환함
- Obsidian 설정 모달과 토스트는 items 상태와 독립적으로 동작하여 충돌 없음
- `buildMarkdown` 함수는 items/translated/summary 모두를 포함한 마크다운을 올바르게 생성함
- `handleTranslate`, `handleSummary` 진입 전 `!items.length` 조건으로 빈 상태 호출을 이중 방어함

---

## 테스트 시나리오 매트릭스

| # | 시나리오 | 입력 | 기대 결과 | 현재 상태 |
|---|---------|------|----------|----------|
| 1 | 일반 텍스트 붙여넣기 (11자 이상) | `"안녕하세요 반갑습니다"` | items 파싱, 원문 탭 표시 | 정상 |
| 2 | 짧은 텍스트 붙여넣기 (10자 이하) | `"Hello"` | items 파싱, 원문 탭 표시 | **실패** (ISSUE-01) |
| 3 | SRT 형식 붙여넣기 | `"1\n00:00:01,000 --> 00:00:03,000\nHello"` | SRT 파싱, 타임코드 표시 | 정상 |
| 4 | VTT 형식 붙여넣기 | `"WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello"` | VTT 파싱, 타임코드 표시 | 정상 |
| 5 | [MM:SS] 형식 붙여넣기 | `"[00:05] 안녕하세요"` | 타임스탬프 파싱 | 정상 |
| 6 | 빈 textarea | `""` | items 빈 배열 | 정상 |
| 7 | 자막 후 짧게 수정 | 100줄 붙여넣기 후 5자 입력 | items 초기화 | **실패** (ISSUE-02) |
| 8 | onChange 후 탭 전환 | 유효 자막 입력 | setTab('원문') 호출됨 | 정상 |
| 9 | 번역 버튼 — items 없음 | items = [] | disabled | 정상 |
| 10 | 노션/옵시디언/둘다 버튼 — items 없음 | items = [] | disabled | 정상 |
| 11 | handlePasteSubmit 호출 | — | 함수 없음 | 정상 (제거됨) |
| 12 | onPaste 이벤트 | — | 핸들러 없음 | 정상 (제거됨) |
