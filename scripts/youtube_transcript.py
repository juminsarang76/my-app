#!/usr/bin/env python3
"""
YouTube 자막 추출 스크립트
============================
PC:      python youtube_transcript.py [URL]
Android: Termux에서 실행
iPhone:  a-Shell / iSH에서 실행

설치:
  pip install youtube-transcript-api

결과: 문장 단위로 합쳐서 출력 + 파일 저장 → Haru Flower에 붙여넣기
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


def merge_into_sentences(data) -> list[dict]:
    """
    자막 줄들을 완성된 문장으로 합치기.
    규칙: 마침표(. ? !)가 나올 때까지 다음 줄과 계속 합침.
    """
    SENTENCE_END = re.compile(r'[.?!]["\')»\s]*$')

    sentences = []
    buffer_texts = []
    buffer_start = 0.0
    buffer_duration = 0.0

    for item in data:
        start    = item.start    if hasattr(item, 'start')    else item['start']
        duration = item.duration if hasattr(item, 'duration') else item.get('duration', 3)
        text     = item.text     if hasattr(item, 'text')     else item['text']
        text     = text.strip().replace('\n', ' ')

        if not text:
            continue

        if not buffer_texts:
            buffer_start = start
            buffer_duration = 0.0

        buffer_texts.append(text)
        buffer_duration += duration

        # 마침표 / 물음표 / 느낌표로 끝나면 → 완성 문장
        if SENTENCE_END.search(text):
            sentences.append({
                'text': ' '.join(buffer_texts),
                'start': buffer_start,
                'duration': buffer_duration,
            })
            buffer_texts = []

    # 마지막 버퍼 (구두점 없이 끝난 경우)
    if buffer_texts:
        sentences.append({
            'text': ' '.join(buffer_texts),
            'start': buffer_start,
            'duration': buffer_duration,
        })

    return sentences


def build_output(sentences: list[dict], fmt: str = '1') -> str:
    lines = []
    for s in sentences:
        text = s['text']
        if fmt == '2':
            lines.append(f"[{format_time(s['start'])}] {text}")
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
        print("유효한 YouTube URL이 아닙니다.")
        sys.exit(1)

    print(f"\n자막 추출 중... ({video_id})")

    try:
        data, lang = get_transcript(video_id)
        print(f"완료: {lang} 언어, {len(data)}줄\n")
    except Exception as e:
        print(f"실패: {e}")
        sys.exit(1)

    # 문장 합치기
    sentences = merge_into_sentences(data)
    print(f"문장 합치기 완료: {len(data)}줄 → {len(sentences)}문장\n")

    # 형식 선택
    print("출력 형식:")
    print("  1. 문장 텍스트만 (권장, Haru Flower 붙여넣기용)")
    print("  2. [MM:SS] 타임스탬프 포함")
    try:
        fmt = input("선택 (1/2, 기본 1): ").strip() or '1'
    except (EOFError, KeyboardInterrupt):
        fmt = '1'

    output = build_output(sentences, fmt)

    # 파일 저장
    filename = f"transcript_{video_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"\n파일 저장: {filename}")
    except Exception:
        pass

    # 클립보드 복사 시도 (PC에서만)
    copied = False
    try:
        import pyperclip
        pyperclip.copy(output)
        copied = True
        print("클립보드 복사 완료!")
    except Exception:
        pass

    # 화면 출력
    print()
    print("=" * 55)
    print("아래 텍스트를 전체 복사 → Haru Flower에 붙여넣기")
    print("=" * 55)
    print(output)
    print("=" * 55)

    if copied:
        print("\n[클립보드 복사됨] haruflower.vercel.app/youtube → 클립보드 버튼 클릭")
    else:
        print("\n위 텍스트를 전체 선택 → 복사")
        print("→ haruflower.vercel.app/youtube → 자막 붙여넣기 → 붙여넣기")


if __name__ == '__main__':
    main()
