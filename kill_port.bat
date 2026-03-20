@echo off
setlocal EnableDelayedExpansion

set BACKEND_ENV=apps\backend\.env
set FRONTEND_ENV=apps\frontend\.env
set PROXY_ENV=apps\reverse-proxy\.env
set BACKEND_PORT=3001
set FRONTEND_PORT=3002
set PROXY_PORT=7777
set RELAY_API_PORT=1984
set RELAY_RTSP_PORT=8554
set RELAY_WEBRTC_PORT=8555

:: Read Backend Port
if exist %BACKEND_ENV% (
    for /f "tokens=1,2 delims==" %%a in ('findstr /b "PORT=" %BACKEND_ENV%') do (
        set BACKEND_PORT=%%b
    )
)

:: Read Frontend Port
if exist %FRONTEND_ENV% (
    for /f "tokens=1,2 delims==" %%a in ('findstr /b "PORT=" %FRONTEND_ENV%') do (
        set FRONTEND_PORT=%%b
    )
)

:: Read Proxy Port
if exist %PROXY_ENV% (
    for /f "tokens=1,2 delims==" %%a in ('findstr /b "PORT=" %PROXY_ENV%') do (
        set PROXY_PORT=%%b
    )
)

echo Killing processes on ports: Frontend=!FRONTEND_PORT!, Backend=!BACKEND_PORT!, Proxy=!PROXY_PORT!, RelayAPI=!RELAY_API_PORT!, RelayRTSP=!RELAY_RTSP_PORT!, RelayWebRTC=!RELAY_WEBRTC_PORT!

call :KillPort !FRONTEND_PORT!
call :KillPort !BACKEND_PORT!
call :KillPort !PROXY_PORT!
call :KillPort !RELAY_API_PORT!
call :KillPort !RELAY_RTSP_PORT!
call :KillPort !RELAY_WEBRTC_PORT!
taskkill /F /IM go2rtc.exe >nul 2>&1
goto :eof

:KillPort
set port=%1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":%port% .*LISTENING"') do (
    if "%%a" neq "0" (
        echo Killing process %%a on port %port%
        taskkill /F /PID %%a >nul 2>&1
    )
)
goto :eof
