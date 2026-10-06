# VdM Intranet — Kiosque Linux

## Navigateur utilisé

L'installation détecte automatiquement le navigateur présent sur le poste et
s'adapte à celui-ci, par ordre de préférence :

1. **Google Chrome**
2. **Microsoft Edge**
3. **Brave Browser**
4. **Chromium** (paquet de la distribution, ou snap sur Ubuntu)
5. **Firefox** (paquet Mozilla, de la distribution, ou snap sur Ubuntu)

Seul le **premier trouvé** dans cet ordre est configuré. Contrairement au kit
macOS, le navigateur retenu est **mémorisé** à l'installation : installer
plus tard un navigateur « prioritaire » ne le fait pas lancer à la place de
celui qui a reçu la politique de verrouillage (repli sur une nouvelle
détection uniquement si le navigateur installé a disparu).

Les navigateurs **Flatpak ne sont pas pris en charge** (voir plus bas).

Distributions visées : Ubuntu, Debian, Linux Mint, Fedora et dérivées, avec
un bureau compatible avec le démarrage automatique XDG (GNOME, KDE Plasma,
Xfce, Cinnamon, MATE).

## Contenu du dossier

- `installer-demarrage.sh` — installation complète en une fois : détecte le
  navigateur, installe le lanceur dans `/opt/vdm-intranet/`, applique la
  politique de verrouillage dans le dossier exact attendu par ce navigateur,
  puis configure le démarrage automatique en vrai mode kiosque à l'ouverture
  de session.
- `kiosk-vdm.sh` — lanceur exécuté à chaque ouverture de session : attend que
  le réseau/serveur réponde, puis ouvre le navigateur en mode kiosque
  (`--kiosk` pour la famille Chromium, `-kiosk` pour Firefox).
- `vdm-browser-detect.sh` — détection du navigateur et **référence unique des
  dossiers de politique** par navigateur et par mode de paquetage.
- `chromium-policy.json` — politique de verrouillage pour la famille
  Chromium (mêmes clés que `chromium-policy.plist` côté macOS et
  `chromium-policy.reg` côté Windows).
- `firefox-policies.json` — politique de verrouillage pour Firefox (identique
  au kit macOS).
- `vdm-intranet-kiosk.desktop` — modèle de l'entrée de démarrage automatique
  XDG, copié dans `~/.config/autostart/`.
- `desinstaller.sh` — retire tout ce que `installer-demarrage.sh` a mis en
  place, à partir de la liste exacte des fichiers posés.

## Procédure d'installation

1. Copier ce dossier sur le poste kiosque (clé USB ou partage réseau).
2. **Ouvrir la session de l'utilisateur du kiosque** (celui qui verra
   l'intranet au démarrage), ouvrir un terminal dans le dossier, puis :
   ```
   bash installer-demarrage.sh
   ```
   **Sans `sudo`** : le script le refuse (voir plus bas) et demande lui-même
   le mot de passe administrateur pour les étapes système. Aucun paramètre
   requis : l'URL de prod (`https://intranet.veilleurdesmedias.org`) est
   appliquée automatiquement.
3. Vérifier que la politique est bien prise en compte : ouvrir
   `chrome://policy` (Chrome, Edge, Brave, Chromium) ou `about:policies`
   (Firefox) — les règles doivent y figurer avec le statut « OK » / « Actif ».
4. Fermer puis rouvrir la session pour vérifier le démarrage automatique.

Pour un poste qui doit pointer ailleurs (cas particulier) :

```
bash installer-demarrage.sh https://autre-adresse
```

En cas de problème au démarrage, le lanceur écrit son journal dans
`~/.local/state/vdm-intranet/kiosk.log`.

## Ce qui est installé, et où

| Élément                     | Emplacement                                        |
| --------------------------- | -------------------------------------------------- |
| Lanceur + détection         | `/opt/vdm-intranet/`                               |
| URL + navigateur retenu     | `/opt/vdm-intranet/kiosk.conf`                     |
| Liste des politiques posées | `/opt/vdm-intranet/policy-files.txt`               |
| Démarrage automatique       | `~/.config/autostart/vdm-intranet-kiosk.desktop`   |
| Politique Google Chrome     | `/etc/opt/chrome/policies/managed/`                |
| Politique Microsoft Edge    | `/etc/opt/edge/policies/managed/`                  |
| Politique Brave             | `/etc/brave/policies/managed/`                     |
| Politique Chromium          | `/etc/chromium/…` **et** `/etc/chromium-browser/…` |
| Politique Firefox           | `/etc/firefox/policies/` (+ `distribution/`)       |

## ⚠️ Pièges évités (retours d'expérience macOS/Windows)

### Politique posée au mauvais endroit = ignorée sans erreur

Sur macOS, la politique Chromium était posée directement sous
`Managed Preferences/` au lieu du sous-dossier par utilisateur : le
navigateur l'ignorait **sans aucun message**. Linux a le même comportement
silencieux, avec un dossier différent pour chaque éditeur et parfois selon le
mode de paquetage :

- **Chromium** lit `/etc/chromium/policies/managed/` sur Debian/Fedora, mais
  `/etc/chromium-browser/policies/managed/` sur Ubuntu (y compris le snap) :
  le script pose la politique **dans les deux**.
- **Firefox** lit `/etc/firefox/policies/policies.json` (builds Mozilla et
  snap Ubuntu) ; pour un build de distribution, le dossier `distribution/`
  situé à côté du vrai binaire est le mécanisme historique : le script pose
  **les deux** (sauf snap, en lecture seule). Une politique Firefox déjà
  présente est sauvegardée en `.avant-vdm` et restaurée à la désinstallation.

Tous les chemins sont centralisés dans `vdm-browser-detect.sh`, et
l'installeur affiche chaque fichier posé. La vérification par
`chrome://policy` / `about:policies` (étape 3) reste la seule preuve
définitive.

### Dossiers de politique illisibles (umask restrictif)

Sur un poste durci (umask `077`), `sudo mkdir -p` crée les dossiers
**parents** (`/etc/opt/chrome`, `/etc/opt/chrome/policies`...) en `700` :
illisibles par l'utilisateur, donc politique ignorée en silence. Toutes les
écritures système se font avec un umask `022` imposé, et l'installeur relit
chaque fichier **en tant qu'utilisateur du kiosque** avant de conclure.

### Lancement avec `sudo` = démarrage automatique installé pour root

Avec `sudo bash installer-demarrage.sh`, `~` désigne `/root` : l'entrée de
démarrage automatique finirait dans `/root/.config/autostart/` et ne se
déclencherait jamais. Les deux scripts refusent donc de tourner en root. Si
`~/.config` appartient à root (reste d'un ancien `sudo`), l'installeur
s'arrête **avant** toute étape système et indique la commande `chown` à
lancer.

### Fins de ligne Windows (CRLF)

Un kit édité ou zippé depuis un poste Windows peut contenir des fins de
ligne CRLF : bash échoue alors sur chaque ligne (`$'\r': command not found`).
`installer-demarrage.sh` et `desinstaller.sh` détectent ce cas dès leur
première instruction, réparent le dossier du kit et se relancent ; les
fichiers installés sont en plus systématiquement normalisés à la copie.

### Chemin d'installation sans espace

Le lanceur est installé dans `/opt/vdm-intranet/` (et non dans le dossier où
le kit a été copié, souvent `~/Téléchargements/...`) : ce chemin est écrit
tel quel dans la ligne `Exec=` de l'entrée de démarrage automatique, où un
espace ou un accent casserait le lancement sans message.

### Fenêtres parasites au démarrage

- **« Déverrouiller le trousseau »** (session ouverte automatiquement sans
  mot de passe) : évitée avec `--password-store=basic`.
- **« Restaurer les pages ? »** après une coupure de courant : la dernière
  session est marquée comme fermée proprement avant chaque lancement.
- **Réseau pas encore prêt** : le lanceur attend jusqu'à 40 s que le serveur
  réponde (`curl`, ou `wget` si `curl` est absent, comme sur Ubuntu Desktop).

## ⚠️ Point d'attention : snap

Chromium et Firefox installés en snap (défaut sur Ubuntu) lisent bien
`/etc/chromium-browser/policies/managed/` et `/etc/firefox/policies/`. Pour
Brave en snap, la lecture de `/etc/brave/policies/managed/` n'est pas
garantie par le confinement : l'installeur le signale. Dans tous les cas,
**vérifier `chrome://policy` / `about:policies`** ; si la politique n'y
apparaît pas, installer la version `.deb`/`.rpm` officielle du navigateur et
relancer l'installation. Le mode kiosque lui-même fonctionne indépendamment
de la politique.

## ⚠️ Flatpak non pris en charge

Un navigateur Flatpak tourne dans un bac à sable qui ne voit pas les
dossiers de politique de l'hôte : la politique y serait ignorée sans erreur.
Si seule une version Flatpak est installée, l'installeur s'arrête avec un
message explicite. Installer la version `.deb`/`.rpm` (ou snap pour
Chromium/Firefox sur Ubuntu).

## ⚠️ Point d'attention : Firefox, verrouillage un peu moins strict

Comme sur Windows et macOS, **Firefox n'a pas d'équivalent direct au blocage
total des téléchargements** de `DownloadRestrictions` (Chrome/Edge/Brave) :
un fichier reste téléchargeable via le mode kiosque Firefox.

## Hors périmètre

La mise en veille de l'écran et le verrouillage automatique de session
relèvent des réglages du bureau (GNOME : Paramètres → Énergie /
Confidentialité) et ne sont pas modifiés par ce kit.

## Désinstallation

Depuis la session de l'utilisateur du kiosque, sans `sudo` :

```
bash desinstaller.sh
```
