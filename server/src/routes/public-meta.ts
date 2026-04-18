import { Router } from 'express';

const router = Router();

/** Public: which OAuth providers are configured (must not require Better Auth session). */
router.get('/auth-features', (_req, res) => {
  res.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
});

export default router;
