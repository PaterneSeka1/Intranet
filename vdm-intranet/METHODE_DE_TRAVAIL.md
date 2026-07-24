# METHODE_DE_TRAVAIL.md - Méthodologie de Travail avec l'IA

Ce document décrit les consignes de travail et les standards de communication à respecter pour toute IA collaborant sur ce projet.

---

## 1. Principes de Pair Programming
* **Précision et Clarté** : Avant de modifier un fichier, l'IA doit analyser en profondeur le problème et exposer sa logique en français.
* **Pas de Code Temporaire ou Placeholders** : Le code généré doit être complet, prêt pour la production, sans commentaires de type `// TODO: implement later` ou code incomplet.
* **Intégrité de la Base de Code** : Toujours préserver les commentaires, typages et logiques existants n'ayant pas de lien direct avec la modification en cours.

---

## 2. Processus de Développement et Validation
1. **Recherche et Analyse** : Identifier les fichiers sources et analyser les dépendances.
2. **Implémentation Incrementale** : Préférer des modifications précises et localisées. Si plusieurs fichiers sont modifiés, faire des modifications atomiques.
3. **Compilation et Vérification** :
   * Après chaque modification, lancer un build complet de l'API (`npm run build:api`) et/ou du Frontend (`npm run build:web`).
   * Il est obligatoire de s'assurer qu'aucun avertissement ou erreur de typage n'a été introduit.
4. **Documentation** : Mettre à jour le fichier `SESSION_HANDOFF.md` en fin de session pour récapituler le travail fait et les prochaines tâches.

---

## 3. Sécurité et Confidentialité des Données
* **Géolocalisation** : Les données de géolocalisation (coordonnées GPS, adresses GPS, cartes) ne doivent être visibles et accessibles **que** pour l'administrateur (`CTO_ADMIN`), les responsables de BU/Pôle (`RESPONSABLE_BU`, `RESPONSABLE_POLE`) et la direction (`PDG`, `DAF`). Les rôles standards (`CONSULTANT`, `STAGIAIRE`, `PRESTATAIRE`) ne doivent jamais recevoir ou afficher ces informations.
* Cette politique d'accès aux données doit être rigoureusement appliquée à la fois côté API (champs mis à `null`) et côté IHM.
