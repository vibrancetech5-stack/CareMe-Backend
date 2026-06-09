import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();
const authController = new AuthController();

router.post('/organizations', authController.createOrganization.bind(authController));

export default router;
