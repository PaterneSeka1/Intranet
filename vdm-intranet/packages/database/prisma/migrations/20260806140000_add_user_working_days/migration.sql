-- Motif hebdomadaire récurrent de jours travaillés par employé (convention Date.getUTCDay() :
-- 0=Dimanche…6=Samedi). Défaut Lundi-Vendredi ; un tableau vide est valide (planning entièrement
-- défini par mandats, ex. rotation Pôle TV/Radio).
ALTER TABLE "users" ADD COLUMN "workingDays" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[];
