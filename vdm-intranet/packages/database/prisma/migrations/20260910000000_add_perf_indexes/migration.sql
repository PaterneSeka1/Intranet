-- Index additifs (aucune colonne/table modifiée) pour les recherches globales par date, sans
-- filtre userId, sur des tables dont l'index existant est préfixé par userId (donc peu utile
-- pour un simple scan par plage de dates côté rôles globaux CTO_ADMIN/DAF).

-- CreateIndex
CREATE INDEX "activity_logs_occurredAt_idx" ON "activity_logs"("occurredAt");

-- CreateIndex
CREATE INDEX "connection_logs_date_type_idx" ON "connection_logs"("date", "type");

-- CreateIndex
CREATE INDEX "daily_mandates_date_idx" ON "daily_mandates"("date");
