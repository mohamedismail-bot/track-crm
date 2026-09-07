-- Convert Creator.niche to an array and add Country.phoneDigits
ALTER TABLE "Creator" ALTER COLUMN "niche" TYPE TEXT[] USING (CASE WHEN "niche" IS NULL THEN ARRAY[]::TEXT[] ELSE ARRAY["niche"]::TEXT[] END);
ALTER TABLE "Creator" ALTER COLUMN "niche" SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Country" ADD COLUMN "phoneDigits" INTEGER;