-- Reports and discharge schema migration

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS discharge_date TIMESTAMPTZ;

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS discharge_summary TEXT;

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS discharged_by UUID;

CREATE TABLE IF NOT EXISTS patient_reports (
  id UUID PRIMARY KEY,
  patient_id UUID,
  generated_at TIMESTAMP,
  generated_by UUID,
  pdf_url TEXT,
  csv_url TEXT
);

CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY,
  patient_id UUID,
  heart_rate INTEGER,
  spo2 INTEGER,
  temperature NUMERIC,
  respiration_rate INTEGER,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_sleep_analytics (
  id UUID PRIMARY KEY,
  patient_id UUID,
  sleep_duration INTEGER,
  deep_sleep_duration INTEGER,
  sleep_score INTEGER,
  restlessness_index INTEGER,
  date DATE
);

CREATE TABLE IF NOT EXISTS patient_fall_events (
  id UUID PRIMARY KEY,
  patient_id UUID,
  event_time TIMESTAMP,
  severity TEXT,
  resolved_by UUID,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS patient_alerts (
  id UUID PRIMARY KEY,
  patient_id UUID,
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  created_at TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_notes (
  id UUID PRIMARY KEY,
  patient_id UUID,
  doctor_id UUID,
  note TEXT,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nurse_notes (
  id UUID PRIMARY KEY,
  patient_id UUID,
  nurse_id UUID,
  note TEXT,
  created_at TIMESTAMP
);
