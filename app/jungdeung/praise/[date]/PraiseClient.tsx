'use client'

import { useState } from 'react'
import type { WeeklyPraise, PraiseSong } from '@/app/lib/praise'
import Link from 'next/link'

const TABS = ['🎼 코드보기', '▶ YouTube', '🎵 악보'] as const
type Tab = (typeof TABS)[number]

export default function PraiseClient({ week }: { week: WeeklyPraise }) {
  const [selectedId, setSelectedId] = useState<string>(week.songs[0]?.id ?? '')
  const [activeTab, setActiveTab] = useState<Tab>('🎼 코드보기')
  const [imgError, setImgError] = useState(false)

  const song = week.songs.find((s) => s.id === selectedId) ?? week.songs[0]

  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song.youtubeQuery)}`
  const sheetNaverUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(song.title + ' 악보')}&where=image`
  const sheetGoogleUrl = `https://www.google.com/search?q=${encodeURIComponent(song.title + ' 악보')}&tbm=isch`
  const musescoreUrl = `https://musescore.com/sheetmusic?text=${encodeURIComponent(song.title)}`

  function handleSongSelect(id: string) {
    setSelectedId(id)
    setImgError(false)
    setActiveTab('🎼 코드보기')
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* 브레드크럼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#64748b' }}>
        <Link href="/jungdeung" style={{ color: '#0369A1', textDecoration: 'none' }}>중등부</Link>
        <span>/</span>
        <Link href="/jungdeung/praise" style={{ color: '#0369A1', textDecoration: 'none' }}>찬양 선곡</Link>
        <span>/</span>
        <span>{week.displayDate}</span>
      </div>

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          {week.displayDate} 찬양 선곡
        </h1>
        <p style={{ fontSize: 13, color: '#64748b' }}>테마: {week.theme} · 곡을 선택하면 아래에 악보/코드가 표시됩니다.</p>
      </div>

      {/* ── 상단: 5곡 선택 카드 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 28,
      }}>
        {week.songs.map((s, idx) => {
          const isSelected = s.id === selectedId
          return (
            <button
              key={s.id}
              onClick={() => handleSongSelect(s.id)}
              style={{
                padding: '16px 12px',
                borderRadius: 12,
                border: isSelected ? '2px solid #0369A1' : '2px solid #BAE6FD',
                background: isSelected ? '#0369A1' : '#EFF8FF',
                color: isSelected ? '#fff' : '#0369A1',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.75 }}>
                {idx + 1}번 찬양
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{s.artist}</div>
              <div style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 20,
                background: isSelected ? 'rgba(255,255,255,0.25)' : '#DBEAFE',
                color: isSelected ? '#fff' : '#1D4ED8',
              }}>
                Key {s.key} · {s.bpm}BPM
              </div>
            </button>
          )
        })}
      </div>

      {/* ── 하단: 탭 + 콘텐츠 ── */}
      {song && (
        <div style={{
          border: '1px solid #BAE6FD',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#fff',
        }}>
          {/* 선택된 곡 헤더 */}
          <div style={{ padding: '18px 24px', background: '#E0F2FE', borderBottom: '1px solid #BAE6FD' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0369A1', marginBottom: 2 }}>
              {song.title}
            </div>
            <div style={{ fontSize: 13, color: '#0ea5e9' }}>
              {song.artist} &nbsp;·&nbsp; Key {song.key} &nbsp;·&nbsp; ♩={song.bpm} &nbsp;·&nbsp; {song.description}
            </div>
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #BAE6FD', background: '#F8FAFC' }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  borderBottom: activeTab === tab ? '3px solid #0369A1' : '3px solid transparent',
                  background: 'transparent',
                  color: activeTab === tab ? '#0369A1' : '#64748b',
                  fontWeight: activeTab === tab ? 700 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div style={{ padding: '24px' }}>

            {/* ── 코드보기 ── */}
            {activeTab === '🎼 코드보기' && (
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                  코드 위치는 바로 아래 음절에 해당합니다.
                </div>
                <pre style={{
                  fontFamily: '"D2Coding", "Courier New", monospace',
                  fontSize: 13,
                  lineHeight: 1.9,
                  color: '#1e293b',
                  background: '#F8FAFC',
                  padding: '20px 24px',
                  borderRadius: 10,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: '1px solid #E2E8F0',
                }}>
                  {song.chordChart}
                </pre>
              </div>
            )}

            {/* ── YouTube ── */}
            {activeTab === '▶ YouTube' && (
              <div>
                {/* 임베드 영상 */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '56.25%', // 16:9
                  borderRadius: 10,
                  overflow: 'hidden',
                  marginBottom: 16,
                  background: '#000',
                }}>
                  <iframe
                    style={{
                      position: 'absolute',
                      top: 0, left: 0,
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    }}
                    src={`https://www.youtube.com/embed/${song.youtubeId}?rel=0&modestbranding=1`}
                    title={song.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* 검색 링크 */}
                <div style={{ textAlign: 'center' }}>
                  <a
                    href={ytSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 24px',
                      background: '#FF0000',
                      color: '#fff',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    YouTube에서 더 검색하기
                  </a>
                </div>
              </div>
            )}

            {/* ── 악보 ── */}
            {activeTab === '🎵 악보' && (
              <div>
                {/* 악보 이미지 */}
                <div style={{ marginBottom: 20 }}>
                  {!imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={song.sheetImageUrl}
                      alt={`${song.title} 악보`}
                      onError={() => setImgError(true)}
                      style={{
                        width: '100%',
                        maxWidth: 680,
                        display: 'block',
                        margin: '0 auto',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                      }}
                    />
                  ) : (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      borderRadius: 10,
                      color: '#94a3b8',
                      border: '1px dashed #CBD5E1',
                    }}>
                      악보 이미지를 불러올 수 없습니다.<br />
                      아래 링크에서 검색하세요.
                    </div>
                  )}
                </div>

                {/* 악보 검색 버튼 */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <a href={sheetNaverUrl} target="_blank" rel="noopener noreferrer"
                    style={btnStyle('#1D9E75')}>
                    네이버 악보 검색
                  </a>
                  <a href={sheetGoogleUrl} target="_blank" rel="noopener noreferrer"
                    style={btnStyle('#4285F4')}>
                    구글 악보 검색
                  </a>
                  <a href={musescoreUrl} target="_blank" rel="noopener noreferrer"
                    style={btnStyle('#198CE7')}>
                    MuseScore
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '10px 22px',
    background: bg,
    color: '#fff',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 13,
  }
}
