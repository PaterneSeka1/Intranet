# VDM Intranet — Kiosque macOS

## Navigateur utilisé

L'installation détecte automatiquement le navigateur présent sur le poste et
s'adapte à celui-ci, par ordre de préférence :

1. **Google Chrome**
2. **Microsoft Edge**
3. **Brave Browser**
4. **Chromium** (build open source)
5. **Firefox**
6. **Safari** — dernier recours uniquement (voir avertissement plus bas)

Seul le **premier trouvé** dans cet ordre est configuré (un poste kiosque
n'a besoin que d'un seul navigateur verrouillé). Pour imposer un navigateur
particulier, désinstaller/déplacer temporairement les autres avant de lancer
l'installation, ou installer uniquement celui souhaité sur le poste.

Chrome, Edge, Brave et Chromium partagent le même moteur et le même schéma
de politique d'entreprise (« famille Chromium ») : verrouillage complet
identique quel que soit celui détecté. Firefox a son propre mécanisme, avec
quelques restrictions en moins (voir plus bas). Safari n'offre aucun
verrouillage réel sans MDM.

## Contenu du dossier

- `installer-demarrage.sh` — installation complète en une fois : détecte le
  navigateur, installe le lanceur (`kiosk-vdm.sh` + `vdm-browser-detect.sh`),
  applique la politique de verrouillage adaptée, puis configure le démarrage
  automatique en vrai mode kiosque à l'ouverture de session
  (`com.vdm.intranet.plist`, LaunchAgent).
- `kiosk-vdm.sh` — lanceur exécuté à chaque ouverture de session : attend que
  le réseau/serveur réponde, détecte le navigateur (même logique qu'à
  l'installation) et l'ouvre en mode kiosque.
- `vdm-browser-detect.sh` — détection du navigateur installé, partagée entre
  `installer-demarrage.sh` et `kiosk-vdm.sh` (évite que les deux se
  désynchronisent).
- `chromium-policy.plist` — politique de verrouillage pour la famille
  Chromium (devtools, incognito, impression, téléchargements, historique,
  gestionnaire de mots de passe...), équivalent macOS de `chromium-policy.reg`
  côté Windows. Le même fichier sert pour Chrome, Edge, Brave et Chromium :
  seul le nom du fichier de destination change selon l'éditeur détecté.
- `firefox-policies.json` — politique de verrouillage pour Firefox (mécanisme
  et clés différents de la famille Chromium — voir plus bas).
- `com.vdm.intranet.plist` — modèle de LaunchAgent (copié avec l'URL injectée
  vers `~/Library/LaunchAgents/`).
- `desinstaller.sh` — retire tout ce que `installer-demarrage.sh` a mis en
  place (démarrage automatique + politique du navigateur détecté).

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

**Symptôme observé avant correctif** : après installation, le navigateur
s'ouvre à l'ouverture de session mais affiche une page vide/inaccessible.

**Cause** : `installer-demarrage.sh` gravait `http://localhost:3000` (défaut
de l'ancienne version) dans la politique du navigateur et le LaunchAgent dès
qu'il était lancé sans argument. Corrigé : le défaut est maintenant l'URL de
prod réelle. Un poste installé avec l'ancienne version doit être nettoyé
avant de recommencer :

1. `bash desinstaller.sh`
2. `bash installer-demarrage.sh` (aucun paramètre requis désormais)
3. Redémarrer la session pour vérifier.

## ⚠️ Piège corrigé : mode « kiosque » qui n'en était pas un

**Symptôme** : le navigateur s'ouvrait bien automatiquement, mais dans une
simple fenêtre plein écran (`--app --start-fullscreen`) — le menu, les
raccourcis clavier standards et la possibilité de quitter restaient
accessibles, et l'ouverture dépendait d'une PWA installée au préalable via
la politique `WebAppInstallForceList`.

Corrigé : `kiosk-vdm.sh` lance désormais directement le mode kiosque natif du
navigateur détecté (`--kiosk` pour la famille Chromium, `-kiosk` pour
Firefox), sans dépendre d'aucune PWA ni politique préalable.

## ⚠️ Point d'attention : la politique Chromium (« Managed Preferences »)

Les restrictions (`chromium-policy.plist` : devtools, incognito,
téléchargements, historique...) passent par le mécanisme macOS *Managed
Preferences*, qui attend le fichier dans un **sous-dossier nommé par
l'utilisateur** :

```
/Library/Managed Preferences/<utilisateur>/<domaine>.plist
```

(`<domaine>` = `com.google.Chrome`, `com.microsoft.Edge`, `com.brave.Browser`
ou `org.chromium.Chromium` selon le navigateur détecté) et non directement
sous `Managed Preferences/` — un fichier posé au mauvais endroit est
silencieusement ignoré, sans erreur visible. `installer-demarrage.sh` utilise
désormais ce chemin.

Cela dit, ce mécanisme est historiquement conçu pour être alimenté par un
profil de configuration (MDM ou `profiles install`), pas par un fichier posé
directement par un script — sur des versions récentes de macOS, il est
possible qu'il reste ignoré même au bon endroit sans profil MDM réel derrière.
**Le mode kiosque (`--kiosk`) ne dépend pas de cette politique et fonctionne
dans tous les cas** ; si les restrictions elles-mêmes ne s'appliquent pas
après redémarrage du navigateur, la solution durable est de livrer la
politique via un vrai profil de configuration (`.mobileconfig`, installable
avec `profiles install -type configuration -path ...` ou via un MDM) plutôt
que par ce script — non implémenté ici, à envisager si le besoin se confirme
sur un poste réel.

## ⚠️ Point d'attention : Firefox, verrouillage un peu moins strict

Firefox n'utilise ni le registre (Windows) ni Managed Preferences (macOS) :
la politique se pose dans un fichier `policies.json` directement à
l'intérieur du bundle (`Firefox.app/Contents/Resources/distribution/`), un
mécanisme propre à Firefox et bien documenté (pas de piège connu comme
Managed Preferences). `firefox-policies.json` verrouille devtools,
navigation privée, gestionnaire de mots de passe, barre de favoris, et
efface l'historique/cache à chaque fermeture — mais **Firefox n'a pas
d'équivalent direct au blocage total des téléchargements** de
`DownloadRestrictions` (Chrome/Edge/Brave) : un fichier reste téléchargeable
via le mode kiosque Firefox. À garder en tête si le blocage des
téléchargements est un point dur du besoin.

## ⚠️ Safari : aucun vrai mode kiosque sans MDM

Sur un Mac **non inscrit dans un MDM** (Apple Business Manager, Jamf,
Kandji...), Safari n'a ni mode kiosque natif ni mécanisme de politique
d'entreprise. `kiosk-vdm.sh` ouvre alors Safari en plein écran sur l'URL
(`open -a Safari` + un raccourci ⌘+Ctrl+F simulé), **sans aucune
restriction** : barre d'adresse, nouvel onglet, historique, téléchargements
restent tous accessibles à l'utilisateur. Ce n'est pas un vrai mode kiosque,
seulement un pense-bête visuel — à réserver aux postes où Chrome/Edge/Brave/
Firefox ne peuvent vraiment pas être installés.

Le passage en plein écran nécessite en plus une autorisation
**Accessibilité** accordée une fois manuellement (Réglages Système →
Confidentialité et sécurité → Accessibilité) au processus qui exécute le
script — sans elle, Safari s'ouvre mais reste en fenêtre normale, sans
erreur visible.

Un vrai verrouillage Safari (« Single App Mode ») existe, mais uniquement sur
un Mac supervisé via MDM, configuré depuis la console MDM elle-même — hors
du périmètre de ce kit de scripts.

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
