-- Signing deadline, refusal tokens, and refusal audit on signatures
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS signing_deadline timestamptz;

ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS refuse_token uuid,
  ADD COLUMN IF NOT EXISTS refuse_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS refused_at timestamptz,
  ADD COLUMN IF NOT EXISTS refused_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS signatures_refuse_token_key
  ON public.signatures (refuse_token)
  WHERE refuse_token IS NOT NULL;
