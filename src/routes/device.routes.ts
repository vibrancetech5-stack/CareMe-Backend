import { Router } from 'express';
import {
  registerDevice,
  getAvailableDevices,
  assignDevice,
  unassignDevice,
  heartbeat,
  updateVitals,
  createAlert,
} from '../controllers/device.controller.js';
import { optionalAuthMiddleware, requireAuth } from '../middleware/auth.js';

const router = Router();

// Device registration endpoint (optional auth)
router.post('/register', optionalAuthMiddleware, registerDevice);

// New device management endpoints
router.get('/devices/available', requireAuth, getAvailableDevices);
router.post('/devices/assign', requireAuth, assignDevice);
router.post('/devices/unassign', requireAuth, unassignDevice);

// Existing routes
router.post('/heartbeat', heartbeat);
router.post('/vitals', updateVitals);

// Add these for ESP32 compatibility
router.post('/device/heartbeat', heartbeat);
router.post('/device/vitals', updateVitals);

router.post('/alert', createAlert);

export default router;
