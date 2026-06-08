import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';

const authService = new AuthService();

export class AuthController {
  async createOrganization(req: Request, res: Response) {
    try {
      const result = await authService.createOrganization(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown Error',
      });
    }
  }
}
