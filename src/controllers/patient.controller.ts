import { Request, Response } from 'express';
import { PatientService } from '../services/patient.service.js';

const patientService = new PatientService();

export class PatientController {
  async createPatient(req: Request, res: Response) {
    try {
      const result = await patientService.createPatient(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown Error',
      });
    }
  }
}
