-- Ajoute un identifiant de connexion "matricule", distinct de `username` (qui reste un champ
-- technique interne). Le login accepte désormais matricule OU email — plus jamais username.
-- Les stagiaires n'ont pas de matricule : ce champ reste NULL pour eux, ils se connectent
-- avec leur email.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "matricule" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_matricule_key" ON "users"("matricule");

-- Backfill : pour les comptes déjà en place, le matricule CONGE avait été aligné sur `username`
-- au moment de l'import (cf. leave-match.util.ts) — on le reprend tel quel pour tous les rôles
-- sauf STAGIAIRE, afin qu'aucun compte existant ne perde son moyen de connexion.
UPDATE "users" SET "matricule" = "username" WHERE "role" != 'STAGIAIRE';

-- Email obligatoire pour tout le monde sans exception (identifiant de connexion des stagiaires,
-- canal de réinitialisation de mot de passe pour tous). Les 32 comptes déjà en prod ont tous
-- déjà un email renseigné (vérifié le 2026-09-02) : aucun backfill nécessaire avant la contrainte.
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
