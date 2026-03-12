-- Room-level condition (Excellent/Good/Fair/Needs Attention) computed at report generation
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT NULL;
