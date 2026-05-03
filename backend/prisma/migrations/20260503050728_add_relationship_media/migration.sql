-- AlterTable
ALTER TABLE "media" ADD COLUMN     "relationshipId" TEXT,
ALTER COLUMN "personId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "media_relationshipId_idx" ON "media"("relationshipId");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
