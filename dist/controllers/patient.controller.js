import { PatientService } from '../services/patient.service.js';
const patientService = new PatientService();
export class PatientController {
    async createPatient(req, res) {
        try {
            // Enforce organization_id from JWT token
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized: Missing authentication' });
            }
            const user = req.user;
            const organizationId = user.organization_id;
            // Build payload from request but do NOT trust incoming organization_id
            const { organization_id: _discardOrg, ...bodyWithoutOrg } = req.body;
            const result = await patientService.createPatient(bodyWithoutOrg, organizationId);
            res.status(201).json(result);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown Error',
            });
        }
    }
    async getPatients(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized: Missing authentication' });
            }
            const user = req.user;
            const result = await patientService.getPatients(user.organization_id);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown Error',
            });
        }
    }
}
