import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const patientController = new PatientController();

router.post('/patients', authMiddleware, patientController.createPatient.bind(patientController));
router.get('/patients', authMiddleware, patientController.getPatients.bind(patientController));

export default router;
