import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My App",
  description: "양자뉴스 일일요약 서비스",
};

const NAV_LINKS = [
  { href: '/reports',  label: '정기요약' },
  { href: '/realtime', label: '실시간요약' },
  { href: '/stocks',   label: '증시지수' },
  { href: '/',         label: '할 일' },
  { href: '/photos',   label: '사진' },
  { href: '/battery',  label: '배터리' },
  { href: '/민준입시.html', label: '민준입시' },
  { href: '/강의.html',    label: '강의' },
  { href: '/jinju',        label: '진주' },
]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <nav style={{
          background: '#EFF8FF',
          padding: '12px 20px',
          fontFamily: 'sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0369A1', flexShrink: 0 }}>
            My App
          </div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none', padding: '6px 10px', borderRadius: 6 }}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </body>
    </html>
  )
}
