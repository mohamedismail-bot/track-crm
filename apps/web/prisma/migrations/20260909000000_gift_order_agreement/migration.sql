-- Gift Order form: persist the Agreement section (budget/commission terms plus
-- the deliverables agreed in exchange, as a JSON array) on the order itself.
-- Materialized into real Deliverable records (tagged giftId) when the order
-- reaches a status flagged "spawnDeliverables".

ALTER TABLE "Gift" ADD COLUMN "agreement" JSONB;