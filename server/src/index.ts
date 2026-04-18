import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import authRoutes from './routes/auth.js';
import activitiesRoutes from './routes/activities.js';
import healthRoutes from './routes/health.js';
import syncRoutes from './routes/sync.js';
import planRoutes from './routes/plan.js';
import insightsRoutes from './routes/insights.js';
import sportGroupsRoutes from './routes/sport-groups.js';
import aiRoutes from './routes/ai.js';
import trainingRoutes from './routes/training.js';
import profileRoutes from './routes/profile.js';
import nutritionRoutes from './routes/nutrition.js';
import goalsRoutes from './routes/goals.js';
import assessmentRoutes from './routes/assessment.js';
import adminRoutes from './routes/admin.js';
import { startPeriodicSync, syncInitial } from './sync.js';
import { getAllUsersWithTokens } from './garmin.js';
import { UPLOAD_DIR } from './lib/upload-dir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// CORS must come before Better Auth handler
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  }));
} else {
  app.use(cors({
    origin: process.env.APP_URL ?? true,
    credentials: true,
  }));
}

// Better Auth handler — must be mounted BEFORE express.json()
app.all('/api/auth/*', toNodeHandler(auth));

// JSON body parser for all other routes
app.use(express.json());

// App routes
app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/sport-groups', sportGroupsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/admin', adminRoutes);

// Static uploads (meal photos)
app.use('/uploads', express.static(UPLOAD_DIR));

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

async function init() {
  app.listen(PORT, () => {
    console.log(`[server] DRIFT backend running on http://localhost:${PORT}`);
  });

  // Start sync for all users that already have Garmin tokens
  const userIds = await getAllUsersWithTokens();
  if (userIds.length > 0) {
    console.log(`[server] Found ${userIds.length} user(s) with Garmin tokens — starting initial sync...`);
    for (const userId of userIds) {
      syncInitial(userId).catch((err) => console.error(`[server] syncInitial error for ${userId}:`, err));
    }
    startPeriodicSync();
  } else {
    console.log('[server] No Garmin tokens found — skipping initial sync');
    startPeriodicSync();
  }
}

init();
