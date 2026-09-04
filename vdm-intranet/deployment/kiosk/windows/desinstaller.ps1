# VDM Intranet — Désinstallation complète du kiosque (Windows)
# Exécuter en Administrateur : clic droit → "Exécuter avec PowerShell"
#
# Retire tout ce que installer-demarrage.ps1 a mis en place :
#   - le raccourci et le script qui ouvrent la PWA à chaque démarrage,
#   - la politique Chrome (installation forcée de la PWA + restrictions).
# La PWA elle-même reste installée dans Chrome (voir note finale) : ce script
# ne fait qu'arrêter le comportement "kiosque", pas désinstaller l'appli.

$ErrorActionPreference = "Stop"

$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = New-Object Security.Principal.WindowsPrincipal($CurrentUser)
$IsAdmin = $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
    Write-Warning "Ce script doit être exécuté en Administrateur (clic droit -> Exécuter avec PowerShell)."
    exit 1
}

Write-Host "→ Suppression du démarrage automatique..."
$StartupFolder = [Environment]::GetFolderPath("Startup")
Remove-Item (Join-Path $StartupFolder "VDM Intranet.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $StartupFolder "vdm-launch.ps1") -Force -ErrorAction SilentlyContinue

Write-Host "→ Suppression de la politique Chrome..."
$PolicyKey = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$PolicyValues = @(
    "WebAppInstallForceList",
    "WebAppSettings",
    "NewTabPageLocation",
    "DeveloperToolsAvailability",
    "IncognitoModeAvailability",
    "PrintingEnabled",
    "DownloadRestrictions",
    "BookmarkBarEnabled",
    "SavingBrowserHistoryDisabled",
    "PasswordManagerEnabled",
    "BrowserSettingsPageEnabled"
)

if (Test-Path $PolicyKey) {
    foreach ($Name in $PolicyValues) {
        Remove-ItemProperty -Path $PolicyKey -Name $Name -ErrorAction SilentlyContinue
    }

    # Si la clé ne contient plus rien (elle n'était utilisée que par VDM
    # Intranet), on la retire entièrement plutôt que de laisser une clé vide.
    $Remaining = Get-Item -Path $PolicyKey
    if ($Remaining.ValueCount -eq 0 -and $Remaining.SubKeyCount -eq 0) {
        Remove-Item -Path $PolicyKey -Force
    }
}

Write-Host ""
Write-Host "✓ Désinstallation terminée. Redémarrez Chrome."
Write-Host ""
Write-Host "  Note : la PWA VDM Intranet reste installée dans Chrome."
Write-Host "  Pour la retirer : chrome://apps -> clic droit sur l'icône -> Désinstaller."
