@echo off
:: VDM Intranet — Lancement en mode kiosque (Windows)
:: Remplacez l'URL ci-dessous si ce poste ne doit pas pointer vers la prod
:: Détecte automatiquement le navigateur installé (Chrome > Edge > Brave >
:: Firefox). Lanceur manuel simple — pour un déploiement avec politique de
:: verrouillage + démarrage automatique, utiliser installer-demarrage.ps1.

set VDM_URL=https://intranet.veilleurdesmedias.org

:: Attendre 10 secondes que le réseau soit prêt
timeout /t 10 /nobreak > nul

:: Chercher un navigateur pris en charge, par ordre de préférence
set "BROWSER="
set "FAMILY="

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
    set "FAMILY=chromium"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    set "FAMILY=chromium"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    set "FAMILY=chromium"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    set "FAMILY=chromium"
) else if exist "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
    set "FAMILY=chromium"
) else if exist "C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BROWSER=C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe"
    set "FAMILY=chromium"
) else if exist "C:\Program Files\Mozilla Firefox\firefox.exe" (
    set "BROWSER=C:\Program Files\Mozilla Firefox\firefox.exe"
    set "FAMILY=firefox"
) else if exist "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" (
    set "BROWSER=C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
    set "FAMILY=firefox"
) else (
    echo Navigateur introuvable. Installez Google Chrome, Microsoft Edge, Brave ou Firefox.
    pause
    exit /b 1
)

if "%FAMILY%"=="firefox" (
    start "" "%BROWSER%" -kiosk "%VDM_URL%"
) else (
    start "" "%BROWSER%" ^
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
)
