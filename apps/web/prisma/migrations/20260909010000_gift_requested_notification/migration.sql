-- New notification type for regular gift-order submissions (sent to team
-- managers when an order enters an approval step).

ALTER TYPE "NotificationType" ADD VALUE 'GIFT_REQUESTED';