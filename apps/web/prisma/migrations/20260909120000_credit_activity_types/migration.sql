-- Add system activity types for the credit/debit ledger postings.
ALTER TYPE "ActivityType" ADD VALUE 'GIFT_CREDIT_POSTED';
ALTER TYPE "ActivityType" ADD VALUE 'GIFT_DEBIT_POSTED';
