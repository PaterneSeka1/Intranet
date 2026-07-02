@echo off
:: VDM Intranet — Lancement en mode kiosque (Windows)
:: Remplacez l'URL ci-dessous par votre URL de déploiement

set VDM_URL=http://localhost:3000

:: Attendre 10 secondes que le réseau soit prêt
timeout /t 10 /nobreak > nul

:: Chercher Chrome ou Edge
set CHROME=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set CHROME=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
) else (
    echo Navigateur introuvable. Installez Google Chrome ou Microsoft Edge.
    pause
    exit /b 1
)

start "" "%CHROME%" ^
    --kiosk ^
    --noerrdialogs ^
    --disable-infobars ^
    --disable-session-crashed-bubble ^
    --disable-translate ^
    --no-first-run ^
    --disable-features=TranslateUI ^
    --disable-pinch ^
    --overscroll-history-navigation=0 ^
    "%VDM_URL%"
