import { Router } from 'express';
import { computeInsights } from '../insights/index.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const result = computeInsights();
    res.json(result);
  } catch (err: any) {
    console.error('[insights] Error computing insights:', err);
    res.status(500).json({ error: err.message || 'Error computing insights' });
  }
});

export default router;
