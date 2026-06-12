import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import deviceRoutes from './routes/device.routes.js';
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patient.routes.js';
import reportRoutes from './routes/report.routes.js';
const app = express();
app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
});
app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'careme-device-backend' });
});
app.use('/api', deviceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/', deviceRoutes);
const port = Number(process.env.PORT ?? 3000);
app.listen(port, '0.0.0.0', () => {
    console.log(`Device backend running on port ${port}`);
    console.log(`LAN heartbeat URL: http://<YOUR_LAPTOP_IP>:${port}/api/heartbeat`);
    console.log(`LAN vitals URL:    http://<YOUR_LAPTOP_IP>:${port}/api/vitals`);
});
