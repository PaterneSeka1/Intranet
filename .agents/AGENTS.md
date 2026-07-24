# Règles de l'espace de travail pour Antigravity et les assistants IA

Ces règles spécifiques à l'espace de travail sont automatiquement découvertes et chargées pour toutes les sessions d'assistants IA dans ce dépôt.

---

## 1. Fichiers de Référence du Projet
Toujours lire et respecter ces fichiers au début de chaque session :
* [CLAUDE.md](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/CLAUDE.md) : Structure générale du projet, technologies utilisées et commandes standards.
* [METHODE_DE_TRAVAIL.md](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/METHODE_DE_TRAVAIL.md) : Logique de travail préférée, qualité du code et exigences de formatage.
* [SESSION_HANDOFF.md](file:///Users/macbookpro/YAGAMI/Intranet/vdm-intranet/SESSION_HANDOFF.md) : Document de relais décrivant ce qui a été complété récemment et ce qu'il reste à faire.

---

## 2. Politique de Sécurité de la Géolocalisation
* **Règles d'Accès** : Les coordonnées GPS, les liens vers les cartes (`mapsUrl`) et les adresses géographiques sont classés comme sensibles. Seuls les rôles autorisés (`CTO_ADMIN`, `PDG`, `DAF`, `RESPONSABLE_BU`, `RESPONSABLE_POLE`) peuvent les voir.
* **Utilisateurs Standards** : Les rôles d'employés réguliers (`CONSULTANT`, `STAGIAIRE`, `PRESTATAIRE`) **ne doivent jamais** avoir accès aux données de géolocalisation (elles doivent être censurées/mises à `null` dans l'API et masquées dans l'interface utilisateur).

---

## 3. Style de Communication
* Communiquer et écrire les explications en français.
* Fournir des modifications de code propres et complètes.
* Valider les modifications en exécutant les builds locaux (`npm run build:api` et `npm run build:web`) avant de terminer vos tâches.
