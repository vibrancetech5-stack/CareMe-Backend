import { CaretakerService } from '../services/caretaker.service.js';
const caretakerService = new CaretakerService();
export class CaretakerController {
    async createCaretaker(req, res) {
        try {
            const result = await caretakerService.createCaretaker(req.body);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown Error',
            });
        }
    }
}
