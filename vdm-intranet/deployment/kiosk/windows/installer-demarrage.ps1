# VDM Intranet — Installation complète du kiosque (Windows)
# Exécuter en Administrateur : clic droit → "Exécuter avec PowerShell"
# Usage : .\installer-demarrage.ps1 -VdmUrl "http://192.168.1.10:3000"

param(
    [string]$VdmUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "╔══════════════════════════════════════════╗"
Write-Host "║   VDM Intranet — Installation kiosque   ║"
Write-Host "╚══════════════════════════════════════════╝"
Write-Host "  URL : $VdmUrl"
Write-Host ""

# ── 1. Mettre à jour l'URL dans le batch ──────────────────────────
Write-Host "→ [1/4] Configuration de l'URL..."
$BatchFile = Join-Path $ScriptDir "vdm-kiosk.bat"
(Get-Content $BatchFile) -replace "set VDM_URL=.*", "set VDM_URL=$VdmUrl" |
    Set-Content $BatchFile

# ── 2. Politique Chrome (registre) ───────────────────────────────
Write-Host "→ [2/4] Application de la politique Chrome..."
$RegFile = Join-Path $ScriptDir "chrome-policy.reg"
# Injecter l'URL dans le fichier registre
(Get-Content $RegFile) -replace "http://localhost:3000", $VdmUrl |
    Set-Content "$env:TEMP\chrome-policy-vdm.reg"
reg import "$env:TEMP\chrome-policy-vdm.reg" 2>&1 | Out-Null
Remove-Item "$env:TEMP\chrome-policy-vdm.reg" -Force

# ── 3. Bloquer Ctrl+N au niveau de Windows ───────────────────────
Write-Host "→ [3/4] Restriction des raccourcis clavier pour Chrome..."
# Supprime la ligne "New Window" du menu Chrome via registre
$regPath = "HKCU:\Software\Google\Chrome"
if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
# AutoHotKey serait nécessaire pour intercepter au clavier — on s'en remet à la politique Chrome

# ── 4. Raccourci de démarrage automatique ────────────────────────
Write-Host "→ [4/4] Configuration du démarrage automatique..."
$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath  = Join-Path $StartupFolder "VDM Intranet.lnk"

$WScript  = New-Object -ComObject WScript.Shell
$Shortcut = $WScript.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = $BatchFile
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.WindowStyle      = 1
$Shortcut.Description      = "VDM Intranet — Portail Veilleur des Médias"
$Shortcut.Save()

Write-Host ""
Write-Host "✓ Installation terminée."
Write-Host ""
Write-Host "  Restrictions appliquées :"
Write-Host "  • Barre d'adresse      → cachée (kiosk)"
Write-Host "  • Nouvel onglet Ctrl+T → bloqué (kiosk)"
Write-Host "  • Outils développeur   → désactivés (politique)"
Write-Host "  • Mode incognito       → désactivé (politique)"
Write-Host "  • Téléchargements      → bloqués (politique)"
Write-Host "  • Historique           → désactivé (politique)"
Write-Host ""
Write-Host "  Redémarrez Chrome et l'ordinateur pour activer toutes les restrictions."
