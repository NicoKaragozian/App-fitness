import { Router } from 'express';
import { computeInsights } from '../insights/index.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.use(requireUser);

router.get('/', async (req, res) => {
  try {
    const result = await computeInsights(req.userId!);
    res.json(result);
  } catch (err: any) {
    console.error('[insights] Error computing insights:', err);
    res.status(500).json({ error: err.message || 'Error computing insights' });
  }
});

export default router;
