"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const src = (n: number) => `/lecture-slides/slide-${String(n).padStart(2, "0")}.png`;

type Chapter = { slide: number; label: string };
type Video = { slide: number; url: string; label: string };
const FALLBACK_VIDEOS: Video[] = [
  { slide: 25, url: "https://www.youtube.com/watch?v=Tnylnmji47Q", label: "다크팩토리 영상" },
  { slide: 26, url: "https://www.youtube.com/watch?v=Vsi97LlkKaI", label: "조선소 로봇 영상" },
];
const FALLBACK: { total: number; chapters: Chapter[] } = {
  total: 53,
  chapters: [
    { slide: 1, label: "오프닝" },
    { slide: 5, label: "1부 AI란 무엇인가" },
    { slide: 15, label: "2부 일상이 바뀐다" },
    { slide: 22, label: "3부 일터가 바뀐다" },
    { slide: 29, label: "4부 세상이 바뀐다" },
    { slide: 35, label: "5부 클로드 사용법" },
    { slide: 45, label: "6부 우리가 해야 할 것들" },
  ],
};

export default function LecturePage() {
  const [cur, setCur] = useState(1);
  const [TOTAL, setTotal] = useState(FALLBACK.total);
  const [CHAPTERS, setChapters] = useState<Chapter[]>(FALLBACK.chapters);
  const [VIDEOS, setVideos] = useState<Video[]>(FALLBACK_VIDEOS);

  useEffect(() => {
    fetch("/lecture-slides/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m?.total) setTotal(m.total);
        if (Array.isArray(m?.chapters)) setChapters(m.chapters);
        if (Array.isArray(m?.videos)) setVideos(m.videos);
      })
      .catch(() => {});
  }, []);
  const [showBar, setShowBar] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback((n: number) => {
    setCur(Math.min(TOTAL, Math.max(1, n)));
  }, [TOTAL]);

  const poke = useCallback(() => {
    setShowBar(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowBar(false), 2500);
  }, []);

  useEffect(() => {
    poke();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") go(cur + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(cur - 1);
      else if (e.key === "Home") go(1);
      else if (e.key === "End") go(TOTAL);
      else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } else return;
      poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, go, poke]);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ background: "#0B1214" }}
      onMouseMove={poke}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -40) go(cur + 1);
        else if (dx > 40) go(cur - 1);
        touchX.current = null;
        poke();
      }}
    >
      {/* 슬라이드 (등장 애니메이션: 페이드인 + 미세 줌) */}
      <style>{`
        @keyframes slideIn { 0% { opacity: 0; transform: scale(0.985); } 12% { opacity: 1; } 100% { opacity: 1; transform: scale(1.012); } }
        @media (prefers-reduced-motion: reduce) { .slide-anim { animation: none !important; } }
      `}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={cur}
        src={src(cur)}
        alt={`슬라이드 ${cur} / ${TOTAL}`}
        className="slide-anim absolute inset-0 h-full w-full object-contain"
        style={{ animation: "slideIn 16s ease-out both" }}
        draggable={false}
      />
      {/* 다음 슬라이드 미리 로드 */}
      {cur < TOTAL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src(cur + 1)} alt="" className="hidden" />
      )}

      {/* 좌우 클릭 영역 */}
      <button
        aria-label="이전 슬라이드"
        className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize"
        onClick={() => { go(cur - 1); poke(); }}
      />
      <button
        aria-label="다음 슬라이드"
        className="absolute inset-y-0 right-0 w-3/4 cursor-e-resize"
        onClick={() => { go(cur + 1); poke(); }}
      />

      {/* 영상 링크 (PNG라 슬라이드 내 하이퍼링크가 죽으므로 실제 버튼 오버레이) */}
      {VIDEOS.filter((v) => v.slide === cur).map((v) => (
        <a
          key={v.url}
          href={v.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-4 top-10 z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-lg transition-transform hover:scale-105"
          style={{ background: "#2AD5C0", color: "#0B1214" }}
        >
          ▶ 영상 보기 — {v.label}
        </a>
      ))}

      {/* 하단 바 */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 py-3 transition-opacity duration-300 ${showBar ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(transparent, rgba(11,18,20,.92))" }}
      >
        <span className="shrink-0 font-mono text-xs tabular-nums" style={{ color: "#8FA6A4" }}>
          {cur} / {TOTAL}
        </span>
        <input
          type="range"
          min={1}
          max={TOTAL}
          value={cur}
          onChange={(e) => { go(Number(e.target.value)); poke(); }}
          className="h-1 w-full cursor-pointer accent-[#2AD5C0]"
          aria-label="슬라이드 이동"
        />
        <div className="hidden shrink-0 gap-1 md:flex">
          {CHAPTERS.map((c) => (
            <button
              key={c.slide}
              onClick={(e) => { e.stopPropagation(); go(c.slide); poke(); }}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors"
              style={{
                background: cur >= c.slide && (CHAPTERS.find((x) => x.slide > c.slide)?.slide ?? TOTAL + 1) > cur ? "#0E3A36" : "#142125",
                color: cur >= c.slide && (CHAPTERS.find((x) => x.slide > c.slide)?.slide ?? TOTAL + 1) > cur ? "#2AD5C0" : "#8FA6A4",
                border: "1px solid #1E3237",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 상단 타이틀 */}
      <div
        className={`absolute inset-x-0 top-0 flex items-center justify-between px-4 py-2 text-xs transition-opacity duration-300 ${showBar ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(rgba(11,18,20,.85), transparent)", color: "#8FA6A4" }}
      >
        <span className="font-bold" style={{ color: "#2AD5C0" }}>AI가 바꾸는 세상 — 향상교회 이주민 사역</span>
        <span>←/→ 이동 · F 전체화면</span>
      </div>
    </div>
  );
}
