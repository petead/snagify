-- Ensure signatures has email and sign_url for send-otp flow
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS sign_url text;
