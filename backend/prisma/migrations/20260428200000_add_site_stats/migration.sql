-- CreateTable
CREATE TABLE "SiteStats" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SiteStats_pkey" PRIMARY KEY ("id")
);

-- Seed initial row
INSERT INTO "SiteStats" ("id", "totalVisits") VALUES ('global', 0);
