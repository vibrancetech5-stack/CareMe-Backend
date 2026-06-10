import { DeviceService } from '../services/device.service.js';
const deviceService = new DeviceService();
export async function registerDevice(req, res) {
    try {
        // If authenticated, enforce organization_id from token
        let payload = req.body;
        if (req.user) {
            const user = req.user;
            payload = {
                ...req.body,
                organization_id: user.organization_id,
            };
        }
        const data = await deviceService.registerDevice(payload);
        return res.json({ ok: true, data });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[registerDevice] failed:', message, req.body);
        return res.status(400).json({ ok: false, error: message });
    }
}
export async function heartbeat(req, res) {
    console.log('Heartbeat endpoint hit');
    console.log(req.body);
    try {
        const data = await deviceService.heartbeat(req.body);
        return res.json({ ok: true, data });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[heartbeat] failed:', message, req.body);
        return res.status(400).json({ ok: false, error: message });
    }
}
export async function updateVitals(req, res) {
    console.log('Vitals endpoint hit');
    console.log(req.body);
    try {
        const data = await deviceService.updateVitals(req.body);
        return res.json({ ok: true, data });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[updateVitals] failed:', message, req.body);
        return res.status(400).json({ ok: false, error: message });
    }
}
export async function createAlert(req, res) {
    try {
        const data = await deviceService.createAlert(req.body);
        return res.json({ ok: true, data });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[createAlert] failed:', message, req.body);
        return res.status(400).json({ ok: false, error: message });
    }
}
