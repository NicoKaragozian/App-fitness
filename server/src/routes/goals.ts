import express from 'express';
import { eq, desc, asc, sql, and } from 'drizzle-orm';
import db from '../db/client.js';
import { goals, goal_milestones } from '../db/schema/index.js';
import { buildGoalContext } from '../ai/context.js';
import { getPrompt } from '../ai/prompts.js';
import { pickProviderFromReq, pickLanguageFromReq, isAIConfigured } from '../ai/providers/index.js';
import { modelNameFor } from '../ai/config.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

router.use(requireUser);

// POST /api/goals/generate
router.post('/generate', async (req, res) => {
  const { userId } = req;
  const { objective, targetDate } = req.body;
  if (!objective?.trim()) { res.status(400).json({ error: 'objective required' }); return; }

  const provider = pickProviderFromReq(req);
  if (!(await isAIConfigured(provider.name))) {
    const label = provider.name === 'gemma' ? 'Ollama (gemma4:e2b)' : 'Claude API';
    res.status(503).json({ error: `${label} is not available. Check your setup.` }); return;
  }

  const lang = pickLanguageFromReq(req);
  const context = await buildGoalContext(objective, userId, targetDate);
  const systemPrompt = getPrompt('goal_plan', lang);

  try {
    const raw = await provider.chatJSON(
      `${systemPrompt}\n\n${context}`,
      `Objective: ${objective}${targetDate ? `\nDeadline: ${targetDate}` : ''}`
    );

    let parsed: any;
    try {
      let jsonStr = raw.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      }
      if (!jsonStr.startsWith('{')) {
        const first = jsonStr.indexOf('{');
        const last = jsonStr.lastIndexOf('}');
        if (first >= 0 && last > first) jsonStr = jsonStr.slice(first, last + 1);
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      res.status(502).json({ error: 'AI did not generate valid JSON. Try again.' }); return;
    }

    if (!parsed.title || !Array.isArray(parsed.phases) || parsed.phases.length === 0) {
      res.status(502).json({ error: 'Invalid guide structure. Try again.' }); return;
    }

    const goalId = await db.transaction(async (tx) => {
      const [goalRow] = await tx.insert(goals).values({
        title: parsed.title,
        description: parsed.description ?? null,
        target_date: targetDate || '',
        prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [],
        common_mistakes: Array.isArray(parsed.common_mistakes) ? parsed.common_mistakes : [],
        estimated_timeline: parsed.estimated_timeline ?? null,
        ai_model: modelNameFor(provider.name),
        raw_ai_response: raw,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: userId,
      }).returning({ id: goals.id });

      const gId = goalRow.id;

      for (let i = 0; i < parsed.phases.length; i++) {
        const p = parsed.phases[i];
        await tx.insert(goal_milestones).values({
          goal_id: gId,
          week_number: p.phase ?? i + 1,
          title: p.title ?? `Phase ${i + 1}`,
          description: p.description ?? null,
          target: p.success_criteria ?? null,
          workouts: Array.isArray(p.key_exercises) ? p.key_exercises : [],
          duration: p.duration ?? null,
          tips: Array.isArray(p.tips) ? p.tips : [],
          sort_order: i,
          user_id: userId,
        });
      }

      return gId;
    });

    const [goal] = await db.select().from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.user_id, userId)));
    const milestones = await db.select().from(goal_milestones)
      .where(and(eq(goal_milestones.goal_id, goalId), eq(goal_milestones.user_id, userId)))
      .orderBy(asc(goal_milestones.sort_order));

    res.json({ ...goal, milestones });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/goals
router.get('/', async (req, res) => {
  const { userId } = req;
  const rows = await db.select({
    id: goals.id,
    title: goals.title,
    description: goals.description,
    target_date: goals.target_date,
    status: goals.status,
    prerequisites: goals.prerequisites,
    common_mistakes: goals.common_mistakes,
    estimated_timeline: goals.estimated_timeline,
    ai_model: goals.ai_model,
    raw_ai_response: goals.raw_ai_response,
    created_at: goals.created_at,
    updated_at: goals.updated_at,
    milestone_count: sql<number>`COALESCE(COUNT(${goal_milestones.id}), 0)`,
    completed_count: sql<number>`COALESCE(COUNT(*) FILTER (WHERE ${goal_milestones.completed} = TRUE), 0)`,
  })
    .from(goals)
    .leftJoin(goal_milestones, eq(goal_milestones.goal_id, goals.id))
    .where(eq(goals.user_id, userId))
    .groupBy(goals.id)
    .orderBy(desc(goals.created_at));

  res.json(rows);
});

// GET /api/goals/:id
router.get('/:id', async (req, res) => {
  const { userId } = req;
  const [goal] = await db.select().from(goals)
    .where(and(eq(goals.id, parseInt(req.params.id)), eq(goals.user_id, userId)));
  if (!goal) { res.status(404).json({ error: 'Goal not found' }); return; }
  const milestones = await db.select().from(goal_milestones)
    .where(and(eq(goal_milestones.goal_id, goal.id), eq(goal_milestones.user_id, userId)))
    .orderBy(asc(goal_milestones.sort_order));
  res.json({ ...goal, milestones });
});

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  const { userId } = req;
  const updates: Partial<typeof goals.$inferInsert> = { updated_at: new Date().toISOString() };

  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.status !== undefined) updates.status = req.body.status;

  if (Object.keys(updates).length <= 1) { res.status(400).json({ error: 'No fields to update' }); return; }

  await db.update(goals).set(updates)
    .where(and(eq(goals.id, parseInt(req.params.id)), eq(goals.user_id, userId)));
  const [goal] = await db.select().from(goals)
    .where(and(eq(goals.id, parseInt(req.params.id)), eq(goals.user_id, userId)));
  res.json(goal);
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  const { userId } = req;
  await db.delete(goals)
    .where(and(eq(goals.id, parseInt(req.params.id)), eq(goals.user_id, userId)));
  res.json({ ok: true });
});

// PUT /api/goals/:goalId/milestones/:milestoneId
router.put('/:goalId/milestones/:milestoneId', async (req, res) => {
  const { userId } = req;
  const { completed } = req.body;
  const completedAt = completed ? new Date().toISOString() : null;
  await db.update(goal_milestones).set({
    completed: Boolean(completed),
    completed_at: completedAt,
  }).where(
    and(
      eq(goal_milestones.id, parseInt(req.params.milestoneId)),
      eq(goal_milestones.goal_id, parseInt(req.params.goalId)),
      eq(goal_milestones.user_id, userId),
    )
  );
  const [milestone] = await db.select().from(goal_milestones)
    .where(and(
      eq(goal_milestones.id, parseInt(req.params.milestoneId)),
      eq(goal_milestones.user_id, userId),
    ));
  res.json(milestone);
});

export default router;
