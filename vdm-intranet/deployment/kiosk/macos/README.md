# VDM Intranet — Kiosque macOS

## Contenu du dossier

- `installer-demarrage.sh` — installation complète en une fois : installe le
  lanceur (`kiosk-vdm.sh`), applique la politique Chrome de verrouillage
  (`chrome-policy.plist`), neutralise ⌘+N/⌘+Maj+N, puis configure le
  démarrage automatique en vrai mode kiosque (`--kiosk`, plein écran
  verrouillé) à l'ouverture de session (`com.vdm.intranet.plist`, LaunchAgent).
- `kiosk-vdm.sh` — lanceur exécuté à chaque ouverture de session : attend que
  le réseau/serveur réponde, puis ouvre Chrome en `--kiosk` sur l'URL.
- `chrome-policy.plist` — politique Chrome de verrouillage (devtools,
  incognito, impression, téléchargements, historique, gestionnaire de mots
  de passe...), équivalent macOS de `chrome-policy.reg` côté Windows.
- `com.vdm.intranet.plist` — modèle de LaunchAgent (copié avec l'URL injectée
  vers `~/Library/LaunchAgents/`).
- `desinstaller.sh` — retire tout ce que `installer-demarrage.sh` a mis en
  place (démarrage automatique + politique Chrome).

## Procédure d'installation

1. Copier ce dossier sur le Mac kiosque (clé USB/partage réseau de
   préférence — voir remarque Gatekeeper plus bas si transféré via
   navigateur).
2. Ouvrir Terminal, se placer dans le dossier, puis :
   ```
   bash installer-demarrage.sh
   ```
   Aucun paramètre requis : l'URL de prod
   (`https://intranet.veilleurdesmedias.org`) est appliquée automatiquement.
   Mot de passe administrateur demandé (`sudo`) pour les étapes système.
3. Redémarrer la session (ou l'ordinateur) pour vérifier le démarrage
   automatique.

Pour un poste qui doit pointer ailleurs (cas particulier), passer l'URL en
paramètre :

```
bash installer-demarrage.sh https://autre-adresse
```

## Désinstallation

```
bash desinstaller.sh
```

## ⚠️ Piège corrigé : l'ancien défaut pointait sur « localhost »

**Symptôme observé avant correctif** : après installation, Chrome s'ouvre à
l'ouverture de session mais affiche une page vide/inaccessible.

**Cause** : `installer-demarrage.sh` gravait `http://localhost:3000` (défaut
de l'ancienne version) dans la politique Chrome et le LaunchAgent dès qu'il
était lancé sans argument. Corrigé : le défaut est maintenant l'URL de prod
réelle. Un poste installé avec l'ancienne version doit être nettoyé avant de
recommencer :

1. `bash desinstaller.sh`
2. `bash installer-demarrage.sh` (aucun paramètre requis désormais)
3. Redémarrer la session pour vérifier.

## ⚠️ Piège corrigé : mode « kiosque » qui n'en était pas un

**Symptôme** : Chrome s'ouvrait bien automatiquement, mais dans une simple
fenêtre plein écran (`--app --start-fullscreen`) — le menu Chrome, les
raccourcis clavier standards et la possibilité de quitter restaient
accessibles, et l'ouverture dépendait d'une PWA installée au préalable via
la politique `WebAppInstallForceList`.

**Cause** : l'ancienne version de `kiosk-vdm.sh` attendait qu'une PWA soit
installée automatiquement (politique Chrome), l'ouvrait via `open` si
trouvée, ou repliait sur `--app` sinon. Cette installation forcée de PWA
dépend elle-même de la politique `Managed Preferences` (voir section
suivante) — si elle n'est pas honorée, la PWA n'est jamais installée et le
poste reste en mode fenêtre simple, jamais en vrai kiosque.

Corrigé : `kiosk-vdm.sh` lance désormais Chrome directement avec `--kiosk`
sur l'URL, sans dépendre d'aucune PWA ni d'aucune politique — mêmes options
que le kit Windows (`vdm-kiosk.bat`).

## ⚠️ Point d'attention : la politique Chrome (« Managed Preferences »)

Les restrictions (`chrome-policy.plist` : devtools, incognito, téléchargements,
historique...) passent par le mécanisme macOS *Managed Preferences*, qui
attend le fichier dans un **sous-dossier nommé par l'utilisateur** :

```
/Library/Managed Preferences/<utilisateur>/com.google.Chrome.plist
```

et non directement sous `Managed Preferences/` — un fichier posé au mauvais
endroit est silencieusement ignoré par Chrome (aucune erreur, les
restrictions ne s'appliquent simplement pas). `installer-demarrage.sh` utilise
désormais ce chemin.

Cela dit, ce mécanisme est historiquement conçu pour être alimenté par un
profil de configuration (MDM ou `profiles install`), pas par un fichier posé
directement par un script — sur des versions récentes de macOS, il est
possible qu'il reste ignoré même au bon endroit sans profil MDM réel derrière.
**Le mode kiosque (`--kiosk`) ne dépend pas de cette politique et fonctionne
dans tous les cas** ; si les restrictions elles-mêmes ne s'appliquent pas
après un redémarrage de Chrome, la solution durable est de livrer
`chrome-policy.plist` via un vrai profil de configuration (`.mobileconfig`,
installable avec `profiles install -type configuration -path ...` ou via un
MDM) plutôt que par ce script — non implémenté ici, à envisager si le besoin
se confirme sur un poste réel.

## ⚠️ Remarque Gatekeeper (transfert via navigateur)

Comme sur Windows (Contrôle intelligent des applications), un fichier
téléchargé depuis un navigateur porte une marque de quarantaine
(`com.apple.quarantine`). Exécuter ces scripts explicitement via
`bash installer-demarrage.sh` en Terminal n'est **pas** bloqué par
Gatekeeper (contrairement à un double-clic sur un `.command` téléchargé,
comme dans le flux self-service — voir
[PwaAutoStart.tsx](../../../apps/web/src/components/PwaAutoStart.tsx)).
Préférer malgré tout une clé USB/partage réseau local au téléchargement
navigateur pour éviter toute question.
