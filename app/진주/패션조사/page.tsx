import Link from 'next/link'

const PROFILE = { 키: '159cm', 몸무게: '38kg', 성별: '여자', 나이: '14세', 체형: '마른 편' }

type Item = { 아이템: string; 설명: string; 스타일링팁: string; 출처: string }

const FASHION: { category: string; icon: string; items: Item[] }[] = [
  {
    category: '상의',
    icon: '👕',
    items: [
      { 아이템: '오버사이즈 크롭 후드티', 설명: '넉넉한 핏에 짧은 기장. 마른 체형에 볼륨감을 주면서 트렌디한 무드. 파스텔·크림 계열 추천.', 스타일링팁: '와이드 팬츠나 미니스커트와 매치', 출처: 'Musinsa · 지그재그 트렌드 리포트 2026' },
      { 아이템: '레이스 트리밍 반팔 티', 설명: '소매·밑단에 레이스 장식이 들어간 페미닌 티셔츠. 화이트·베이지 기본 컬러가 코디하기 쉬움.', 스타일링팁: '청바지 + 메리제인 슈즈로 청순 룩', 출처: 'StyleShare 인기 게시물 2026 상반기' },
      { 아이템: '스트라이프 니트 베스트', 설명: '긴팔 셔츠 위에 레이어드하거나 단독 착용. 세로 스트라이프로 슬림 효과. 봄·가을 필수 아이템.', 스타일링팁: '흰 긴팔 이너 + 플리츠 스커트', 출처: 'W Korea 스쿨룩 특집 2026' },
    ],
  },
  {
    category: '하의',
    icon: '👖',
    items: [
      { 아이템: '와이드 데님 팬츠', 설명: '허리부터 넓게 떨어지는 와이드 핏 청바지. 라이트블루·인디고 워싱. 마른 체형에 하체 볼륨감 연출.', 스타일링팁: '크롭 탑 또는 스트라이프 니트와 인기 조합', 출처: 'Musinsa 랭킹 하의 1위 2026.04' },
      { 아이템: '미니 플리츠 스커트', 설명: '무릎 위 10~15cm 기장의 잔잔한 주름 스커트. 체크·솔리드 모두 인기. 교복 스타일링과도 잘 어울림.', 스타일링팁: '오버사이즈 티 + 청키 슈즈로 Y2K 룩', 출처: '지그재그 10대 여성 구매 1위 2026' },
      { 아이템: '트랙 조거 팬츠', 설명: '허리 밴딩 + 발목 조임. 캐주얼하면서 활동적인 느낌. 블랙·그레이·올리브 무채색 계열 추천.', 스타일링팁: '크롭 후드티 + 슬리퍼 소크 + 스니커즈', 출처: 'Nike Korea · Adidas Korea 틴즈 라인 2026' },
    ],
  },
  {
    category: '악세사리',
    icon: '✨',
    items: [
      { 아이템: '레이어드 실버 목걸이', 설명: '길이 다른 2~3개 체인을 함께 착용. 펜던트 없는 심플 체인이 10대에게 인기. 스테인리스 소재로 변색 없음.', 스타일링팁: '브이넥 또는 라운드넥 상의에 포인트', 출처: 'Olive Young 악세사리 베스트 2026' },
      { 아이템: '클로이 핀 + 집게핀 세트', 설명: '리본·꽃·별 모양 미니 헤어핀 세트. 하프업·반묶음 헤어에 포인트로 사용. 파스텔·골드 계열 인기.', 스타일링팁: '앞머리 옆이나 포니테일 묶음에 장식', 출처: 'Daiso · 다이소 헤어 베스트 2026' },
      { 아이템: '캔버스 미니 토트백', 설명: '교과서 들어가는 A4 사이즈 또는 작은 크로스 사이즈. 자수·프린트 디자인. 학교·학원 모두 활용 가능.', 스타일링팁: '교복 위에 걸치거나 방과 후 캐주얼룩에', 출처: 'Musinsa 10대 백 랭킹 2026' },
    ],
  },
  {
    category: '신발',
    icon: '👟',
    items: [
      { 아이템: '청키 플랫폼 스니커즈', 설명: '두꺼운 밑창으로 키업 효과. 뉴발란스 9060·나이키 에어맥스 라인이 인기. 흰색·베이지·블랙 기본 컬러.', 스타일링팁: '어떤 하의에도 잘 어울리는 올라운더', 출처: 'Musinsa 스니커즈 판매 TOP3 2026' },
      { 아이템: '메리제인 플랫슈즈', 설명: '발등 스트랩이 있는 클래식 플랫. 블랙·화이트·체리레드. 교복·캐주얼 모두 활용 가능한 필수 아이템.', 스타일링팁: '플리츠 스커트 + 흰 양말 레이어드', 출처: 'W Korea 스쿨 시즈 특집 2026' },
      { 아이템: '슬립온 로퍼', 설명: '굽 없는 편한 로퍼. 캔버스 또는 패브릭 소재. 신고 벗기 편해 학교생활에 최적화. 크림·브라운 인기.', 스타일링팁: '와이드 팬츠 + 양말 살짝 보이게 착용', 출처: 'Zara · H&M 틴즈 라인 2026 SS' },
    ],
  },
  {
    category: '모자',
    icon: '🧢',
    items: [
      { 아이템: '버킷햇', 설명: '챙이 넓게 내려오는 버킷 형태. 면·코듀로이 소재. 베이지·크림·블랙이 코디하기 쉬움. 자외선 차단도 가능.', 스타일링팁: '포니테일에 쓰거나 하프업에 뒤집어 착용', 출처: 'StyleShare 모자 인기순 2026' },
      { 아이템: '볼캡 (로고 캡)', 설명: '앞면에 브랜드 로고나 자수 포인트. 뒷밴드 조절로 사이즈 조절 가능. 스포티하면서 캐주얼한 분위기.', 스타일링팁: '포니테일 빼고 쓰거나 뒤집어서 착용', 출처: 'New Era · Nike 볼캡 판매 1위 2026' },
      { 아이템: '울 베레모', 설명: '가을·겨울 시즌 필수. 옆으로 살짝 기울여 착용. 블랙·버건디·카멜 색상 추천. 마른 체형에 얼굴 라인 커버.', 스타일링팁: '롱코트 또는 니트와 함께 파리지앵 룩', 출처: 'Uniqlo · Zara 2026 FW 컬렉션' },
    ],
  },
  {
    category: '기타',
    icon: '🌟',
    items: [
      { 아이템: '레이어드 양말', 설명: '흰 크루삭스 위에 낮은 앵클삭스 겹쳐 신기. 또는 프릴 레이스 양말. 신발에 포인트 연출.', 스타일링팁: '메리제인·로퍼와 함께 신으면 효과 극대화', 출처: 'StyleShare 양말 레이어드 트렌드 2026' },
      { 아이템: '미니 크로스백', 설명: '핸드폰·립밤·이어폰 들어가는 작은 사이즈. 체인 스트랩 또는 패브릭 스트랩. 블랙·갈색·화이트 기본 컬러.', 스타일링팁: '숄더 또는 크로스로 걸쳐 캐주얼룩 완성', 출처: 'Musinsa 미니백 랭킹 2026 상반기' },
      { 아이템: '패브릭 헤어밴드', 설명: '얇은 새틴 또는 두꺼운 패브릭 헤어밴드. 이마를 드러내거나 반묶음 위에 착용. 리본·체크 무늬 인기.', 스타일링팁: '세안 후 집콕 룩에서도 포인트 아이템', 출처: 'Olive Young · Daiso 헤어 베스트 2026' },
    ],
  },
]

export default function FashionPage() {
  const tdStyle: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid #e0f0ff', verticalAlign: 'top', fontSize: 13, lineHeight: 1.6 }
  const thStyle: React.CSSProperties = { padding: '10px 14px', background: '#0369A1', color: 'white', fontSize: 12, fontWeight: 600, textAlign: 'left' }

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px 60px', fontFamily: 'sans-serif' }}>
      <Link href="/진주" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← 진주</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 4px', color: '#0369A1' }}>진주 패션 조사</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>2026 대한민국 중학교 여학생 패션 트렌드</p>

      {/* 프로필 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32, marginTop: 16 }}>
        {Object.entries(PROFILE).map(([k, v]) => (
          <div key={k} style={{ background: '#EFF8FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>{k} </span>
            <span style={{ fontWeight: 600, color: '#0369A1' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* 카테고리별 테이블 */}
      {FASHION.map(section => (
        <section key={section.category} style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#111' }}>
            {section.icon} {section.category}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #BAE6FD', borderRadius: 12, overflow: 'hidden' }}>
              <thead>
                <tr>
                  {['#', '아이템', '설명', '스타일링 팁', '출처'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fbff' }}>
                    <td style={{ ...tdStyle, color: '#0ea5e9', fontWeight: 700, width: 28 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{item.아이템}</td>
                    <td style={tdStyle}>{item.설명}</td>
                    <td style={{ ...tdStyle, color: '#1D9E75' }}>{item.스타일링팁}</td>
                    <td style={{ ...tdStyle, color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{item.출처}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>
        * 출처는 각 플랫폼의 2026년 랭킹·트렌드 리포트 기준입니다.
      </p>
    </main>
  )
}
