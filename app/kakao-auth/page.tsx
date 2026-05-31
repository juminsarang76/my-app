import { redirect } from 'next/navigation'

// 카카오 추가 동의 페이지
// 친구 목록(friends) + 메시지 전송(talk_message) 스코프 요청
export default function KakaoAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const restKey = process.env.KAKAO_REST_API_KEY
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (!restKey || !apiUrl) {
    return (
      <Page>
        <h2 style={{ color: '#ef4444' }}>❌ 환경변수 누락</h2>
        <p><code>KAKAO_REST_API_KEY</code> 또는 <code>NEXT_PUBLIC_API_URL</code>이 설정되지 않았습니다.</p>
      </Page>
    )
  }

  const redirectUri = `${apiUrl}/api/kakao/callback`
  const authUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${restKey}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=friends,talk_message` +
    `&auth_tpye=reprompt`  // 이미 로그인 상태라도 동의 화면 표시

  return (
    <Page>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔑</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
        카카오 추가 동의
      </h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
        하루꽃의 <strong>친구에게 보내기</strong> 기능을 사용하려면<br />
        카카오 계정에서 아래 항목에 동의가 필요합니다.
      </p>

      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '16px 20px', marginBottom: 28, textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>필요한 동의 항목</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { icon: '👥', label: '친구 목록', desc: '앱을 사용한 카카오 친구 목록 조회' },
            { icon: '💬', label: '카카오톡 메시지 전송', desc: '지정 친구에게 꽃 메시지 발송' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}>
              <span>{item.icon}</span>
              <div>
                <strong style={{ color: '#92400E' }}>{item.label}</strong>
                <span style={{ color: '#78350F', marginLeft: 6 }}>— {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <a
        href={authUrl}
        style={{
          display: 'inline-block',
          padding: '14px 36px',
          background: '#FEE500',
          color: '#3C1E1E',
          borderRadius: 10,
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 16,
        }}
      >
        💬 카카오 동의 진행하기
      </a>

      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
        <p>동의 완료 후 새 토큰이 표시됩니다.</p>
        <p>토큰을 <strong>Vercel 환경변수</strong>에 업데이트하고 Redeploy 하세요.</p>
        <p style={{ marginTop: 8 }}>
          Redirect URI가 콘솔에 등록되어 있어야 합니다:<br />
          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{redirectUri}</code>
        </p>
      </div>
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'sans-serif',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAFAFA',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        padding: '40px 24px',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        textAlign: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}
