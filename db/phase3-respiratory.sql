-- Phase 3 respiratory baseline support

ALTER TABLE respiratory_baselines
ADD COLUMN IF NOT EXISTS alert_level text;

CREATE INDEX IF NOT EXISTS idx_respiratory_recorded_date
ON respiratory_baselines(recorded_date);

CREATE INDEX IF NOT EXISTS idx_respiratory_alert
ON respiratory_baselines(respiratory_alert);
