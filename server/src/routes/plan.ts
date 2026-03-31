import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all plan items
router.get('/', (req, res) => {
  try {
    const items = db.prepare(`SELECT * FROM weekly_plan ORDER BY created_at ASC`).all();
    res.json(items);
  } catch (error) {
    console.error('Failed to get plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new item
router.post('/', (req, res) => {
  const { day, sport, detail } = req.body;
  if (!day || !sport) {
    res.status(400).json({ error: 'Missing day or sport' });
    return;
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO weekly_plan (day, sport, detail, completed)
      VALUES (?, ?, ?, 0)
    `).run(day, sport, detail || '');
    
    res.json({ id: result.lastInsertRowid, day, sport, detail, completed: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an item
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { day, sport, detail, completed } = req.body;
  
  try {
    db.prepare(`
      UPDATE weekly_plan 
      SET day = COALESCE(?, day),
          sport = COALESCE(?, sport),
          detail = COALESCE(?, detail),
          completed = COALESCE(?, completed)
      WHERE id = ?
    `).run(day, sport, detail, completed, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an item
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare(`DELETE FROM weekly_plan WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initial seeder just in case the table is completely empty to simulate the mock data
router.post('/seed', (req, res) => {
  const mockPlan = [
    { day: 'LUN', sport: 'GYM / FUERZA', detail: 'UPPER BODY STRENGTH', completed: 1 },
    { day: 'MAR', sport: 'WINGFOIL', detail: 'SESIÓN TÉCNICA - VIENTO 15KT', completed: 1 },
    { day: 'MIÉ', sport: 'TENIS', detail: 'MATCH PLAY - 90 MIN', completed: 1 },
    { day: 'JUE', sport: 'GYM / FUERZA', detail: 'LOWER BODY + CORE', completed: 0 },
    { day: 'VIE', sport: 'TENIS', detail: 'ENTRENAMIENTO TÉCNICO', completed: 0 },
  ];

  try {
    const existing = db.prepare('SELECT count(*) as c FROM weekly_plan').get() as { c: number };
    if (existing.c === 0) {
      const stmt = db.prepare('INSERT INTO weekly_plan (day, sport, detail, completed) VALUES (?, ?, ?, ?)');
      const tx = db.transaction((items) => {
        for (const item of items) stmt.run(item.day, item.sport, item.detail, item.completed);
      });
      tx(mockPlan);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed' });
  }
});

export default router;
