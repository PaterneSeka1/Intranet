---
name: verif-ci
description: Rejoue localement la CI GitHub (Prettier, type-check API/Web, tests API, builds) avant un git push, corrige les échecs puis revérifie. À utiliser avant tout push, quand l'utilisateur demande de « vérifier la CI », quand un push est bloqué par le hook pre-push, ou quand un job GitHub Actions build-test échoue.
---

# Vérification CI avant push

Le script `vdm-intranet/scripts/verify-ci.sh` rejoue les étapes bloquantes de
`.github/workflows/ci.yml`. Le hook `.githooks/pre-push` l'exécute automatiquement à chaque
`git push`.

## Procédure

1. **Hook actif ?** Lancer `git config core.hooksPath`. Si le résultat n'est pas `.githooks`,
   l'activer avec `git config core.hooksPath .githooks` et le signaler à l'utilisateur.
2. **Lancer la vérification** depuis la racine du dépôt :
   `bash vdm-intranet/scripts/verify-ci.sh` (timeout ≥ 10 min). `--quick` saute les builds :
   ne l'utiliser que pour itérer, jamais pour la validation finale.
3. **Corriger chaque étape en échec**, dans l'ordre :
   - *Prettier* : `cd vdm-intranet && npx prettier --write <fichiers signalés>`. Ne formater
     que les fichiers listés, jamais tout le dépôt (diff parasite).
   - *Type-check / build* : corriger la cause réelle dans le code. Interdit : `@ts-ignore`,
     `any` de complaisance, désactiver une règle ou une étape CI.
   - *Tests* : déterminer si c'est le code ou le test qui est faux. Ne jamais supprimer,
     `skip` ou affaiblir un test pour le faire passer ; en cas de doute, demander.
   - *Prisma generate* : vérifier `packages/database/prisma/schema.prisma`.
4. **Relancer le script complet** jusqu'à `Vérification CI : OK`.
5. **Revoir le diff** (`git diff`) : aucune modification hors des corrections.
6. **Rapport** : étapes passées, fichiers corrigés, et ce qui n'est pas vérifié localement
   (`prisma migrate deploy` sur base neuve, `npm audit`). Ne commiter ou pousser que si
   l'utilisateur le demande.

## Notes

- Si `.github/workflows/ci.yml` change (étape ajoutée/modifiée), mettre `verify-ci.sh` à jour
  dans le même commit.
- Contournement du hook (urgence uniquement, sur demande explicite de l'utilisateur) :
  `git push --no-verify`.
