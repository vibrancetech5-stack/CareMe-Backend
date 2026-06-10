import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/patients — create patient
router.post('/', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const payload = { ...req.body };
    delete payload.organization_id;

    const { data, error } = await supabase
      .from('patients')
      .insert({ ...payload, organization_id: organizationId })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    console.error('[Patient Route] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/patients/:id/assign-device
router.post('/:id/assign-device', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const patientId = req.params.id;
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    // 1. Verify patient belongs to caller's org
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (patientErr || !patient) {
      return res.status(403).json({ error: 'Patient not found in your organization' });
    }

    // 2. Verify device belongs to caller's org
    const { data: device, error: deviceErr } = await supabase
      .from('devices')
      .select('id')
      .eq('id', device_id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (deviceErr || !device) {
      return res.status(403).json({ error: 'Device not found in your organization' });
    }

    // 3. Make sure device isn't already assigned to another patient
    const { data: alreadyAssigned } = await supabase
      .from('patients')
      .select('id')
      .eq('assigned_device_id', device_id)
      .neq('id', patientId)
      .maybeSingle();

    if (alreadyAssigned) {
      return res.status(409).json({ error: 'This device is already assigned to another patient' });
    }

    // 4. Assign the device
    const { error: updateErr } = await supabase
      .from('patients')
      .update({ assigned_device_id: device_id })
      .eq('id', patientId);

    if (updateErr) return res.status(400).json({ error: updateErr.message });

    // 5. UPDATE ADDED HERE: Update the device with the patient ID
    const { error: deviceUpdateErr } = await supabase
      .from('devices')
      .update({ assigned_patient_id: patientId })
      .eq('id', device_id);

    if (deviceUpdateErr) {
      console.error('[Assign Device] Failed to update device with patient ID:', deviceUpdateErr);
    }

    res.json({ success: true, message: 'Device assigned successfully' });
  } catch (err: any) {
    console.error('[Assign Device] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/patients/:id/unassign-device
router.post('/:id/unassign-device', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const patientId = req.params.id;

    // UPDATE ADDED HERE: We now select assigned_device_id so we know which device to clear
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('id, assigned_device_id')
      .eq('id', patientId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (patientErr || !patient) {
      return res.status(403).json({ error: 'Patient not found in your organization' });
    }

    // Unassign device from the patient table
    const { error: updateErr } = await supabase
      .from('patients')
      .update({ assigned_device_id: null })
      .eq('id', patientId);

    if (updateErr) return res.status(400).json({ error: updateErr.message });

    // UPDATE ADDED HERE: Clear the patient from the device table
    if (patient.assigned_device_id) {
      await supabase
        .from('devices')
        .update({ assigned_patient_id: null })
        .eq('id', patient.assigned_device_id);
    }

    res.json({ success: true, message: 'Device unassigned successfully' });
  } catch (err: any) {
    console.error('[Unassign Device] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
