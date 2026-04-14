import express from 'express';
import db from '../db.js';
import { buildGoalContext } from '../ai/context.js';
import { PROMPTS } from '../ai/prompts.js';
import { claudeChat, isClaudeConfigured } from '../ai/claude.js';

const router = express.Router();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

// POST /api/goals/generate
router.post('/generate', async (req, res) => {
  const { objective, targetDate } = req.body;
  if (!objective?.trim()) return res.status(400).json({ error: 'objective required' });

  if (!isClaudeConfigured()) {
    return res.status(503).json({ error: 'Claude API not configured. Add ANTHROPIC_API_KEY to .env' });
  }

  const context = buildGoalContext(objective, targetDate);
  const systemPrompt = PROMPTS.goal_plan;

  try {
    const raw = await claudeChat(
      `${systemPrompt}\n\n${context}`,
      `Objective: ${objective}${targetDate ? `\nDeadline: ${targetDate}` : ''}`
    );

    let parsed: any;
    try {
      let jsonStr = raw.trim();
      // Strip markdown fences (Claude sometimes wraps with ```json ... ```)
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      }
      // Fallback: extract from first { to last }
      if (!jsonStr.startsWith('{')) {
        const first = jsonStr.indexOf('{');
        const last = jsonStr.lastIndexOf('}');
        if (first >= 0 && last > first) jsonStr = jsonStr.slice(first, last + 1);
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ error: 'Claude did not generate valid JSON. Try again.' });
    }

    if (!parsed.title || !Array.isArray(parsed.phases) || parsed.phases.length === 0) {
      return res.status(502).json({ error: 'Invalid guide structure. Try again.' });
    }

    const saveGoal = db.transaction(() => {
      const goalResult = db.prepare(`
        INSERT INTO goals (title, description, target_date, prerequisites, common_mistakes, estimated_timeline, ai_model, raw_ai_response)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parsed.title,
        parsed.description ?? null,
        targetDate || '',
        JSON.stringify(Array.isArray(parsed.prerequisites) ? parsed.prerequisites : []),
        JSON.stringify(Array.isArray(parsed.common_mistakes) ? parsed.common_mistakes : []),
        parsed.estimated_timeline ?? null,
        CLAUDE_MODEL,
        raw
      );

      const goalId = goalResult.lastInsertRowid as number;
      const insertPhase = db.prepare(`
        INSERT INTO goal_milestones (goal_id, week_number, title, description, target, workouts, duration, tips, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < parsed.phases.length; i++) {
        const p = parsed.phases[i];
        insertPhase.run(
          goalId,
          p.phase ?? i + 1,
          p.title ?? `Phase ${i + 1}`,
          p.description ?? null,
          p.success_criteria ?? null,
          JSON.stringify(Array.isArray(p.key_exercises) ? p.key_exercises : []),
          p.duration ?? null,
          JSON.stringify(Array.isArray(p.tips) ? p.tips : []),
          i
        );
      }

      return goalId;
    });

    const goalId = saveGoal();
    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as any;
    const milestones = db.prepare('SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY sort_order').all(goalId) as any[];

    res.json({ ...goal, milestones });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/goals
router.get('/', (req, res) => {
  const goals = db.prepare(`
    SELECT g.*,
      COALESCE(COUNT(m.id), 0) as milestone_count,
      COALESCE(SUM(m.completed), 0) as completed_count
    FROM goals g
    LEFT JOIN goal_milestones m ON m.goal_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all() as any[];
  res.json(goals);
});

// GET /api/goals/:id
router.get('/:id', (req, res) => {
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id) as any;
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const milestones = db.prepare('SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY sort_order').all(req.params.id) as any[];
  res.json({ ...goal, milestones });
});

// PUT /api/goals/:id
router.put('/:id', (req, res) => {
  const updates: string[] = [];
  const values: any[] = [];

  if (req.body.title !== undefined) { updates.push('title = ?'); values.push(req.body.title); }
  if (req.body.description !== undefined) { updates.push('description = ?'); values.push(req.body.description); }
  if (req.body.status !== undefined) { updates.push('status = ?'); values.push(req.body.status); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);

  db.prepare(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id) as any;
  res.json(goal);
});

// DELETE /api/goals/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/goals/:goalId/milestones/:milestoneId
router.put('/:goalId/milestones/:milestoneId', (req, res) => {
  const { completed } = req.body;
  const completedAt = completed ? new Date().toISOString() : null;
  db.prepare(`
    UPDATE goal_milestones SET completed = ?, completed_at = ? WHERE id = ? AND goal_id = ?
  `).run(completed ? 1 : 0, completedAt, req.params.milestoneId, req.params.goalId);
  const milestone = db.prepare('SELECT * FROM goal_milestones WHERE id = ?').get(req.params.milestoneId) as any;
  res.json(milestone);
});

export default router;
