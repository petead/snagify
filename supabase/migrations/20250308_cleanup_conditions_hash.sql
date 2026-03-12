-- Ensure document hash column exists for report integrity tracking
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS document_hash TEXT;

-- Keep only room-level condition column
ALTER TABLE rooms
  DROP COLUMN IF EXISTS overall_condition;

-- Remove deprecated global condition/risk columns
ALTER TABLE inspections
  DROP COLUMN IF EXISTS overall_condition;

ALTER TABLE inspections
  DROP COLUMN IF EXISTS dispute_risk;
