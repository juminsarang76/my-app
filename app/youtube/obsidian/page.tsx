'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface GHFile { name: string; path: string; sha: string }

export default function YoutubeObsidianPage() {
  const [files, setFiles] = useState<GHFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GHFile | null>(null)
  const [content, setContent] = useState('')
  const [loadingContent, setLoadingContent] = useState(false)

  useEffect(() => {
    fetch('/api/youtube/github-list')
      .then(r => r.json())
      .then(d => { setFiles(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  async function handleSelect(file: GHFile) {
    setSelected(file)
    setLoadingContent(true)
    setContent('')
    const res = await fetch(`/api/youtube/github-file?path=${encodeURIComponent(file.path)}`)
    const data = await res.json()
    setContent(data.content ?? '')
    setLoadingContent(false)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/youtube" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13 }}>← 유튜브 자막</Link>
        <span style={{ color: '#94a3b8' }}>/</span>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🗂 Obsidian(GitHub) 저장 목록</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 2fr' : '1fr', gap: 16 }}>
        {/* 목록 */}
        <div>
          {loading ? (
            <p style={{ color: '#94a3b8', fontSize: 14 }}>불러오는 중...</p>
          ) : files.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 14 }}>저장된 파일이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map(f => (
                <button key={f.sha} onClick={() => handleSelect(f)} style={{
                  padding: '12px 16px', textAlign: 'left',
                  background: selected?.sha === f.sha ? '#6d28d9' : '#F8FAFC',
                  color: selected?.sha === f.sha ? '#fff' : '#1e293b',
                  border: '1px solid #E2E8F0', borderRadius: 10,
                  cursor: 'pointer', fontFamily: 'sans-serif',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: selected?.sha === f.sha ? '#c4b5fd' : '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                    {f.path}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 내용 */}
        {selected && (
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{selected.name}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>✕</button>
            </div>
            {loadingContent ? (
              <div style={{ padding: 24, color: '#94a3b8', fontSize: 14 }}>불러오는 중...</div>
            ) : (
              <pre style={{ padding: '16px', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 600, overflowY: 'auto' }}>
                {content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
