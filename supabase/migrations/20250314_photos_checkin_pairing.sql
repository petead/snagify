-- Check-out photo pairing: link checkout photos to check-in references + new findings
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS checkin_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_additional BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_photos_checkin_photo_id ON photos(checkin_photo_id);
