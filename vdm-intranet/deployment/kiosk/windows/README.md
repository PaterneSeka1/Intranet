# VDM Intranet — Kiosque Windows

## Contenu du dossier

- `installer-demarrage.ps1` — installation complète en une fois : applique la
  politique Chrome (`chrome-policy.reg`) puis configure le démarrage
  automatique de la PWA à l'ouverture de session.
- `chrome-policy.reg` — politique Chrome permettant l'installation silencieuse
  de la PWA VDM Intranet.
- `vdm-kiosk.bat` — lanceur alternatif en mode kiosque plein écran (Chrome ou
  Edge), à utiliser directement si l'installation automatique n'est pas
  souhaitée.
- `desinstaller.ps1` — retire tout ce que `installer-demarrage.ps1` a mis en
  place (démarrage automatique + politique Chrome). La PWA elle-même reste
  installée dans Chrome (à désinstaller séparément depuis `chrome://apps` si
  besoin).

## Procédure d'installation

1. Copier ce dossier sur le poste kiosque.
2. Clic droit sur `installer-demarrage.ps1` → **Exécuter avec PowerShell**
   (en Administrateur).
3. Redémarrer le poste pour vérifier le démarrage automatique.

```
.\installer-demarrage.ps1 -VdmUrl "http://192.168.1.10:3000"
```

## Désinstallation

Clic droit sur `desinstaller.ps1` → **Exécuter avec PowerShell** (en
Administrateur), ou :

```
.\desinstaller.ps1
```

## ⚠️ Piège connu : « Contrôle intelligent des applications » bloque les fichiers

**Symptôme** : le démarrage automatique ne se met pas en place (ou
`installer-demarrage.ps1` refuse de s'exécuter) et Windows affiche :

> **Contrôle intelligent des applications a bloqué un fichier potentiellement
> dangereux**
> Ce fichier a été bloqué, car les fichiers de ce type provenant d'Internet
> peuvent être dangereux.

**Cause** : le *Contrôle intelligent des applications* (Smart App Control,
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
marque « Internet ».

**Dernier recours**, réservé à des postes kiosques dédiés (décision DSI —
irréversible sans réinstallation complète de Windows) : désactiver le
Contrôle intelligent des applications via *Sécurité Windows → Contrôle des
applications et du navigateur → Contrôle intelligent des applications →
Désactivé*.
