import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import activitiesRoutes from './routes/activities.js';
import healthRoutes from './routes/health.js';
import syncRoutes from './routes/sync.js';
import * as garmin from './garmin.js';
import planRoutes from './routes/plan.js';
import insightsRoutes from './routes/insights.js';
import sportGroupsRoutes from './routes/sport-groups.js';
import aiRoutes from './routes/ai.js';
import { startPeriodicSync, syncInitial } from './sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: true, credentials: true }));
}
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/sport-groups', sportGroupsRoutes);
app.use('/api/ai', aiRoutes);

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

// Try to restore session on startup
async function init() {
  const restored = await garmin.tryRestoreSession();
  if (restored) {
    syncInitial().then(() => startPeriodicSync());
  }

  app.listen(PORT, () => {
    console.log(`[server] DRIFT backend running on http://localhost:${PORT}`);
  });
}

init();
