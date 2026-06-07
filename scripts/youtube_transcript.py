#!/usr/bin/env python3
"""
YouTube 자막 추출 스크립트
사용법: python youtube_transcript.py [YouTube URL 또는 ID]
결과: 클립보드에 자동 복사 → Haru Flower에 붙여넣기

필요 패키지 설치:
  pip install youtube-transcript-api pyperclip
"""

import sys
import re
import json
from datetime import datetime

def extract_video_id(url: str) -> str | None:
    patterns = [
        r'youtu\.be/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/(?:watch\?v=|embed/|shorts/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$',
    ]
    for p in patterns:
        m = re.search(p, url.strip())
        if m:
            return m.group(1)
    return None

def format_time(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 60:02d}:{s % 60:02d}"

def get_transcript(video_id: str, prefer_langs: list[str] = ['ko', 'en']) -> tuple[list, str]:
    from youtube_transcript_api import YouTubeTranscriptApi

    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)

    # 선호 언어 순서로 시도
    transcript = None
    lang_used = 'auto'
    for lang in prefer_langs:
        try:
            transcript = transcript_list.find_transcript([lang])
            lang_used = lang
            break
        except Exception:
            continue

    # 없으면 첫 번째 자막 사용
    if transcript is None:
        transcript = next(iter(transcript_list))
        lang_used = transcript.language_code

    data = transcript.fetch()
    return data, lang_used

def format_as_srt(data) -> str:
    """SRT 형식으로 변환"""
    lines = []
    for i, item in enumerate(data, 1):
        start = item.start if hasattr(item, 'start') else item['start']
        text = item.text if hasattr(item, 'text') else item['text']
        dur = item.duration if hasattr(item, 'duration') else item.get('duration', 3)
        end = start + dur
        lines.append(str(i))
        lines.append(
            f"{int(start//3600):02d}:{int((start%3600)//60):02d}:{int(start%60):02d},{int((start%1)*1000):03d} --> "
            f"{int(end//3600):02d}:{int((end%3600)//60):02d}:{int(end%60):02d},{int((end%1)*1000):03d}"
        )
        lines.append(text.strip())
        lines.append('')
    return '\n'.join(lines)

def format_with_timestamp(data) -> str:
    """타임스탬프 포함 텍스트"""
    lines = []
    for item in data:
        start = item.start if hasattr(item, 'start') else item['start']
        text = item.text if hasattr(item, 'text') else item['text']
        lines.append(f"[{format_time(start)}] {text.strip()}")
    return '\n'.join(lines)

def copy_to_clipboard(text: str) -> bool:
    try:
        import pyperclip
        pyperclip.copy(text)
        return True
    except Exception:
        return False

def save_to_file(text: str, video_id: str) -> str:
    filename = f"transcript_{video_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(text)
    return filename

def main():
    # URL 입력 받기
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = input("YouTube URL 또는 영상 ID를 입력하세요: ").strip()

    video_id = extract_video_id(url)
    if not video_id:
        print("❌ 유효한 YouTube URL이 아닙니다.")
        sys.exit(1)

    print(f"📥 자막 추출 중... (video_id: {video_id})")

    try:
        data, lang = get_transcript(video_id)
        print(f"✅ 자막 추출 완료: {lang} 언어, {len(data)}줄")
    except Exception as e:
        print(f"❌ 자막 추출 실패: {e}")
        print("\n💡 해결 방법:")
        print("  - 영상에 자막이 있는지 확인하세요 (YouTube CC 버튼)")
        print("  - 다른 영상으로 시도해보세요")
        sys.exit(1)

    # 형식 선택
    print("\n출력 형식을 선택하세요:")
    print("  1. 타임스탬프 포함 텍스트 (권장)")
    print("  2. SRT 형식")
    print("  3. 일반 텍스트 (타임스탬프 없음)")
    choice = input("선택 (1/2/3, 기본값 1): ").strip() or '1'

    if choice == '2':
        output = format_as_srt(data)
        fmt_name = "SRT"
    elif choice == '3':
        output = '\n'.join(
            (item.text if hasattr(item, 'text') else item['text']).strip()
            for item in data
        )
        fmt_name = "일반 텍스트"
    else:
        output = format_with_timestamp(data)
        fmt_name = "타임스탬프 포함"

    print(f"\n📋 {fmt_name} 형식으로 생성됨 ({len(output)}자)")

    # 클립보드 복사 시도
    if copy_to_clipboard(output):
        print("✅ 클립보드에 복사됐습니다!")
        print("\n👉 haruflower.vercel.app/youtube 에서:")
        print("   '📋 downsub 등에서 자막 붙여넣기' 버튼 클릭 → Ctrl+V")
    else:
        # 파일로 저장
        fname = save_to_file(output, video_id)
        print(f"⚠️  클립보드 복사 실패 (pyperclip 미설치)")
        print(f"📁 파일로 저장됨: {fname}")
        print(f"\n설치하려면: pip install pyperclip")

    # 미리보기
    print("\n--- 미리보기 (처음 5줄) ---")
    for line in output.split('\n')[:5]:
        print(line)
    print("...")

if __name__ == '__main__':
    main()
