// JS SDK 없이 REST API OAuth URL 직접 사용 — 추가 환경변수 불필요
export default function KakaoAuthPage() {
  const restKey = process.env.KAKAO_REST_API_KEY
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  const redirectUri = `${apiUrl}/api/kakao/callback`

  const authUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${restKey}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=friends%2Ctalk_message`

  return (
    <div style={{
      fontFamily: 'sans-serif', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAFA',
    }}>
      <div style={{
        maxWidth: 480, width: '100%', margin: '0 auto',
        padding: '40px 24px', background: '#fff',
        borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔑</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
          카카오 추가 동의
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
          하루꽃 <strong>친구에게 보내기</strong> 기능에 필요한<br />
          카카오 스코프 동의를 진행합니다.
        </p>

        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 10, padding: '16px 20px', marginBottom: 28, textAlign: 'left',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 10 }}>필요한 동의 항목</div>
          {[
            { icon: '👥', label: '카카오톡 친구 목록', desc: '앱을 허용한 친구 목록 조회' },
            { icon: '💬', label: '카카오톡 메시지 전송', desc: '지정 친구에게 꽃 메시지 발송' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 8 }}>
              <span>{item.icon}</span>
              <div>
                <strong style={{ color: '#92400E' }}>{item.label}</strong>
                <span style={{ color: '#78350F', marginLeft: 6, fontSize: 12 }}>— {item.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <a
          href={authUrl}
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            padding: '15px', background: '#FEE500',
            color: '#3C1E1E', borderRadius: 10,
            textDecoration: 'none', fontWeight: 700, fontSize: 16,
            marginBottom: 20,
          }}
        >
          💬 카카오 동의 추가 + 토큰 발급
        </a>

        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, textAlign: 'left' }}>
          <p>• 버튼 클릭 → 카카오 동의 화면 → 동의 완료 → 토큰 자동 표시</p>
          <p>• 발급된 <code>KAKAO_ACCESS_TOKEN</code>, <code>KAKAO_REFRESH_TOKEN</code>을 Vercel 환경변수에 업데이트 후 Redeploy</p>
          <p style={{ marginTop: 6 }}>
            Redirect URI (콘솔에 등록 필요):<br />
            <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, wordBreak: 'break-all' }}>
              {redirectUri}
            </code>
          </p>
        </div>
      </div>
    </div>
  )
}
