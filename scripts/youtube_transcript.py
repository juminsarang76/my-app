#!/usr/bin/env python3
"""
YouTube 자막 추출 스크립트
============================
PC:      python youtube_transcript.py [URL]
Android: Termux에서 실행
iPhone:  a-Shell / iSH에서 실행

설치:
  pip install youtube-transcript-api

결과: 화면 출력 + 파일 저장 → Haru Flower에 붙여넣기
"""

import sys
import re
from datetime import datetime

def extract_video_id(url: str):
    for p in [
        r'youtu\.be/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/(?:watch\?v=|embed/|shorts/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$',
    ]:
        m = re.search(p, url.strip())
        if m:
            return m.group(1)
    return None

def format_time(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 60:02d}:{s % 60:02d}"

def get_transcript(video_id: str):
    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi()
    tl = api.list(video_id)
    transcript = None
    lang = 'auto'
    for try_lang in ['ko', 'en']:
        try:
            transcript = tl.find_transcript([try_lang])
            lang = try_lang
            break
        except Exception:
            continue
    if transcript is None:
        transcript = next(iter(tl))
        lang = transcript.language_code
    data = transcript.fetch()
    return data, lang

def build_output(data, fmt: str = '1') -> str:
    lines = []
    for item in data:
        start = item.start if hasattr(item, 'start') else item['start']
        text  = item.text  if hasattr(item, 'text')  else item['text']
        text  = text.strip().replace('\n', ' ')
        if fmt == '2':
            lines.append(f"[{format_time(start)}] {text}")
        else:
            lines.append(text)
    return '\n'.join(lines)

def main():
    # URL 입력
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        print("YouTube 자막 추출기")
        print("=" * 40)
        url = input("YouTube URL 또는 ID: ").strip()

    video_id = extract_video_id(url)
    if not video_id:
        print("❌ 유효한 YouTube URL이 아닙니다.")
        sys.exit(1)

    print(f"\n📥 자막 추출 중... ({video_id})")

    try:
        data, lang = get_transcript(video_id)
        print(f"✅ {lang} 언어, {len(data)}줄\n")
    except Exception as e:
        print(f"❌ 실패: {e}")
        sys.exit(1)

    # 형식 선택
    print("형식 선택:")
    print("  1. 일반 텍스트 (타임스탬프 없음) — 권장")
    print("  2. [MM:SS] 타임스탬프 포함")
    try:
        fmt = input("선택 (1/2, 기본 1): ").strip() or '1'
    except (EOFError, KeyboardInterrupt):
        fmt = '1'

    output = build_output(data, fmt)

    # 파일 저장
    filename = f"transcript_{video_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"\n💾 파일 저장: {filename}")
    except Exception:
        pass

    # 클립보드 복사 시도 (PC에서만)
    copied = False
    try:
        import pyperclip
        pyperclip.copy(output)
        copied = True
        print("📋 클립보드에 복사됨!")
    except Exception:
        pass

    # 화면 출력 (모바일에서 직접 복사)
    print()
    print("=" * 50)
    print("📋 아래 텍스트를 전체 복사하세요")
    print("=" * 50)
    print(output)
    print("=" * 50)

    if copied:
        print("\n✅ 클립보드 복사 완료 → haruflower.vercel.app/youtube 붙여넣기")
    else:
        print("\n👆 위 텍스트를 길게 눌러 전체 선택 → 복사")
        print("→ haruflower.vercel.app/youtube → 📋 자막 붙여넣기")

if __name__ == '__main__':
    main()
