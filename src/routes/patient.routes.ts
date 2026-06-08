import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller.js';

const router = Router();
const patientController = new PatientController();

router.post('/patients', patientController.createPatient.bind(patientController));

export default router;
