import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Carga el .env desde server/ sin importar desde dónde se corra el proceso
const _serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenvConfig({ path: path.join(_serverDir, '.env') });

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import activitiesRoutes from './routes/activities.js';
import healthRoutes from './routes/health.js';
import planRoutes from './routes/plan.js';
import insightsRoutes from './routes/insights.js';
import sportGroupsRoutes from './routes/sport-groups.js';
import aiRoutes from './routes/ai.js';
import trainingRoutes from './routes/training.js';
import healthkitRoutes from './routes/healthkit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    // Sin origin → mismo dominio / curl / Postman → permitir
    if (!origin) return callback(null, true);
    // Capacitor iOS
    if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') {
      return callback(null, true);
    }
    // En dev: permitir cualquier localhost
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    // En producción: el frontend está en el mismo dominio (onrender.com)
    // Las requests del SPA llegan con el origin del propio servidor → permitir
    if (process.env.NODE_ENV === 'production' && origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/sport-groups', sportGroupsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/healthkit', healthkitRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`[server] DRIFT backend running on http://localhost:${PORT}`);
});
