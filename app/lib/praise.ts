export interface PraiseSong {
  id: string
  title: string
  artist: string
  key: string
  bpm: string
  youtubeId: string        // YouTube 영상 ID (embed 용)
  youtubeQuery: string
  sheetImageUrl: string    // 악보 이미지 직접 URL
  chordChart: string
  description: string
}

export interface WeeklyPraise {
  date: string         // "YYYY-MM-DD" (일요일 날짜)
  displayDate: string  // 한국어 표시 날짜
  theme: string
  songs: PraiseSong[]
}

// 새 주차를 추가하려면 이 배열에 WeeklyPraise 객체를 추가합니다.
// 날짜는 항상 일요일 기준 "YYYY-MM-DD" 형식으로 입력합니다.
export const PRAISE_WEEKS: WeeklyPraise[] = [
  {
    date: '2026-06-01',
    displayDate: '2026년 6월 1일',
    theme: '은혜와 감사',
    songs: [
      {
        id: 's1',
        title: '주님 한 분만으로',
        artist: '경배와 찬양',
        key: 'G',
        bpm: '70',
        youtubeId: 'BjurihEr3eM',
        youtubeQuery: '주님 한 분만으로 경배와찬양',
        sheetImageUrl: 'https://t1.daumcdn.net/cfile/tistory/204368404F35B23414',
        description: '주님께만 시선을 고정하는 예배 찬양',
        chordChart: `조: G장조  ♩=70

[전주]
G  -  D  -  Em  -  C  (x2)

[1절]
G              D
  주님 한 분만으로
Em                C
  내 영혼 만족해
G              D
  이 세상 무엇도
Em      C       G
  주님 대신 못해

G              D
  화려한 것들도
Em                C
  내 맘 채울 수 없어
G              D
  오직 주님만이
Em      C       G
  나의 전부라

[후렴]
G          D
  주님만으로 충분해요
Em         C
  주님만으로 족해요
G               D
  이 세상 어떤 것도
Em    C        G
  주님 대신 없어요

[2절]
G              D
  고난이 와도
Em                C
  주님이 계시니
G              D
  두려움 없이
Em      C       G
  나아갑니다

[브릿지]
Em         D
  주님만이 나의 힘
C          G
  주님만이 나의 빛
Em         D
  주님만이 나의 길
C    D      G
  주님만 따라가`,
      },
      {
        id: 's2',
        title: '은혜 아니면',
        artist: '조성은',
        key: 'C',
        bpm: '65',
        youtubeId: 'CCBq3ZKXhhk',
        youtubeQuery: '은혜 아니면 CCM 찬양',
        sheetImageUrl: 'https://t1.daumcdn.net/cfile/tistory/998B2F4B5A99FA8913',
        description: '하나님의 은혜로만 살아감을 고백하는 찬양',
        chordChart: `조: C장조  ♩=65

[전주]
C  -  G  -  Am  -  F  (x2)

[1절]
C              G
  은혜 아니면
Am                F
  아무것도 할 수 없어
C              G
  주님의 사랑
Am      F       C
  없이는 살 수 없어

G              Am
  연약한 나를 붙드신
F              G
  주님의 그 손

[후렴]
C          G
  은혜로다 은혜로다
Am         F
  하나님의 은혜
C               G
  나를 살리신 은혜
Am    F        C
  영원하리라

C          G
  사랑이라 사랑이라
Am         F
  끝없는 사랑
C               G
  내게 부어주신
Am    F        C
  그 사랑으로

[2절]
C              G
  내 힘이 다해도
Am                F
  주께서 일으키시네
C              G
  내 길이 막혀도
Am      F       C
  주님이 여시네

[브릿지]
Am    G    F    C  (x2)
  은혜 은혜 은혜로다`,
      },
      {
        id: 's3',
        title: '내게 강 같은 평화',
        artist: '찬송가 413장',
        key: 'F',
        bpm: '72',
        youtubeId: '08F4mCbyc2k',
        youtubeQuery: '내게 강 같은 평화 찬송가',
        sheetImageUrl: 'https://t1.daumcdn.net/cfile/tistory/99FA7633598F0B6433',
        description: '주님 안에서 누리는 강 같은 평화를 노래하는 찬송',
        chordChart: `조: F장조  ♩=72

[1절]
F                  Bb
  내게 강 같은 평화
F         C7
  내게 강 같은 평화
F                  Bb
  내게 강 같은 평화
    C7          F
  넘치는 기쁨 있어라

[후렴]
Bb            F
  나 주님의 것 주님 나의 것
C7             F
  나 주님의 것 되었네
Bb            F
  나 주님의 것 주님 나의 것
     C7       F
  주님의 것 되었네

[2절]
F                  Bb
  내게 산 같은 믿음
F         C7
  내게 산 같은 믿음
F                  Bb
  내게 산 같은 믿음
    C7          F
  넘치는 기쁨 있어라

[3절]
F                  Bb
  내게 샘 같은 사랑
F         C7
  내게 샘 같은 사랑
F                  Bb
  내게 샘 같은 사랑
    C7          F
  넘치는 기쁨 있어라`,
      },
      {
        id: 's4',
        title: '사랑합니다 주님',
        artist: '다윗과 요나단',
        key: 'D',
        bpm: '68',
        youtubeId: 'EprW6A99VQ0',
        youtubeQuery: '사랑합니다 주님 CCM 찬양',
        sheetImageUrl: 'https://t1.daumcdn.net/cfile/tistory/253C6C4F55D4A7C118',
        description: '주님을 향한 사랑을 온 마음으로 고백하는 찬양',
        chordChart: `조: D장조  ♩=68

[전주]
D  -  A  -  Bm  -  G  (x2)

[1절]
D              A
  사랑합니다 주님
Bm                G
  온 맘으로 주를 사랑해
D              A
  나의 힘 되신 주
Bm      G       D
  영원히 사랑해요

A              Bm
  이 고백이 내 삶이
G              A
  되기를 원합니다

[후렴]
G          A
  주님 사랑해요
D          Bm
  온 맘으로
G          A         D
  영원토록 주를 사랑해요

G          A
  주님 사랑해요
Bm         G
  변함없이
A              D
  주님만을 사랑해요

[2절]
D              A
  내 삶의 주인 되신
Bm                G
  주님의 뜻대로 살고파
D              A
  어디서든지
Bm      G       D
  주님 사랑 전할게요

[브릿지]
Bm    A    G    D
  주님 내 안에 사시고
Bm    A    G    A
  나는 주님 안에 있어요`,
      },
      {
        id: 's5',
        title: '하나님의 은혜',
        artist: '소리엘',
        key: 'Bb',
        bpm: '75',
        youtubeId: 'Ro7j1INS2CU',
        youtubeQuery: '하나님의 은혜 찬양 CCM 워십',
        sheetImageUrl: 'https://img.youtube.com/vi/Ro7j1INS2CU/maxresdefault.jpg',
        description: '날마다 새롭게 채워주시는 하나님의 은혜를 찬양',
        chordChart: `조: Bb장조  ♩=75

[전주]
Bb  -  F  -  Gm  -  Eb  (x2)

[1절]
Bb              F
  하나님의 은혜로
Gm                Eb
  내가 살아가네
Bb              F
  날마다 새롭게
Gm      Eb      Bb
  채우시는 은혜

F              Gm
  내 힘으로 안 되지만
Eb             F
  주의 은혜 충분해

[후렴]
Eb             F
  은혜로다 은혜로다
Gm             Bb
  하나님의 은혜
Eb             F
  이 은혜가 나를
     Gm  Eb   Bb
  살게 하네

[2절]
Bb              F
  험한 세상 가운데
Gm                Eb
  주의 손 붙잡고
Bb              F
  두렵지 않아요
Gm      Eb      Bb
  주님 함께하시니

[브릿지]
Gm    F    Eb    Bb  (x2)
  은혜 은혜 오직 은혜로

Gm    F    Eb
  은혜로 살고
Eb    F    Bb
  은혜로 서리`,
      },
    ],
  },
]

export function getPraiseByDate(date: string): WeeklyPraise | undefined {
  return PRAISE_WEEKS.find((w) => w.date === date)
}

export function getAllPraiseDates(): WeeklyPraise[] {
  return [...PRAISE_WEEKS].sort((a, b) => b.date.localeCompare(a.date))
}

// 곡명으로 등록된 찬양 검색 (가정예배 악보 재사용) — 부분 일치
export function findPraiseSong(title: string): PraiseSong | undefined {
  const q = title.replace(/\s/g, '')
  for (const week of PRAISE_WEEKS) {
    const hit = week.songs.find(s => {
      const t = s.title.replace(/\s/g, '')
      return t === q || t.includes(q) || q.includes(t)
    })
    if (hit) return hit
  }
  return undefined
}
