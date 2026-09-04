# VDM Intranet — Installation complète (Windows)
# Exécuter en Administrateur : clic droit → "Exécuter avec PowerShell"
# Usage : .\installer-demarrage.ps1 -VdmUrl "http://192.168.1.10:3000"

param(
    [string]$VdmUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppName    = "VDM Intranet"

# Débloquer les fichiers du dossier (chrome-policy.reg, vdm-kiosk.bat) si ce
# script a été copié/téléchargé depuis Internet ou un partage réseau : ces
# fichiers portent alors la marque "Internet" (Zone.Identifier) et le
# Contrôle intelligent des applications de Windows 11 les bloque à
# l'exécution ("Ce fichier a été bloqué, car les fichiers de ce type
# provenant d'Internet peuvent être dangereux"). Voir le README du dossier.
Get-ChildItem -Path $ScriptDir -File -ErrorAction SilentlyContinue |
    Unblock-File -ErrorAction SilentlyContinue

Write-Host "╔══════════════════════════════════════════╗"
Write-Host "║   VDM Intranet — Installation kiosque   ║"
Write-Host "╚══════════════════════════════════════════╝"
Write-Host "  URL : $VdmUrl"
Write-Host ""

# ── 1. Politique Chrome (installation silencieuse de la PWA) ─────
Write-Host "→ [1/3] Application de la politique Chrome..."
$RegFile = Join-Path $ScriptDir "chrome-policy.reg"
(Get-Content $RegFile) -replace "http://localhost:3000", $VdmUrl |
    Set-Content "$env:TEMP\chrome-policy-vdm.reg"
reg import "$env:TEMP\chrome-policy-vdm.reg" 2>&1 | Out-Null
Remove-Item "$env:TEMP\chrome-policy-vdm.reg" -Force

# ── 2. Trouver Chrome ─────────────────────────────────────────────
Write-Host "→ [2/3] Localisation de Chrome..."
$ChromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
$Chrome = $ChromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $Chrome) {
    Write-Error "Google Chrome introuvable. Installez Chrome et relancez."
    exit 1
}

# ── 3. Démarrage automatique ──────────────────────────────────────
Write-Host "→ [3/3] Configuration du démarrage automatique..."

# Script PowerShell qui ouvre la PWA installée (ou Chrome en mode app en secours)
$LaunchScript = @"
`$AppName = "$AppName"
`$VdmUrl  = "$VdmUrl"
`$Chrome  = "$Chrome"

# Chercher la PWA installée dans le profil Chrome
`$ProfileBase = "`$env:LOCALAPPDATA\Google\Chrome\User Data"
`$PwaApp = Get-ChildItem "`$ProfileBase\Default\Web Applications\*" -Recurse `
    -Filter "*.ico" -ErrorAction SilentlyContinue |
    Where-Object { `$_.DirectoryName -match "VDM" } |
    Select-Object -First 1

`$AppId = if (`$PwaApp) { Split-Path (Split-Path `$PwaApp.FullName -Parent) -Leaf } else { `$null }

Start-Sleep -Seconds 8

if (`$AppId) {
    Start-Process `$Chrome "--app-id=`$AppId"
} else {
    # PWA pas encore installée → Chrome avec mode app (la politique l'installera)
    Start-Process `$Chrome "--app=`$VdmUrl --start-fullscreen --no-first-run"
}
"@

$LaunchFile = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\vdm-launch.ps1"
$LaunchScript | Set-Content $LaunchFile

# Raccourci dans Démarrage qui exécute le script PowerShell
$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath  = Join-Path $StartupFolder "VDM Intranet.lnk"
$WScript  = New-Object -ComObject WScript.Shell
$Shortcut = $WScript.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = "powershell.exe"
$Shortcut.Arguments        = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$LaunchFile`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.WindowStyle      = 7
$Shortcut.Description      = "VDM Intranet — Portail Veilleur des Médias"
$Shortcut.Save()

Write-Host ""
Write-Host "✓ Installation terminée."
Write-Host ""
Write-Host "  Ce qui va se passer :"
Write-Host "  1. Au prochain démarrage de Chrome → la PWA s'installe seule"
Write-Host "  2. À chaque démarrage de l'ordinateur → la PWA s'ouvre automatiquement"
Write-Host "  3. Aucune interaction utilisateur requise"
Write-Host ""
Write-Host "  → Redémarrez l'ordinateur pour tester."
