@echo off
chcp 65001 > nul
echo ====================================
echo  YouTube 자막 추출기 (Haru Flower)
echo ====================================
echo.

:: Python 확인
python --version > nul 2>&1
if errorlevel 1 (
    echo ERROR: Python이 설치되지 않았습니다.
    echo https://www.python.org/downloads/ 에서 설치하세요.
    pause
    exit /b 1
)

:: 패키지 설치
echo 필요 패키지 설치 중...
pip install youtube-transcript-api pyperclip -q

echo.
:: 실행
if "%1"=="" (
    python "%~dp0youtube_transcript.py"
) else (
    python "%~dp0youtube_transcript.py" %1
)

echo.
pause
