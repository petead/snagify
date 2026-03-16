-- Reference copy of key_handover from check-in, used for check-out reconciliation.
-- Never modified; check-out key_handover holds returned quantities.
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS checkin_key_handover JSONB DEFAULT '[]';
