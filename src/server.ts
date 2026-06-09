import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import deviceRoutes from './routes/device.routes.js';
import patientRoutes from './routes/patient.routes.js';
import authRoutes from './routes/auth.routes.js';
import { optionalAuthMiddleware } from './middleware/auth.js';

const app = express();

app.use(cors());
app.use(express.json());

// Apply optional auth middleware to all routes
app.use(optionalAuthMiddleware);

app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    service: 'CareMe Backend',
    time: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'careme-device-backend' });
});

// API Routes
app.use('/api/auth', authRoutes);
// Expose organization signup at root path: /organizations/signup
app.use('/', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api', deviceRoutes);

// Support legacy routes without /api prefix for device endpoints
app.use('/', deviceRoutes);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Device backend running on port ${port}`);
  console.log(`LAN heartbeat URL: http://<YOUR_LAPTOP_IP>:${port}/api/heartbeat`);
  console.log(`LAN vitals URL:    http://<YOUR_LAPTOP_IP>:${port}/api/vitals`);
});

