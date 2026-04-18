// ai/context.ts — Context builders by analysis mode (async, Drizzle)

import { desc, eq, inArray, sql, and, gte, lte } from 'drizzle-orm';
import db from '../db/client.js';
import {
  activities as activitiesTable,
  sleep as sleepTable,
  hrv as hrvTable,
  stress as stressTable,
  daily_summary,
} from '../db/schema/garmin.js';
import { sport_groups, weekly_plan } from '../db/schema/core.js';
import { user_assessment, user_profile } from '../db/schema/profile.js';
import { training_plans, training_sessions } from '../db/schema/training.js';
import { nutrition_logs } from '../db/schema/nutrition.js';
import { computeInsights } from '../insights/index.js';

export interface AnalyzePayload {
  activityId?: string;
  groupId?: string;
  period?: string;
  month?: string;
}

// --- Session context: individual activity + comparison ---
async function buildSessionContext(payload: AnalyzePayload, userId: string): Promise<string> {
  const { activityId } = payload;
  if (!activityId) return '';

  const [row] = await db.select().from(activitiesTable)
    .where(and(eq(activitiesTable.user_id, userId), eq(activitiesTable.garmin_id, activityId))).limit(1);
  if (!row) return 'Activity not found.';

  const raw = JSON.parse(row.raw_json ?? '{}');
  const dur = row.duration ? Math.round(row.duration / 60) : null;
  const dist = row.distance ? (row.distance / 1000).toFixed(1) : null;
  const maxSpd = row.max_speed ? (row.max_speed * 3.6).toFixed(1) : null;

  const hrZones = [1, 2, 3, 4, 5].map(z => ({
    zone: z,
    seconds: Math.round(raw[`hrTimeInZone_${z}`] ?? 0),
  }));
  const totalZoneSec = hrZones.reduce((s, z) => s + z.seconds, 0);
  const zoneStr = hrZones.map(z =>
    `Z${z.zone}: ${Math.round(z.seconds / 60)}min (${totalZoneSec > 0 ? Math.round(z.seconds / totalZoneSec * 100) : 0}%)`
  ).join(', ');

  const sections: string[] = [];
  sections.push(`## Session analyzed
Sport: ${row.sport_type}
Date: ${row.start_time.split('T')[0]}
Duration: ${dur ? `${dur}min` : '-'}
Distance: ${dist ? `${dist}km` : '-'}
Max speed: ${maxSpd ? `${maxSpd}km/h` : '-'}
Avg speed: ${raw.averageSpeed ? `${(raw.averageSpeed * 3.6).toFixed(1)}km/h` : '-'}
Avg HR: ${row.avg_hr ? `${row.avg_hr}bpm` : '-'}
Max HR: ${raw.maxHR ?? '-'}bpm
Calories: ${row.calories ?? '-'}
HR zones: ${zoneStr}
Aerobic Training Effect: ${raw.aerobicTrainingEffect ?? '-'}
Anaerobic Training Effect: ${raw.anaerobicTrainingEffect ?? '-'}
Training load: ${raw.activityTrainingLoad ? Math.round(raw.activityTrainingLoad) : '-'}
Location: ${raw.locationName ?? '-'}`);

  const recentSame = await db.select({
    duration: activitiesTable.duration,
    distance: activitiesTable.distance,
    avg_hr: activitiesTable.avg_hr,
    max_speed: activitiesTable.max_speed,
    calories: activitiesTable.calories,
  }).from(activitiesTable)
    .where(and(
      eq(activitiesTable.user_id, userId),
      eq(activitiesTable.sport_type, row.sport_type),
      sql`${activitiesTable.garmin_id} != ${activityId}`,
    ))
    .orderBy(desc(activitiesTable.start_time))
    .limit(10);

  if (recentSame.length >= 2) {
    const avgDur = Math.round(recentSame.reduce((s, r) => s + (r.duration ?? 0), 0) / recentSame.length / 60);
    const withHr = recentSame.filter(r => r.avg_hr);
    const avgHr = withHr.length > 0 ? Math.round(withHr.reduce((s, r) => s + r.avg_hr!, 0) / withHr.length) : null;
    const withDist = recentSame.filter(r => r.distance);
    const avgDist = withDist.length > 0 ? withDist.reduce((s, r) => s + r.distance!, 0) / withDist.length / 1000 : 0;

    sections.push(`## User averages in ${row.sport_type} (last ${recentSame.length} sessions)
Average duration: ${avgDur}min
Habitual avg HR: ${avgHr ? `${avgHr}bpm` : '-'}
Average distance: ${avgDist > 0 ? `${avgDist.toFixed(1)}km` : '-'}`);
  }

  return sections.join('\n\n');
}

// --- Sleep context ---
async function buildSleepContext(payload: AnalyzePayload, userId: string): Promise<string> {
  const limit = payload.period === 'monthly' ? 30 : 14;
  const sections: string[] = [];

  const sleepRows = await db.select({
    date: sleepTable.date,
    score: sleepTable.score,
    duration_seconds: sleepTable.duration_seconds,
    deep_seconds: sleepTable.deep_seconds,
    light_seconds: sleepTable.light_seconds,
    rem_seconds: sleepTable.rem_seconds,
    awake_seconds: sleepTable.awake_seconds,
    hrv: hrvTable.nightly_avg,
    hrv_status: hrvTable.status,
  }).from(sleepTable)
    .leftJoin(hrvTable, and(eq(sleepTable.date, hrvTable.date), eq(hrvTable.user_id, userId)))
    .where(and(eq(sleepTable.user_id, userId), sql`${sleepTable.score} IS NOT NULL`))
    .orderBy(desc(sleepTable.date))
    .limit(limit);

  if (sleepRows.length > 0) {
    const lines = sleepRows.map(s => {
      const dur = s.duration_seconds ? `${Math.floor(s.duration_seconds / 3600)}h${Math.round((s.duration_seconds % 3600) / 60)}m` : '-';
      const deep = s.deep_seconds ? `${Math.round(s.deep_seconds / 60)}min` : '-';
      const rem = s.rem_seconds ? `${Math.round(s.rem_seconds / 60)}min` : '-';
      const light = s.light_seconds ? `${Math.round(s.light_seconds / 60)}min` : '-';
      const hrv = s.hrv ? `${Number(s.hrv).toFixed(0)}ms` : '-';
      return `${s.date} | score:${s.score} | total:${dur} | deep:${deep} | REM:${rem} | light:${light} | HRV:${hrv}`;
    });
    sections.push(`## Sleep (last ${sleepRows.length} nights)\nDate | Score | Total | Deep | REM | Light | HRV\n${lines.join('\n')}`);

    const scores = sleepRows.map(s => s.score!);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    sections.push(`## Summary: avg score ${avg}, min ${Math.min(...scores)}, max ${Math.max(...scores)}`);
  }

  return sections.join('\n\n');
}

// --- Wellness context ---
async function buildWellnessContext(payload: AnalyzePayload, userId: string): Promise<string> {
  const limit = payload.period === 'monthly' ? 30 : 14;
  const sections: string[] = [];

  const hrvRows = await db.select({
    date: hrvTable.date, nightly_avg: hrvTable.nightly_avg, status: hrvTable.status,
  }).from(hrvTable)
    .where(and(eq(hrvTable.user_id, userId), sql`${hrvTable.nightly_avg} IS NOT NULL`))
    .orderBy(desc(hrvTable.date)).limit(limit);

  const stressRows = await db.select({
    date: stressTable.date, avg_stress: stressTable.avg_stress, max_stress: stressTable.max_stress,
  }).from(stressTable)
    .where(and(eq(stressTable.user_id, userId), sql`${stressTable.avg_stress} IS NOT NULL`))
    .orderBy(desc(stressTable.date)).limit(limit);

  const summaryRows = await db.select({
    date: daily_summary.date, steps: daily_summary.steps, resting_hr: daily_summary.resting_hr,
  }).from(daily_summary)
    .where(and(eq(daily_summary.user_id, userId), sql`${daily_summary.steps} IS NOT NULL`))
    .orderBy(desc(daily_summary.date)).limit(limit);

  if (hrvRows.length > 0) {
    const lines = hrvRows.map(h => `${h.date} | HRV:${Number(h.nightly_avg).toFixed(0)}ms | status:${h.status || '-'}`);
    sections.push(`## HRV\n${lines.join('\n')}`);
  }
  if (stressRows.length > 0) {
    const lines = stressRows.map(s => `${s.date} | avg stress:${s.avg_stress} | max:${s.max_stress}`);
    sections.push(`## Stress\n${lines.join('\n')}`);
  }
  if (summaryRows.length > 0) {
    const lines = summaryRows.map(s => `${s.date} | steps:${s.steps} | resting HR:${s.resting_hr ?? '-'}bpm`);
    sections.push(`## Daily activity\n${lines.join('\n')}`);
  }

  return sections.join('\n\n');
}

// --- Sport group context ---
async function buildSportContext(payload: AnalyzePayload, userId: string): Promise<string> {
  const { groupId } = payload;
  if (!groupId) return '';

  const [group] = await db.select().from(sport_groups)
    .where(and(eq(sport_groups.user_id, userId), eq(sport_groups.id, groupId))).limit(1);
  if (!group) return 'Sport group not found.';

  const sportTypes: string[] = group.sport_types as string[];
  if (sportTypes.length === 0) return `## Group: ${group.name}\nNo sports assigned.`;

  const acts = await db.select({
    sport_type: activitiesTable.sport_type,
    start_time: activitiesTable.start_time,
    duration: activitiesTable.duration,
    distance: activitiesTable.distance,
    calories: activitiesTable.calories,
    avg_hr: activitiesTable.avg_hr,
    max_speed: activitiesTable.max_speed,
  }).from(activitiesTable)
    .where(and(eq(activitiesTable.user_id, userId), inArray(activitiesTable.sport_type, sportTypes)))
    .orderBy(desc(activitiesTable.start_time))
    .limit(30);

  const sections: string[] = [];
  sections.push(`## Group: ${group.name} (${group.subtitle})\nSports included: ${sportTypes.join(', ')}`);

  if (acts.length > 0) {
    const lines = acts.map(a => {
      const date = a.start_time.slice(0, 10);
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
      const spd = a.max_speed ? `${(a.max_speed * 3.6).toFixed(1)}km/h` : '-';
      return `${date} | ${a.sport_type} | ${dur} | ${dist} | velMax:${spd} | FC:${a.avg_hr ?? '-'}bpm | ${a.calories ?? '-'}kcal`;
    });
    sections.push(`## Recent sessions (${acts.length})\n${lines.join('\n')}`);

    const totalDur = acts.reduce((s, a) => s + (a.duration ?? 0), 0);
    const totalDist = acts.reduce((s, a) => s + (a.distance ?? 0), 0);
    const withHr = acts.filter(a => a.avg_hr);
    const avgHr = withHr.length > 0 ? Math.round(withHr.reduce((s, a) => s + a.avg_hr!, 0) / withHr.length) : null;
    sections.push(`## Aggregated stats
Total sessions: ${acts.length}
Total duration: ${Math.round(totalDur / 60)}min
Total distance: ${(totalDist / 1000).toFixed(1)}km
Avg HR: ${avgHr ? `${avgHr}bpm` : '-'}`);

    const fastest = acts.filter(a => a.max_speed).sort((a, b) => b.max_speed! - a.max_speed!)[0];
    const longest = acts.filter(a => a.duration).sort((a, b) => b.duration! - a.duration!)[0];
    if (fastest || longest) {
      const bests: string[] = [];
      if (fastest) bests.push(`Max speed: ${(fastest.max_speed! * 3.6).toFixed(1)}km/h (${fastest.start_time.slice(0, 10)})`);
      if (longest) bests.push(`Longest session: ${Math.round(longest.duration! / 60)}min (${longest.start_time.slice(0, 10)})`);
      sections.push(`## Personal records\n${bests.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

// --- Monthly summary context ---
async function buildMonthlyContext(payload: AnalyzePayload, userId: string): Promise<string> {
  const month = payload.month || new Date().toISOString().slice(0, 7);
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;
  const sections: string[] = [];

  const acts = await db.select({
    sport_type: activitiesTable.sport_type,
    start_time: activitiesTable.start_time,
    duration: activitiesTable.duration,
    distance: activitiesTable.distance,
    calories: activitiesTable.calories,
    avg_hr: activitiesTable.avg_hr,
  }).from(activitiesTable)
    .where(and(
      eq(activitiesTable.user_id, userId),
      gte(activitiesTable.start_time, `${startDate}T00:00:00`),
      lte(activitiesTable.start_time, `${endDate}T23:59:59`),
    ))
    .orderBy(activitiesTable.start_time);

  if (acts.length > 0) {
    const bySport: Record<string, typeof acts> = {};
    for (const a of acts) {
      if (!bySport[a.sport_type]) bySport[a.sport_type] = [];
      bySport[a.sport_type].push(a);
    }
    const sportSummaries = Object.entries(bySport).map(([sport, sessActs]) => {
      const totalDur = sessActs.reduce((s, a) => s + (a.duration ?? 0), 0);
      const totalDist = sessActs.reduce((s, a) => s + (a.distance ?? 0), 0);
      return `${sport}: ${sessActs.length} sessions, ${Math.round(totalDur / 60)}min total${totalDist > 0 ? `, ${(totalDist / 1000).toFixed(1)}km` : ''}`;
    });
    sections.push(`## Training for month ${month}\nTotal: ${acts.length} sessions\n${sportSummaries.join('\n')}`);
    const trainingDays = new Set(acts.map(a => a.start_time.slice(0, 10)));
    sections.push(`Days trained: ${trainingDays.size}`);
  } else {
    sections.push(`## Month ${month}\nNo activities recorded.`);
  }

  const sleepRows = await db.select({ score: sleepTable.score, duration_seconds: sleepTable.duration_seconds })
    .from(sleepTable)
    .where(and(
      eq(sleepTable.user_id, userId),
      gte(sleepTable.date, startDate),
      lte(sleepTable.date, endDate),
      sql`${sleepTable.score} IS NOT NULL`,
    ));

  if (sleepRows.length > 0) {
    const avgScore = Math.round(sleepRows.reduce((s, r) => s + r.score!, 0) / sleepRows.length);
    const avgDur = Math.round(sleepRows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / sleepRows.length / 3600 * 10) / 10;
    sections.push(`## Sleep for month\nAvg score: ${avgScore}\nAvg duration: ${avgDur}h`);
  }

  const stressRows = await db.select({ avg_stress: stressTable.avg_stress })
    .from(stressTable)
    .where(and(
      eq(stressTable.user_id, userId),
      gte(stressTable.date, startDate),
      lte(stressTable.date, endDate),
      sql`${stressTable.avg_stress} IS NOT NULL`,
    ));

  if (stressRows.length > 0) {
    const avgStress = Math.round(stressRows.reduce((s, r) => s + r.avg_stress!, 0) / stressRows.length);
    sections.push(`## Stress for month\nAvg stress: ${avgStress}`);
  }

  return sections.join('\n\n');
}

// --- Daily briefing context (uses computeInsights) ---
async function buildDailyContext(userId: string): Promise<string> {
  const { stats, recommendations } = await computeInsights(userId);
  const sections: string[] = [];

  sections.push(`## Current status
Last night's sleep: score ${stats.sleep.current ?? 'no data'} (baseline: ${stats.sleep.baseline ?? '-'}, trend: ${stats.sleep.trend})
HRV: ${stats.hrv.current ? `${stats.hrv.current.toFixed(0)}ms` : 'no data'} (baseline: ${stats.hrv.baseline ? stats.hrv.baseline.toFixed(0) + 'ms' : '-'}, trend: ${stats.hrv.trend}, status: ${stats.hrv.status ?? '-'})
Stress: ${stats.stress.current ?? 'no data'} (baseline: ${stats.stress.baseline ?? '-'}, trend: ${stats.stress.trend})
Resting HR: ${stats.restingHR.current ?? 'no data'}bpm (7d avg: ${stats.restingHR.avg7d ?? '-'}bpm, trend: ${stats.restingHR.trend})
Load 3d: ${stats.trainingLoad.last3d}min | Load 7d: ${stats.trainingLoad.last7d}min`);

  if (recommendations.length > 0) {
    const recStr = recommendations.map(r => `- [${r.priority}] ${r.title}: ${r.description}`).join('\n');
    sections.push(`## Insights engine alerts\n${recStr}`);
  }

  const todayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];
  const plans = await db.select({ sport: weekly_plan.sport, detail: weekly_plan.detail, completed: weekly_plan.completed })
    .from(weekly_plan)
    .where(and(eq(weekly_plan.user_id, userId), eq(weekly_plan.day, todayName)));
  if (plans.length > 0) {
    const planStr = plans.map(p => `- ${p.sport}${p.detail ? `: ${p.detail}` : ''} ${p.completed ? '✓' : '○'}`).join('\n');
    sections.push(`## Plan for today (${todayName})\n${planStr}`);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const [nutritionToday] = await db.select({
    cals: sql<number>`SUM(${nutrition_logs.calories})`,
    prot: sql<number>`SUM(${nutrition_logs.protein_g})`,
    carbs: sql<number>`SUM(${nutrition_logs.carbs_g})`,
    fat: sql<number>`SUM(${nutrition_logs.fat_g})`,
    meals: sql<number>`COUNT(*)`,
  }).from(nutrition_logs)
    .where(and(eq(nutrition_logs.user_id, userId), eq(nutrition_logs.date, todayStr)));

  if (nutritionToday?.meals > 0) {
    sections.push(`## Today's nutrition\n${nutritionToday.meals} meals | ${nutritionToday.cals || 0}kcal | prot:${nutritionToday.prot || 0}g | carbs:${nutritionToday.carbs || 0}g | fat:${nutritionToday.fat || 0}g`);
  }

  return sections.join('\n\n');
}

// --- User assessment context ---
export async function getAssessmentContext(userId: string): Promise<string> {
  const [row] = await db.select().from(user_assessment)
    .where(eq(user_assessment.user_id, userId)).limit(1);
  if (!row) return '';

  const lines: string[] = [];
  if (row.name) lines.push(`Name: ${row.name}`);
  if (row.age) lines.push(`Age: ${row.age} years`);
  if (row.height) lines.push(`Height: ${row.height} cm`);
  if (row.weight) lines.push(`Weight: ${row.weight} kg`);
  if (row.fitness_level) lines.push(`Fitness level: ${row.fitness_level}`);

  const goals = row.goals as string[] | null;
  if (goals?.length) lines.push(`Training goals: ${goals.join(', ')}`);
  if (row.goals_other) lines.push(`Other goals: ${row.goals_other}`);
  if (row.sport_practice) lines.push(`Practices sports: ${row.sport_practice}`);
  if (row.sport_name) lines.push(`Sports practiced: ${row.sport_name}`);

  const availDays = row.available_days as string[] | null;
  if (availDays?.length) lines.push(`Available training days: ${availDays.join(', ')}`);
  if (row.session_duration) lines.push(`Available session duration: ${row.session_duration} minutes`);

  const equipment = row.equipment as string[] | null;
  if (equipment?.length) lines.push(`Available equipment: ${equipment.join(', ')}`);
  if (row.equipment_other) lines.push(`Additional equipment: ${row.equipment_other}`);
  if (row.injuries_limitations) lines.push(`Current injuries/limitations: ${row.injuries_limitations}`);
  if (row.training_preferences) lines.push(`Training preferences: ${row.training_preferences}`);
  if (row.past_injuries_detail) lines.push(`Injury history: ${row.past_injuries_detail}`);
  if (row.time_constraints) lines.push(`Time constraints: ${row.time_constraints}`);
  if (row.short_term_goals) lines.push(`Short-term goals: ${row.short_term_goals}`);
  if (row.long_term_goals) lines.push(`Long-term goals: ${row.long_term_goals}`);
  if (row.special_considerations) lines.push(`Special considerations: ${row.special_considerations}`);

  if (lines.length === 0) return '';
  return `## User profile\n${lines.join('\n')}`;
}

// --- Training plan context ---
export async function buildTrainingContext(goal: string, userId: string): Promise<string> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sections: string[] = [];

  const assessmentCtx = await getAssessmentContext(userId);
  if (assessmentCtx) sections.push(assessmentCtx);

  sections.push(`## User's goal\n${goal}`);

  const acts = await db.select({
    sport_type: activitiesTable.sport_type,
    start_time: activitiesTable.start_time,
    duration: activitiesTable.duration,
    distance: activitiesTable.distance,
    avg_hr: activitiesTable.avg_hr,
    max_speed: activitiesTable.max_speed,
    calories: activitiesTable.calories,
  }).from(activitiesTable)
    .where(and(eq(activitiesTable.user_id, userId), gte(activitiesTable.start_time, `${cutoff}T00:00:00`)))
    .orderBy(desc(activitiesTable.start_time))
    .limit(40);

  if (acts.length > 0) {
    const lines = acts.map(a => {
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
      const spd = a.max_speed ? `${(a.max_speed * 3.6).toFixed(1)}km/h` : '-';
      return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${dist} | maxSpd:${spd} | HR:${a.avg_hr ?? '-'}bpm`;
    });
    sections.push(`## Recent activities (30 days)\nDate | Sport | Duration | Distance | MaxSpd | AvgHR\n${lines.join('\n')}`);
  }

  const groups = await db.select({ name: sport_groups.name, sport_types: sport_groups.sport_types })
    .from(sport_groups).where(eq(sport_groups.user_id, userId)).orderBy(sport_groups.sort_order);
  if (groups.length > 0) {
    const groupStr = groups.map(g => `- ${g.name}: ${(g.sport_types as string[]).join(', ')}`).join('\n');
    sections.push(`## User's sport categories\n${groupStr}`);
  }

  const sleepRows = await db.select({
    date: sleepTable.date, score: sleepTable.score, duration_seconds: sleepTable.duration_seconds,
    deep_seconds: sleepTable.deep_seconds, rem_seconds: sleepTable.rem_seconds,
  }).from(sleepTable)
    .where(and(eq(sleepTable.user_id, userId), gte(sleepTable.date, cutoff), sql`${sleepTable.score} IS NOT NULL`))
    .orderBy(desc(sleepTable.date)).limit(14);

  if (sleepRows.length > 0) {
    const avgScore = Math.round(sleepRows.reduce((s, r) => s + r.score!, 0) / sleepRows.length);
    const lines = sleepRows.slice(0, 7).map(s => {
      const dur = s.duration_seconds ? `${Math.floor(s.duration_seconds / 3600)}h${Math.round((s.duration_seconds % 3600) / 60)}m` : '-';
      return `${s.date} | score:${s.score} | total:${dur}`;
    });
    sections.push(`## Recent sleep (avg score: ${avgScore})\n${lines.join('\n')}`);
  }

  const hrvRows = await db.select({ date: hrvTable.date, nightly_avg: hrvTable.nightly_avg, status: hrvTable.status })
    .from(hrvTable)
    .where(and(eq(hrvTable.user_id, userId), gte(hrvTable.date, cutoff), sql`${hrvTable.nightly_avg} IS NOT NULL`))
    .orderBy(desc(hrvTable.date)).limit(7);

  if (hrvRows.length > 0) {
    const avgHrv = (hrvRows.reduce((s, r) => s + r.nightly_avg!, 0) / hrvRows.length).toFixed(1);
    sections.push(`## Recent HRV (avg: ${avgHrv}ms)\n${hrvRows.map(h => `${h.date} | ${Number(h.nightly_avg).toFixed(1)}ms | ${h.status ?? '-'}`).join('\n')}`);
  }

  const stressRows = await db.select({ date: stressTable.date, avg_stress: stressTable.avg_stress })
    .from(stressTable)
    .where(and(eq(stressTable.user_id, userId), gte(stressTable.date, cutoff), sql`${stressTable.avg_stress} IS NOT NULL`))
    .orderBy(desc(stressTable.date)).limit(7);

  if (stressRows.length > 0) {
    const avgStress = Math.round(stressRows.reduce((s, r) => s + r.avg_stress!, 0) / stressRows.length);
    sections.push(`## Recent stress (avg: ${avgStress})\n${stressRows.map(s => `${s.date} | ${s.avg_stress}`).join('\n')}`);
  }

  const [nutritionRow] = await db.select({
    cals: sql<number>`SUM(${nutrition_logs.calories})`,
    prot: sql<number>`SUM(${nutrition_logs.protein_g})`,
    carbs: sql<number>`SUM(${nutrition_logs.carbs_g})`,
    fat: sql<number>`SUM(${nutrition_logs.fat_g})`,
    days: sql<number>`COUNT(DISTINCT ${nutrition_logs.date})`,
  }).from(nutrition_logs)
    .where(and(eq(nutrition_logs.user_id, userId), gte(nutrition_logs.date, cutoff)));

  if (nutritionRow?.days > 0) {
    const avgCals = Math.round(nutritionRow.cals / nutritionRow.days);
    const avgProt = Math.round(nutritionRow.prot / nutritionRow.days);
    const avgCarbs = Math.round(nutritionRow.carbs / nutritionRow.days);
    const avgFat = Math.round(nutritionRow.fat / nutritionRow.days);
    sections.push(`## Average nutritional intake (${nutritionRow.days} days with records)\n${avgCals}kcal/day | prot:${avgProt}g | carbs:${avgCarbs}g | fat:${avgFat}g`);
  }

  return sections.join('\n\n');
}

// --- Goal plan context ---
export async function buildGoalContext(objective: string, userId: string, targetDate?: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sections: string[] = [];

  const assessmentCtx = await getAssessmentContext(userId);
  if (assessmentCtx) sections.push(assessmentCtx);

  sections.push(`## User's goal\n${objective}`);

  if (targetDate) {
    const targetMs = new Date(targetDate + 'T12:00:00').getTime();
    const todayMs = new Date(today + 'T12:00:00').getTime();
    const weeksUntilTarget = Math.max(1, Math.round((targetMs - todayMs) / (7 * 24 * 60 * 60 * 1000)));
    sections.push(`## Timeline information\nToday's date: ${today}\nTarget date (approximate): ${targetDate}\nApproximate weeks available: ${weeksUntilTarget}\nTake this timeline into account when defining the duration of each phase.`);
  } else {
    sections.push(`## Timeline information\nToday's date: ${today}\nNo target date defined. Use realistic durations for the goal.`);
  }

  const acts = await db.select({
    sport_type: activitiesTable.sport_type,
    start_time: activitiesTable.start_time,
    duration: activitiesTable.duration,
    distance: activitiesTable.distance,
    avg_hr: activitiesTable.avg_hr,
  }).from(activitiesTable)
    .where(and(eq(activitiesTable.user_id, userId), gte(activitiesTable.start_time, `${cutoff}T00:00:00`)))
    .orderBy(desc(activitiesTable.start_time))
    .limit(30);

  if (acts.length > 0) {
    const lines = acts.map(a => {
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
      return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${dist} | FC:${a.avg_hr ?? '-'}bpm`;
    });
    sections.push(`## Recent activities (30 days)\n${lines.join('\n')}`);
  }

  const groups = await db.select({ name: sport_groups.name, sport_types: sport_groups.sport_types })
    .from(sport_groups).where(eq(sport_groups.user_id, userId)).orderBy(sport_groups.sort_order);
  if (groups.length > 0) {
    const groupStr = groups.map(g => `- ${g.name}: ${(g.sport_types as string[]).join(', ')}`).join('\n');
    sections.push(`## User's sports\n${groupStr}`);
  }

  const sleepRows = await db.select({ date: sleepTable.date, score: sleepTable.score })
    .from(sleepTable)
    .where(and(eq(sleepTable.user_id, userId), gte(sleepTable.date, cutoff), sql`${sleepTable.score} IS NOT NULL`))
    .orderBy(desc(sleepTable.date)).limit(7);

  if (sleepRows.length > 0) {
    const avgScore = Math.round(sleepRows.reduce((s, r) => s + r.score!, 0) / sleepRows.length);
    sections.push(`## Recent sleep (avg score: ${avgScore})\n${sleepRows.map(s => `${s.date} | score:${s.score}`).join('\n')}`);
  }

  const hrvRows = await db.select({ date: hrvTable.date, nightly_avg: hrvTable.nightly_avg, status: hrvTable.status })
    .from(hrvTable)
    .where(and(eq(hrvTable.user_id, userId), gte(hrvTable.date, cutoff), sql`${hrvTable.nightly_avg} IS NOT NULL`))
    .orderBy(desc(hrvTable.date)).limit(7);

  if (hrvRows.length > 0) {
    const avgHrv = (hrvRows.reduce((s, r) => s + r.nightly_avg!, 0) / hrvRows.length).toFixed(1);
    sections.push(`## Recent HRV (avg: ${avgHrv}ms)\n${hrvRows.map(h => `${h.date} | ${Number(h.nightly_avg).toFixed(1)}ms | ${h.status ?? '-'}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

// --- Main dispatcher ---
export type AnalyzeMode = 'session' | 'sleep' | 'wellness' | 'sport' | 'monthly' | 'daily';

export async function buildAnalyzeContext(mode: AnalyzeMode, payload: AnalyzePayload, userId: string): Promise<string> {
  const modeContext = await (async () => {
    switch (mode) {
      case 'session': return buildSessionContext(payload, userId);
      case 'sleep': return buildSleepContext(payload, userId);
      case 'wellness': return buildWellnessContext(payload, userId);
      case 'sport': return buildSportContext(payload, userId);
      case 'monthly': return buildMonthlyContext(payload, userId);
      case 'daily': return buildDailyContext(userId);
      default: return '';
    }
  })();

  const assessmentCtx = await getAssessmentContext(userId);
  if (!assessmentCtx) return modeContext;
  return modeContext ? `${assessmentCtx}\n\n${modeContext}` : assessmentCtx;
}

// Cache key generation
export function getCacheKey(mode: AnalyzeMode, payload: AnalyzePayload, userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = userId.slice(0, 8);
  switch (mode) {
    case 'session': return `${prefix}:session:${payload.activityId}`;
    case 'sleep': return `${prefix}:sleep:${payload.period ?? 'weekly'}:${today}`;
    case 'wellness': return `${prefix}:wellness:${payload.period ?? 'weekly'}:${today}`;
    case 'sport': return `${prefix}:sport:${payload.groupId}:${payload.period ?? 'total'}:${today}`;
    case 'monthly': return `${prefix}:monthly:${payload.month || today.slice(0, 7)}`;
    case 'daily': return `${prefix}:daily:${today}`;
  }
}
