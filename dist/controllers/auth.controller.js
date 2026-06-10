import { AuthService } from '../services/auth.service.js';
const authService = new AuthService();
export class AuthController {
    async signup(req, res) {
        try {
            const payload = req.body;
            // Validate required fields
            if (!payload.organization_name || !payload.organization_type || !payload.full_name || !payload.email || !payload.password) {
                return res.status(400).json({
                    error: 'Missing required fields: organization_name, organization_type, full_name, email, password',
                });
            }
            const result = await authService.signupOrganization(payload);
            res.status(201).json(result);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown Error',
            });
        }
    }
    async createOrganization(req, res) {
        try {
            const result = await authService.createOrganization(req.body);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown Error',
            });
        }
    }
}
