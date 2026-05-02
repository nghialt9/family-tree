-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "notification_runs" (
    "date" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "notification_runs_pkey" PRIMARY KEY ("date")
);
