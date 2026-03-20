-- Zoom level at capture (check-in for ghost matching; optional for check-out)
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS zoom_level double precision DEFAULT 1.0;

COMMENT ON COLUMN photos.zoom_level IS 'Camera zoom factor when photo was taken (1 = no zoom).';
