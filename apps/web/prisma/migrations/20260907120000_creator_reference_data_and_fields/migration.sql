-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'CREATOR_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'CREATOR_REJECTED';

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "approvalStatus" "ApprovalStatus",
ADD COLUMN     "cityId" TEXT,
ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "creatorTypeId" TEXT,
ADD COLUMN     "customFields" JSONB,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "reviewComment" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "shopifyRegistered" BOOLEAN;

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dialCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorField" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "City_countryId_name_key" ON "City"("countryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorType_name_key" ON "CreatorType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorField_key_key" ON "CreatorField"("key");

-- CreateIndex
CREATE INDEX "CreatorField_order_idx" ON "CreatorField"("order");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_email_key" ON "Creator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_phone_key" ON "Creator"("phone");

-- CreateIndex
CREATE INDEX "Creator_approvalStatus_idx" ON "Creator"("approvalStatus");

-- CreateIndex
CREATE INDEX "Creator_cityId_idx" ON "Creator"("cityId");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_creatorTypeId_fkey" FOREIGN KEY ("creatorTypeId") REFERENCES "CreatorType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

