-- Key handover items handed to tenant (e.g. keys, remotes).
-- Format: [{"item": "Door keys", "qty": 3}, {"item": "Parking card", "qty": 1}]
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS key_handover JSONB DEFAULT '[]';
