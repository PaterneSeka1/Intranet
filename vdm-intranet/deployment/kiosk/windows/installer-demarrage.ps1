# VDM Intranet — Installation complète (Windows)
# Exécuter en Administrateur : clic droit → "Exécuter avec PowerShell"
# Usage (poste standard, aucun paramètre requis) : .\installer-demarrage.ps1
# Usage (URL différente, cas particulier) : .\installer-demarrage.ps1 -VdmUrl "https://autre-adresse"

param(
    # Par défaut : l'URL de prod réelle, pas "localhost" — un ancien défaut à
    # localhost:3000 avait déjà provoqué un déploiement silencieux pointant
    # vers une adresse inexistante sur le poste kiosque (page vide au
    # démarrage). -VdmUrl reste disponible pour surcharger ce défaut au
    # besoin, mais n'est plus requis pour un déploiement standard.
    [string]$VdmUrl = "https://intranet.veilleurdesmedias.org"
)

$ErrorActionPreference = "Stop"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path

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

# ── 1. Politique Chrome (verrouillage : devtools, incognito, impression,
#       téléchargements, historique, gestionnaire de mots de passe...) ──
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

# Chrome en vrai mode kiosque (verrouillé, plein écran, sans barre
# d'adresse) à chaque démarrage — mêmes options que vdm-kiosk.bat.
# Ne dépend plus d'une PWA installée au préalable (l'ancienne version
# cherchait une PWA via son icône dans le profil Chrome pour l'ouvrir par
# --app-id : fragile, et inutile ici puisque --kiosk fonctionne directement
# sur l'URL sans PWA installée).
$LaunchScript = @"
`$VdmUrl = "$VdmUrl"
`$Chrome = "$Chrome"

Start-Sleep -Seconds 8

Start-Process `$Chrome "--kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-translate --no-first-run --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 `$VdmUrl"
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
Write-Host "  1. À chaque démarrage de l'ordinateur → Chrome s'ouvre en mode kiosque"
Write-Host "     (plein écran verrouillé, sans barre d'adresse) sur $VdmUrl"
Write-Host "  2. Aucune interaction utilisateur requise"
Write-Host ""
Write-Host "  → Redémarrez l'ordinateur pour tester."
