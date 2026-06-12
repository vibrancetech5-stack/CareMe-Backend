import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/reports/patients
router.get('/patients', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const status = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;

    let query = supabase
      .from('patients')
      .select('id, name, status, ward, room, bed, attending_doctor, attending_nurse, admission_date, discharge_date, organization_id')
      .eq('organization_id', organizationId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('admission_date', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    console.error('[Reports Route] Error fetching patients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/patient/:id
router.get('/patient/:id', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const patientId = String(req.params.id);

    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (patientErr || !patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const fetchTable = async (table: string) => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    };

    const fetchSleep = async () => {
      const { data, error } = await supabase
        .from('patient_sleep_analytics')
        .select('*')
        .eq('patient_id', patientId)
        .order('date', { ascending: false })
        .limit(30);
      return data || [];
    };

    const [vitals, sleep, alerts, falls, doctorNotes, nurseNotes] = await Promise.all([
      fetchTable('patient_vitals'),
      fetchSleep(),
      fetchTable('patient_alerts'),
      fetchTable('patient_fall_events'),
      fetchTable('doctor_notes'),
      fetchTable('nurse_notes'),
    ]);

    res.json({
      patient,
      vitals,
      sleep,
      alerts,
      falls,
      doctorNotes,
      nurseNotes,
    });
  } catch (err: any) {
    console.error('[Reports Route] Error fetching report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/patient/:id/pdf
router.get('/patient/:id/pdf', requireAuth, async (_req, res) => {
  res.json({ message: 'PDF export not implemented in this demo.', url: 'https://example.com/report.pdf' });
});

// GET /api/reports/patient/:id/csv
router.get('/patient/:id/csv', requireAuth, async (_req, res) => {
  res.json({ message: 'CSV export not implemented in this demo.', url: 'https://example.com/report.csv' });
});

export default router;
