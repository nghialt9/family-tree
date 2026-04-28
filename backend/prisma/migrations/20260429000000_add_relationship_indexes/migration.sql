-- CreateIndex
CREATE INDEX "relationships_personAId_idx" ON "relationships"("personAId");

-- CreateIndex
CREATE INDEX "relationships_personBId_idx" ON "relationships"("personBId");

-- CreateIndex
CREATE INDEX "relationships_type_idx" ON "relationships"("type");
