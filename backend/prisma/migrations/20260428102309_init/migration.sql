-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('parent_child', 'spouse');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('viewer', 'admin');

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickname" TEXT,
    "gender" "Gender" NOT NULL,
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "phone" TEXT,
    "address" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "personAId" TEXT NOT NULL,
    "personBId" TEXT NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "marriedDate" TIMESTAMP(3),
    "divorcedDate" TIMESTAMP(3),

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "label" TEXT,
    "passwordHash" TEXT,
    "personId" TEXT,

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_phone_key" ON "access_tokens"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_personId_key" ON "access_tokens"("personId");

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_personAId_fkey" FOREIGN KEY ("personAId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_personBId_fkey" FOREIGN KEY ("personBId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
