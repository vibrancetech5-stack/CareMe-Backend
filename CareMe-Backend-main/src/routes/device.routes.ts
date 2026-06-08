import { Router } from 'express';
import {
  registerDevice,
  heartbeat,
  updateVitals,
  createAlert,
} from '../controllers/device.controller.js';

const router = Router();

router.post('/register', registerDevice);
router.post('/heartbeat', heartbeat);
router.post('/vitals', updateVitals);
router.post('/alert', createAlert);

export default router;
