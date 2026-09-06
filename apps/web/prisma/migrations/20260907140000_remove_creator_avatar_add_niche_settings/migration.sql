-- Remove the Creator avatarUrl column (avatar avatars come from platform profiles)
ALTER TABLE "Creator" DROP COLUMN "avatarUrl";

-- Remove the now-removed avatarUrl built-in creator field
DELETE FROM "CreatorField" WHERE "key" = 'avatarUrl';

-- Seed the admin-managed niche options and the creator-form custom fields toggle
INSERT INTO "WorkspaceSetting" ("key", "value", "updatedAt")
VALUES
  ('creator.nicheOptions', '["Fashion","Beauty","Tech","Gaming","Food","Travel","Fitness","Family","Lifestyle","Automotive","Business","Sports","Other"]', CURRENT_TIMESTAMP),
  ('creator.customFieldsEnabled', 'true', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;