import { Router } from 'express';
import { ReportService } from '../services/report.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const reportService = new ReportService();

router.get('/patients', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const result = await reportService.getReportPatients(organizationId);
    res.json(result);
  } catch (err: any) {
    console.error('[Report Routes] Failed to get patient reports:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

router.get('/patient/:id', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const patientId = req.params.id;
    const result = await reportService.getFullPatientReport(patientId, organizationId);
    res.json(result);
  } catch (err: any) {
    console.error('[Report Routes] Failed to get full patient report:', err);
    const statusCode = err.message === 'Patient not found' ? 404 : 500;
    res.status(statusCode).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

router.get('/patient/:id/pdf', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const patientId = req.params.id;
    const report = await reportService.getFullPatientReport(patientId, organizationId);

    res.json({
      ok: true,
      message: 'PDF export is available via a dedicated reporting library or frontend conversion service.',
      report,
    });
  } catch (err: any) {
    console.error('[Report Routes] Failed to generate PDF export:', err);
    const statusCode = err.message === 'Patient not found' ? 404 : 500;
    res.status(statusCode).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

router.get('/patient/:id/csv', requireAuth, async (req, res) => {
  try {
    const organizationId = req.user!.organization_id;
    const patientId = req.params.id;
    const csv = await reportService.getPatientCsv(patientId, organizationId);

    res.header('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err: any) {
    console.error('[Report Routes] Failed to generate CSV export:', err);
    const statusCode = err.message === 'Patient not found' ? 404 : 500;
    res.status(statusCode).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

export default router;
