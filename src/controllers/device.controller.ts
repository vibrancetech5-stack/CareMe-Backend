import { Request, Response } from 'express';
import { DeviceService } from '../services/device.service.js';
const deviceService = new DeviceService();

export async function registerDevice(req: Request, res: Response) {
  try {
    const data = await deviceService.registerDevice(req.body);
    return res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[registerDevice] failed:', message, req.body);
    return res.status(400).json({ ok: false, error: message });
  }
}

export async function heartbeat(req: Request, res: Response) {
  try {
    const data = await deviceService.heartbeat(req.body);
    return res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[heartbeat] failed:', message, req.body);
    return res.status(400).json({ ok: false, error: message });
  }
}

export async function updateVitals(req: Request, res: Response) {
  try {
    const data = await deviceService.updateVitals(req.body);
    return res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[updateVitals] failed:', message, req.body);
    return res.status(400).json({ ok: false, error: message });
  }
}

export async function createAlert(req: Request, res: Response) {
  try {
    const data = await deviceService.createAlert(req.body);
    return res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[createAlert] failed:', message, req.body);
    return res.status(400).json({ ok: false, error: message });
  }
}
