-- Add email column for Resend OTP flow (phone column kept for backwards compatibility)
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS email text;
