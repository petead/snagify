-- Store sign URL in signatures so agent can share manually (e.g. WhatsApp)
ALTER TABLE signatures
  ADD COLUMN IF NOT EXISTS sign_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz default now();
