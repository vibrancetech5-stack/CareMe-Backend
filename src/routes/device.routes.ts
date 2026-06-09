import { Router } from 'express';
import {
  registerDevice,
  heartbeat,
  updateVitals,
  createAlert,
} from '../controllers/device.controller.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();

<<<<<<< HEAD
router.post('/register', registerDevice);
=======
// Device registration endpoint (optional auth)
router.post('/register', optionalAuthMiddleware, registerDevice);
>>>>>>> 5ad26b6 (Fix ESP32 heartbeat and vitals routes)

// Existing routes
router.post('/heartbeat', heartbeat);
router.post('/vitals', updateVitals);

// Add these for ESP32 compatibility
router.post('/device/heartbeat', heartbeat);
router.post('/device/vitals', updateVitals);

router.post('/alert', createAlert);

export default router;
