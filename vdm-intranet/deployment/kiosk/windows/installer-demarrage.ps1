# VdM Intranet — Installation complète (Windows)
# Exécuter en Administrateur : clic droit → "Exécuter avec PowerShell"
# Usage (poste standard, aucun paramètre requis) : .\installer-demarrage.ps1
# Usage (URL différente, cas particulier) : .\installer-demarrage.ps1 -VdmUrl "https://autre-adresse"
#
# Détecte automatiquement le navigateur installé (Chrome > Edge > Brave >
# Firefox, dans cet ordre de préférence) et applique la politique de
# verrouillage adaptée à celui-ci — voir Find-VdmBrowser plus bas et le
# README pour le détail par navigateur.

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

$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = New-Object Security.Principal.WindowsPrincipal($CurrentUser)
if (-not $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Ce script doit être exécuté en Administrateur (clic droit -> Exécuter avec PowerShell)."
    exit 1
}

# Débloquer les fichiers du dossier (chromium-policy.reg, vdm-kiosk.bat) si ce
# script a été copié/téléchargé depuis Internet ou un partage réseau : ces
# fichiers portent alors la marque "Internet" (Zone.Identifier) et le
# Contrôle intelligent des applications de Windows 11 les bloque à
# l'exécution ("Ce fichier a été bloqué, car les fichiers de ce type
# provenant d'Internet peuvent être dangereux"). Voir le README du dossier.
Get-ChildItem -Path $ScriptDir -File -ErrorAction SilentlyContinue |
    Unblock-File -ErrorAction SilentlyContinue

Write-Host "╔══════════════════════════════════════════╗"
Write-Host "║   VdM Intranet — Installation kiosque   ║"
Write-Host "╚══════════════════════════════════════════╝"
Write-Host "  URL : $VdmUrl"
Write-Host ""

# ── Détection du navigateur ────────────────────────────────────────
# Liste ordonnée par préférence : le PREMIER trouvé est utilisé. Chrome,
# Edge et Brave partagent le même moteur (Chromium) et le même schéma de
# politique d'entreprise (seule la clé de registre change) ; Firefox a son
# propre mécanisme (policies.json), avec quelques restrictions en moins
# (voir README).
function Find-VdmBrowser {
    $candidates = @(
        @{ Name = "Google Chrome";  Family = "Chromium"; Path = "C:\Program Files\Google\Chrome\Application\chrome.exe";                    RegistryKey = "SOFTWARE\Policies\Google\Chrome" },
        @{ Name = "Google Chrome";  Family = "Chromium"; Path = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";              RegistryKey = "SOFTWARE\Policies\Google\Chrome" },
        @{ Name = "Microsoft Edge"; Family = "Chromium"; Path = "C:\Program Files\Microsoft\Edge\Application\msedge.exe";                   RegistryKey = "SOFTWARE\Policies\Microsoft\Edge" },
        @{ Name = "Microsoft Edge"; Family = "Chromium"; Path = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";             RegistryKey = "SOFTWARE\Policies\Microsoft\Edge" },
        @{ Name = "Brave Browser";  Family = "Chromium"; Path = "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe";       RegistryKey = "SOFTWARE\Policies\BraveSoftware\Brave" },
        @{ Name = "Brave Browser";  Family = "Chromium"; Path = "C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe"; RegistryKey = "SOFTWARE\Policies\BraveSoftware\Brave" },
        @{ Name = "Firefox";        Family = "Firefox";  Path = "C:\Program Files\Mozilla Firefox\firefox.exe";                             RegistryKey = $null },
        @{ Name = "Firefox";        Family = "Firefox";  Path = "C:\Program Files (x86)\Mozilla Firefox\firefox.exe";                       RegistryKey = $null }
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate.Path) { return $candidate }
    }
    return $null
}

Write-Host "→ [1/3] Détection du navigateur..."
$Browser = Find-VdmBrowser
if (-not $Browser) {
    Write-Error "Aucun navigateur pris en charge trouvé (Chrome, Edge, Brave, Firefox). Installez-en un et relancez."
    exit 1
}
Write-Host "  Navigateur détecté : $($Browser.Name) ($($Browser.Family))"
Write-Host ""

# ── Politique de verrouillage ──────────────────────────────────────
Write-Host "→ [2/3] Application de la politique de verrouillage..."

if ($Browser.Family -eq "Chromium") {
    $RegFile = Join-Path $ScriptDir "chromium-policy.reg"
    $RegContent = Get-Content $RegFile -Raw
    # .Replace() = remplacement littéral, PAS une regex : la clé de registre
    # contient des antislashs ("SOFTWARE\Policies\..."), et l'opérateur
    # -replace de PowerShell les interprète comme une regex .NET où "\P"
    # (backslash suivi de "P", comme dans "\Policies") lève une erreur de
    # parsing ("Unrecognized escape sequence \P") — piège découvert en
    # écrivant ce script, jamais déclenché avant faute de substitution
    # dynamique de la clé de registre.
    $RegContent = $RegContent.Replace("http://localhost:3000", $VdmUrl)
    if ($Browser.RegistryKey -ne "SOFTWARE\Policies\Google\Chrome") {
        $RegContent = $RegContent.Replace("SOFTWARE\Policies\Google\Chrome", $Browser.RegistryKey)
    }
    $TempReg = "$env:TEMP\vdm-policy.reg"
    $RegContent | Set-Content $TempReg
    reg import $TempReg 2>&1 | Out-Null
    Remove-Item $TempReg -Force
}
else {
    # Firefox n'utilise pas le registre : la politique se pose dans un
    # fichier policies.json à l'intérieur même du dossier d'installation
    # (voir README pour les limites par rapport à la famille Chromium —
    # notamment le blocage des téléchargements, moins strict).
    $FirefoxDir = Split-Path -Parent $Browser.Path
    $DistDir = Join-Path $FirefoxDir "distribution"
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    $PolicyFile = Join-Path $ScriptDir "firefox-policies.json"
    (Get-Content $PolicyFile -Raw).Replace("http://localhost:3000", $VdmUrl) |
        Set-Content (Join-Path $DistDir "policies.json")
}

# ── Démarrage automatique ──────────────────────────────────────────
Write-Host "→ [3/3] Configuration du démarrage automatique..."

# Navigateur en vrai mode kiosque (verrouillé, plein écran, sans barre
# d'adresse) à chaque démarrage. Ne dépend d'aucune PWA installée au
# préalable.
if ($Browser.Family -eq "Chromium") {
    $LaunchScript = @"
`$VdmUrl = "$VdmUrl"
`$Browser = "$($Browser.Path)"

Start-Sleep -Seconds 8

Start-Process `$Browser "--kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-translate --no-first-run --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 `$VdmUrl"
"@
}
else {
    # Firefox : mode kiosque via -kiosk uniquement — les options
    # --noerrdialogs/--disable-infobars/... de la famille Chromium n'ont pas
    # d'équivalent en ligne de commande côté Firefox (voir README).
    $LaunchScript = @"
`$VdmUrl = "$VdmUrl"
`$Browser = "$($Browser.Path)"

Start-Sleep -Seconds 8

Start-Process `$Browser "-kiosk `$VdmUrl"
"@
}

$StartupFolder = [Environment]::GetFolderPath("Startup")
$LaunchFile = Join-Path $StartupFolder "vdm-launch.ps1"
$LaunchScript | Set-Content $LaunchFile

# État d'installation (lu par desinstaller.ps1 pour un nettoyage précis de la
# politique correspondant au navigateur réellement détecté).
$StateFile = Join-Path $StartupFolder "vdm-kiosk-state.json"
# $DistDir n'est renseigné que dans la branche Firefox ci-dessus ($null sinon
# — une variable non assignée vaut $null en PowerShell, sans erreur).
@{
    Family         = $Browser.Family
    Name           = $Browser.Name
    RegistryKey    = $Browser.RegistryKey
    FirefoxDistDir = $DistDir
} | ConvertTo-Json | Set-Content $StateFile

# Raccourci dans Démarrage qui exécute le script PowerShell
$ShortcutPath  = Join-Path $StartupFolder "VdM Intranet.lnk"
$WScript  = New-Object -ComObject WScript.Shell
$Shortcut = $WScript.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = "powershell.exe"
$Shortcut.Arguments        = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$LaunchFile`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.WindowStyle      = 7
$Shortcut.Description      = "VdM Intranet — Veilleur des Médias"
$Shortcut.Save()

Write-Host ""
Write-Host "✓ Installation terminée."
Write-Host ""
Write-Host "  Ce qui va se passer :"
Write-Host "  1. À chaque démarrage de l'ordinateur → $($Browser.Name) s'ouvre en mode kiosque"
Write-Host "     (plein écran verrouillé, sans barre d'adresse) sur $VdmUrl"
Write-Host "  2. Aucune interaction utilisateur requise"
Write-Host ""
if ($Browser.Family -eq "Firefox") {
    Write-Host "  Note : le blocage des téléchargements est moins strict sur Firefox"
    Write-Host "  que sur Chrome/Edge/Brave (voir README)."
    Write-Host ""
}
Write-Host "  → Redémarrez l'ordinateur pour tester."
