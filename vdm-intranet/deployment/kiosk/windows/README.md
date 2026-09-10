# VDM Intranet — Kiosque Windows

## Contenu du dossier

- `installer-demarrage.ps1` — installation complète en une fois : applique la
  politique Chrome de verrouillage (`chrome-policy.reg`) puis configure le
  démarrage automatique en vrai mode kiosque (`--kiosk`, plein écran
  verrouillé) à l'ouverture de session.
- `chrome-policy.reg` — politique Chrome de verrouillage (devtools,
  incognito, impression, téléchargements, historique, gestionnaire de mots
  de passe...).
- `vdm-kiosk.bat` — lanceur alternatif en mode kiosque plein écran (Chrome ou
  Edge), à utiliser directement si l'installation automatique n'est pas
  souhaitée.
- `desinstaller.ps1` — retire tout ce que `installer-demarrage.ps1` a mis en
  place (démarrage automatique + politique Chrome).

## Téléchargement en ligne

Ce dossier est aussi distribué en `.zip` depuis le site (accès réservé aux
employés connectés — le middleware de l'intranet protège cette URL comme le
reste du site) :

```
https://intranet.veilleurdesmedias.org/downloads/vdm-kiosk-windows.zip
```

**À régénérer après toute modification d'un fichier de ce dossier** (le zip
n'est pas généré automatiquement) :

```bash
python3 -c "
import zipfile, os
src = 'deployment/kiosk/windows'
out = 'apps/web/public/downloads/vdm-kiosk-windows.zip'
files = ['README.md', 'chrome-policy.reg', 'desinstaller.ps1', 'installer-demarrage.ps1', 'vdm-kiosk.bat']
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(src, f), f)
"
```

## Procédure d'installation

1. Copier ce dossier sur le poste kiosque.
2. Clic droit sur `installer-demarrage.ps1` → **Exécuter avec PowerShell**
   (en Administrateur). Aucun paramètre requis : l'URL de prod
   (`https://intranet.veilleurdesmedias.org`) est appliquée automatiquement.
3. Redémarrer le poste pour vérifier le démarrage automatique.

Pour un poste qui doit pointer ailleurs (cas particulier), surcharger
l'URL par défaut :

```
.\installer-demarrage.ps1 -VdmUrl "https://autre-adresse"
```

## Désinstallation

Clic droit sur `desinstaller.ps1` → **Exécuter avec PowerShell** (en
Administrateur), ou :

```
.\desinstaller.ps1
```

## ⚠️ Piège connu (corrigé) : l'ancien défaut pointait sur « localhost »

**Symptôme observé avant correctif** : après installation, Chrome s'ouvre
bien à chaque redémarrage, mais affiche une page vide/inaccessible sur
`localhost`.

**Cause** : `-VdmUrl` avait `http://localhost:3000` comme valeur par défaut.
Lancer `installer-demarrage.ps1` sans préciser ce paramètre gravait cette
URL locale dans la politique Chrome **et** dans le script de démarrage
automatique — rien n'y répond sur le poste kiosque, d'où la page vide.
Corrigé : le défaut est maintenant l'URL de prod réelle
(`https://intranet.veilleurdesmedias.org`), donc une installation sans
paramètre fonctionne correctement. Si un poste a été installé avec
l'ancienne version du script (avant ce correctif), il faut nettoyer avant
de recommencer :

1. `.\desinstaller.ps1` (en Administrateur) — retire le raccourci de
   démarrage et la politique Chrome erronés.
2. Relancer l'installation (aucun paramètre requis désormais) :
   `.\installer-demarrage.ps1`.
3. Redémarrer le poste pour vérifier.

## ⚠️ Piège connu : « Contrôle intelligent des applications » bloque les fichiers

**Symptôme** : le démarrage automatique ne se met pas en place (ou
`installer-demarrage.ps1` refuse de s'exécuter) et Windows affiche :

> **Contrôle intelligent des applications a bloqué un fichier potentiellement
> dangereux**
> Ce fichier a été bloqué, car les fichiers de ce type provenant d'Internet
> peuvent être dangereux.

**Cause** : le _Contrôle intelligent des applications_ (Smart App Control,
Windows 11) bloque par défaut les fichiers `.ps1`, `.bat` et `.reg` non
signés dès qu'ils portent la marque « provient d'Internet » (flux
`Zone.Identifier`, ajoutée automatiquement par le navigateur ou par
Explorer/Teams/OneDrive lors d'un téléchargement ou d'un transfert réseau).
Le blocage porte sur le **type de fichier + sa provenance**, pas sur son
contenu — cela n'a donc rien à voir avec un bug de l'application. C'est aussi
pour cela que le problème n'apparaît qu'en prod : sur un poste de dev, ces
fichiers sont ouverts localement et ne portent jamais cette marque.

**Solution rapide** (à faire une fois, après avoir copié le dossier sur le
poste kiosque, avant toute exécution) :

- Soit clic droit sur le fichier bloqué → **Propriétés** → cocher
  **Débloquer** en bas de l'onglet Général → **OK** ;
- Soit en PowerShell (Administrateur), sur tout le dossier d'un coup :

  ```powershell
  Get-ChildItem -Path "chemin\vers\windows" -Recurse | Unblock-File
  ```

`installer-demarrage.ps1` débloque désormais automatiquement les fichiers du
dossier (`chrome-policy.reg`, `vdm-kiosk.bat`) à son lancement — mais s'il est
lui-même bloqué à l'exécution, il faut d'abord le débloquer manuellement
(ci-dessus) avant de pouvoir le lancer une première fois.

**Solution durable** (évite le blocage à la source) : transférer ce dossier
vers le poste kiosque par clé USB ou partage réseau local plutôt que de le
télécharger depuis un navigateur — ces fichiers ne reçoivent alors jamais la
marque « Internet ». Le téléchargement en ligne (section ci-dessus) est
plus pratique mais **déclenche systématiquement ce blocage** (le fichier
vient bien d'Internet) — prévoir le déblocage à chaque fois avec cette
méthode.

**Dernier recours**, réservé à des postes kiosques dédiés (décision DSI —
irréversible sans réinstallation complète de Windows) : désactiver le
Contrôle intelligent des applications via _Sécurité Windows → Contrôle des
applications et du navigateur → Contrôle intelligent des applications →
Désactivé_.
