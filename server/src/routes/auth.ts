import { Router } from 'express';
import * as garmin from '../garmin.js';
import { syncInitial, startPeriodicSync, isSyncing, lastSync } from '../sync.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  try {
    await garmin.login(email, password);
    // Start initial sync in background
    syncInitial().then(() => startPeriodicSync());
    res.json({ success: true, message: 'Logged in, syncing data...' });
  } catch (err: any) {
    console.error('Login error:', err);
    const msg = err.message || 'Unknown error';
    // The library throws "No OAuth2 token available" when Garmin returns 401
    // This typically means wrong credentials or bot-protection triggered
    const userMsg = msg.includes('OAuth2') || msg.includes('401')
      ? 'Credenciales incorrectas o Garmin está bloqueando la solicitud. Verifica usuario/contraseña.'
      : msg;
    res.status(401).json({ error: userMsg });
  }
});

router.get('/status', (_req, res) => {
  res.json({
    authenticated: garmin.getStatus(),
    syncing: isSyncing,
    lastSync,
  });
});

router.post('/logout', (_req, res) => {
  garmin.logout();
  res.json({ success: true });
});

export default router;
