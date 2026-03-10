-- Simplify photos schema: remove room_items, add damage_tags and notes
-- Run after schema.sql / existing migrations

-- 1. Drop room_items (photos.room_item_id will be removed by dropping the FK then the table)
ALTER TABLE photos DROP COLUMN IF EXISTS room_item_id;
DROP TABLE IF EXISTS room_items CASCADE;

-- 2. Clean and extend photos
ALTER TABLE photos
  DROP COLUMN IF EXISTS is_flagged,
  ADD COLUMN IF NOT EXISTS damage_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text;

-- 3. Verification (informational)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'photos'
-- ORDER BY ordinal_position;
