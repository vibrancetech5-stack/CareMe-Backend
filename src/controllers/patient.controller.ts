import { Request, Response } from 'express';
import { PatientService } from '../services/patient.service.js';
import { AuthUser } from '../middleware/auth.js';

const patientService = new PatientService();

export class PatientController {
  async createPatient(req: Request, res: Response) {
    try {
      // Enforce organization_id from JWT token
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Missing authentication' });
      }

      const user = req.user as AuthUser;
      const organizationId = user.organization_id;

      // Merge organization_id from token with request payload
      const payload = {
        ...req.body,
        organization_id: organizationId,
      };

      const result = await patientService.createPatient(payload);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown Error',
      });
    }
  }

  async getPatients(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Missing authentication' });
      }

      const user = req.user as AuthUser;
      const result = await patientService.getPatients(user.organization_id);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown Error',
      });
    }
  }
}
