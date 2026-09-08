-- Gift Order status engine: dynamic GiftStatus rows, Gift order fields,
-- product catalog, credit ledger, and gift-linked deliverables.
-- Existing gifts are remapped to seeded statuses; their single product values
-- are snapshotted into a GiftLine so nothing is lost.

-- CreateEnum
CREATE TYPE "GiftApprovalRole" AS ENUM ('NONE', 'MANAGER', 'ADMIN');
CREATE TYPE "CreditTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- DropIndex
DROP INDEX "Gift_status_requestedAt_idx";

-- Rename the legacy enum so a table may take the "GiftStatus" name; dropped at the end
ALTER TYPE "GiftStatus" RENAME TO "_GiftStatus_legacy";

-- AlterTable (drift: schema has no default on Creator.niche)
ALTER TABLE "Creator" ALTER COLUMN "niche" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GiftStatus" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "approvalRole" "GiftApprovalRole" NOT NULL DEFAULT 'NONE',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isRejection" BOOLEAN NOT NULL DEFAULT false,
    "grantCredit" BOOLEAN NOT NULL DEFAULT false,
    "spawnDeliverables" BOOLEAN NOT NULL DEFAULT false,
    "warehouseStep" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftStatus_pkey" PRIMARY KEY ("id")
);

-- Seed days-one statuses (ids equal keys so backfill can reference them)
INSERT INTO "GiftStatus" ("id", "key", "label", "position", "approvalRole", "isDraft", "isRejection", "grantCredit", "spawnDeliverables", "warehouseStep") VALUES
    ('draft',           'draft',           'Draft',           0, 'NONE',    true,  false, false, false, false),
    ('pending_manager', 'pending_manager', 'Pending Manager', 1, 'MANAGER', false, false, false, false, false),
    ('approved',        'approved',        'Approved',        2, 'NONE',    false, false, false, true,  true),
    ('shipped',         'shipped',         'Shipped',         3, 'NONE',    false, false, false, false, true),
    ('delivered',       'delivered',       'Delivered',       4, 'NONE',    false, false, true,  false, false),
    ('rejected',        'rejected',        'Rejected',        5, 'NONE',    false, true,  false, false, false);

-- AlterTable Gift: add order fields; statusId added nullable, remapped, then NOT NULL
ALTER TABLE "Gift" ADD COLUMN     "agreedBudget" DOUBLE PRECISION,
ADD COLUMN     "commissionRate" DOUBLE PRECISION,
ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'EGP',
ADD COLUMN     "orderNumber" SERIAL NOT NULL,
ADD COLUMN     "orderTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "statusId" TEXT;

-- CreateTable
CREATE TABLE "GiftLine" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "GiftLine_pkey" PRIMARY KEY ("id")
);

-- Snapshot existing one-line gifts into GiftLine before dropping the old columns
INSERT INTO "GiftLine" ("id", "giftId", "productId", "productName", "productDescription", "unitCost", "quantity", "lineTotal")
SELECT 'gfl_' || "id", "id", NULL, "productName", "productDescription", 0, 1, 0 FROM "Gift";

-- Backfill statusId from the old enum values
UPDATE "Gift" SET "statusId" = 'pending_manager' WHERE "status" = 'REQUESTED';
UPDATE "Gift" SET "statusId" = 'approved'       WHERE "status" = 'APPROVED_QUEUED';
UPDATE "Gift" SET "statusId" = 'shipped'        WHERE "status" = 'DISPATCHED';
UPDATE "Gift" SET "statusId" = 'delivered'      WHERE "status" = 'DELIVERED';
UPDATE "Gift" SET "statusId" = 'rejected'       WHERE "status" = 'REJECTED';

-- Drop old columns and enforce the FK column
ALTER TABLE "Gift" DROP COLUMN "productDescription",
DROP COLUMN "productName",
DROP COLUMN "status",
ALTER COLUMN "statusId" SET NOT NULL;

-- DropEnum
DROP TYPE "_GiftStatus_legacy";

-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "giftId" TEXT;

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_userId_key" ON "CreditAccount"("userId");

-- CreateIndex
CREATE INDEX "CreditAccount_userId_idx" ON "CreditAccount"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_accountId_createdAt_idx" ON "CreditTransaction"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_position_idx" ON "ProductCategory"("position");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftStatus_key_key" ON "GiftStatus"("key");

-- CreateIndex
CREATE INDEX "GiftStatus_position_idx" ON "GiftStatus"("position");

-- CreateIndex
CREATE INDEX "GiftLine_giftId_idx" ON "GiftLine"("giftId");

-- CreateIndex
CREATE INDEX "Deliverable_giftId_idx" ON "Deliverable"("giftId");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_orderNumber_key" ON "Gift"("orderNumber");

-- CreateIndex
CREATE INDEX "Gift_statusId_requestedAt_idx" ON "Gift"("statusId", "requestedAt");

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "GiftStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftLine" ADD CONSTRAINT "GiftLine_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftLine" ADD CONSTRAINT "GiftLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;