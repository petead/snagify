-- WhatsApp OTP signature flow: add columns and policies

ALTER TABLE signatures
  ADD COLUMN IF NOT EXISTS token text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE signatures
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

-- Unique constraint for upsert by (inspection_id, signer_type)
CREATE UNIQUE INDEX IF NOT EXISTS signatures_inspection_signer_key
  ON signatures (inspection_id, signer_type);

-- RLS: allow public to read/update signature by token (for sign page, no auth)
CREATE POLICY "Public can read signature by token"
  ON signatures FOR SELECT
  USING (true);

CREATE POLICY "Public can update signature by token"
  ON signatures FOR UPDATE
  USING (true);
