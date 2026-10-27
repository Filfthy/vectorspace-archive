@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "FF=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"

set "SRC=.\voices unprocessed"
set "DST=.\voices"
set "MEASURE=%TEMP%\voice_peak_%RANDOM%.txt"

if not exist "%FF%" (
    echo ERROR: FFmpeg not found:
    echo %FF%
    pause
    exit /b 1
)

if not exist "%SRC%" (
    echo ERROR: Source directory not found:
    echo %SRC%
    pause
    exit /b 1
)

if not exist "%DST%" mkdir "%DST%"

for %%F in ("%SRC%\*.mp3") do (

    echo.
    echo ==================================================
    echo NORMALIZING %%~nxF
    echo ==================================================

    set "PEAK="
    set "GAIN="

    rem Measure the current maximum peak.
    "%FF%" -hide_banner -nostats ^
        -i "%%~fF" ^
        -af "volumedetect" ^
        -f null NUL 2> "%MEASURE%"

    for /f "tokens=5" %%P in ('findstr /C:"max_volume:" "%MEASURE%"') do (
        set "PEAK=%%P"
    )

    if not defined PEAK (
        echo ERROR: Could not measure %%~nxF
    ) else (

        echo Peak before: !PEAK! dBFS

        rem Audacity-style maximum amplification:
        rem if peak is -12.4 dB, gain becomes +12.4 dB.
        for /f "delims=" %%G in ('powershell -NoProfile -Command "$p=[double]::Parse('!PEAK!',[Globalization.CultureInfo]::InvariantCulture); (-$p).ToString('0.000',[Globalization.CultureInfo]::InvariantCulture)"') do (
            set "GAIN=%%G"
        )

        echo Gain applied: !GAIN! dB

        "%FF%" -hide_banner -loglevel warning -y ^
            -i "%%~fF" ^
            -af "volume=!GAIN!dB:precision=double" ^
            -c:a libmp3lame -q:a 2 ^
            "%DST%\%%~nxF"

        if errorlevel 1 (
            echo ERROR writing %%~nxF
        ) else (
            echo Written: %DST%\%%~nxF
        )
    )
)

if exist "%MEASURE%" del "%MEASURE%" >NUL 2>&1

echo.
echo ==================================================
echo COMPLETE
echo ==================================================
pause