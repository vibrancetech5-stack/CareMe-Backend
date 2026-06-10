import { Request, Response } from 'express';
import { DeviceService } from '../services/device.service.js';
import { AuthUser } from '../middleware/auth.js';

const deviceService = new DeviceService();

export async function registerDevice(req: Request, res: Response) {
  try {
    // If authenticated, enforce organization_id from token
    let payload = req.body;
    if (req.user) {
      const user = req.user as AuthUser;
      payload = {
        ...req.body,
        organization_id: user.organization_id,
      };
    }
    
    const data = await deviceService.registerDevice(payload);
    return res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[registerDevice] failed:', message, req.body);
    return res.status(400).json({ ok: false, error: message });
  }
}

export async function getAvailableDevices(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const devices = await deviceService.getAvailableDevices(req.user.organization_id);
    return res.json({ ok: true, data: devices });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[getAvailableDevices] failed:', message);
    return res.status(400).json({ ok: false, error: message });
  }
}

export async function assignDevice(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { patientId, deviceId } = req.body;
    if (!patientId || !deviceId) {
      return res.status(400).json({ ok: false, error: 'patientId and deviceId are required' });
    }

    const result = await deviceService.assignDevice(
      patientId,
      deviceId,
      req.user.organization_id,
    );

    return res.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[assignDevice] failed:', message, req.body);
    return res.status(400).json({ ok: false, error: message });
  }
}

export async function unassignDevice(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ ok: false, error: 'patientId is required' });
    }

    const result = await deviceService.unassignDevice(patientId, req.user.organization_id);
    return res.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[unassignDevice] failed:', message, req.body);
    return res.status(400).json({ ok: false, error: message });
  }
}

export async function heartbeat(req: Request, res: Response) {
  console.log('Heartbeat endpoint hit');
  console.log(req.body);

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
  console.log('Vitals endpoint hit');
  console.log(req.body);

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
