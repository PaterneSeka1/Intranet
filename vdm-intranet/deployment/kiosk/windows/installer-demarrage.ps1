# VDM Intranet — Installation du démarrage automatique (Windows)
# Exécuter en tant qu'Administrateur : clic droit → "Exécuter avec PowerShell"

param(
    [string]$VdmUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

# Chemin du script batch (dans le même dossier que ce script)
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$BatchFile  = Join-Path $ScriptDir "vdm-kiosk.bat"

if (-not (Test-Path $BatchFile)) {
    Write-Error "Fichier vdm-kiosk.bat introuvable dans $ScriptDir"
    exit 1
}

# Mettre à jour l'URL dans le batch
(Get-Content $BatchFile) -replace "set VDM_URL=.*", "set VDM_URL=$VdmUrl" |
    Set-Content $BatchFile

# Créer un raccourci dans le dossier Démarrage de l'utilisateur courant
$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath  = Join-Path $StartupFolder "VDM Intranet.lnk"

$WScript = New-Object -ComObject WScript.Shell
$Shortcut = $WScript.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = $BatchFile
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.WindowStyle      = 1
$Shortcut.Description      = "VDM Intranet — Portail Veilleur des Médias"
$Shortcut.Save()

Write-Host "✓ Raccourci créé : $ShortcutPath"
Write-Host "✓ URL configurée : $VdmUrl"
Write-Host ""
Write-Host "Le portail VDM s'ouvrira automatiquement à la prochaine session."
