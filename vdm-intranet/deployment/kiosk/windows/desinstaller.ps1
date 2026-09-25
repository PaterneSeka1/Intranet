# VdM Intranet — Désinstallation complète du kiosque (Windows)
# Exécuter en Administrateur : clic droit → "Exécuter avec PowerShell"
#
# Retire tout ce que installer-demarrage.ps1 a mis en place :
#   - le raccourci et le script qui ouvrent le navigateur à chaque démarrage,
#   - la politique de verrouillage du navigateur détecté à l'installation
#     (registre pour Chrome/Edge/Brave, policies.json pour Firefox — lu dans
#     vdm-kiosk-state.json).
# Ne désinstalle pas le navigateur lui-même.

$ErrorActionPreference = "Stop"

$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = New-Object Security.Principal.WindowsPrincipal($CurrentUser)
$IsAdmin = $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
    Write-Warning "Ce script doit être exécuté en Administrateur (clic droit -> Exécuter avec PowerShell)."
    exit 1
}

$StartupFolder = [Environment]::GetFolderPath("Startup")
$StateFile = Join-Path $StartupFolder "vdm-kiosk-state.json"

Write-Host "→ Suppression du démarrage automatique..."
Remove-Item (Join-Path $StartupFolder "VdM Intranet.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $StartupFolder "vdm-launch.ps1") -Force -ErrorAction SilentlyContinue

Write-Host "→ Suppression de la politique de verrouillage..."

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

if (Test-Path $StateFile) {
    $State = Get-Content $StateFile -Raw | ConvertFrom-Json

    if ($State.Family -eq "Chromium" -and $State.RegistryKey) {
        $PolicyKey = "HKLM:\$($State.RegistryKey)"
        if (Test-Path $PolicyKey) {
            foreach ($Name in $PolicyValues) {
                Remove-ItemProperty -Path $PolicyKey -Name $Name -ErrorAction SilentlyContinue
            }
            $Remaining = Get-Item -Path $PolicyKey
            if ($Remaining.ValueCount -eq 0 -and $Remaining.SubKeyCount -eq 0) {
                Remove-Item -Path $PolicyKey -Force
            }
        }
    }
    elseif ($State.Family -eq "Firefox" -and $State.FirefoxDistDir) {
        Remove-Item (Join-Path $State.FirefoxDistDir "policies.json") -Force -ErrorAction SilentlyContinue
        # Ne retirer le dossier "distribution" que s'il est vide (ne pas
        # toucher à une distribution Firefox tierce qui l'utiliserait déjà).
        if ((Test-Path $State.FirefoxDistDir) -and
            ((Get-ChildItem $State.FirefoxDistDir -Force | Measure-Object).Count -eq 0)) {
            Remove-Item $State.FirefoxDistDir -Force -ErrorAction SilentlyContinue
        }
    }

    Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
}
else {
    # Poste installé avec une version antérieure à la prise en charge
    # multi-navigateurs (pas de fichier d'état) : on suppose l'ancien
    # comportement Chrome-only.
    Write-Host "  (aucun fichier d'état trouvé — nettoyage Chrome par défaut)"
    $PolicyKey = "HKLM:\SOFTWARE\Policies\Google\Chrome"
    if (Test-Path $PolicyKey) {
        foreach ($Name in $PolicyValues) {
            Remove-ItemProperty -Path $PolicyKey -Name $Name -ErrorAction SilentlyContinue
        }
        $Remaining = Get-Item -Path $PolicyKey
        if ($Remaining.ValueCount -eq 0 -and $Remaining.SubKeyCount -eq 0) {
            Remove-Item -Path $PolicyKey -Force
        }
    }
}

Write-Host ""
Write-Host "✓ Désinstallation terminée. Redémarrez le navigateur."
Write-Host ""
Write-Host "  Note : le navigateur (PWA éventuelle incluse) reste installé."
