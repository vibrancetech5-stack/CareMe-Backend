import { Router } from 'express';
import { CaretakerController } from '../controllers/caretaker.controller.js';
const router = Router();
const caretakerController = new CaretakerController();
router.post('/caretakers', caretakerController.createCaretaker.bind(caretakerController));
export default router;
