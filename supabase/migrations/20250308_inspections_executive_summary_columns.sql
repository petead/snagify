-- AI-generated executive summary and computed condition/risk (set when "Generate Report" is run).
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS executive_summary TEXT,
  ADD COLUMN IF NOT EXISTS overall_condition TEXT DEFAULT 'Good',
  ADD COLUMN IF NOT EXISTS dispute_risk INTEGER DEFAULT 0;
