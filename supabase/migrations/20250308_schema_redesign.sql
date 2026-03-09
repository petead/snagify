-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- Redesign: properties = physical only; contract fields move to inspections.

-- Remove ejari_ref from properties, add unique constraint
ALTER TABLE properties DROP COLUMN IF EXISTS ejari_ref;
ALTER TABLE properties DROP COLUMN IF EXISTS landlord_name;
ALTER TABLE properties DROP COLUMN IF EXISTS landlord_email;

-- Add building_name and unique constraint on building + unit per agent
ALTER TABLE properties ADD COLUMN IF NOT EXISTS building_name text;
ALTER TABLE properties ADD UNIQUE (agent_id, building_name, unit_number);

-- Add contract fields to inspections instead
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS ejari_ref text;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS contract_from date;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS contract_to date;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS annual_rent numeric;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS security_deposit numeric;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS property_size numeric;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS landlord_phone text;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS tenant_phone text;
