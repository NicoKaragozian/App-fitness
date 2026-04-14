// ai/context.ts — Context builders por modo de análisis

import db from '../db.js';
import { computeInsights } from '../insights/index.js';

interface AnalyzePayload {
  activityId?: string;
  groupId?: string;
  period?: string;
  month?: string;
}

// --- Session context: actividad individual + comparación ---
function buildSessionContext(payload: AnalyzePayload): string {
  const { activityId } = payload;
  if (!activityId) return '';

  const row = db.prepare('SELECT * FROM activities WHERE garmin_id = ?').get(activityId) as any;
  if (!row) return 'Actividad no encontrada.';

  const raw = JSON.parse(row.raw_json ?? '{}');
  const dur = row.duration ? Math.round(row.duration / 60) : null;
  const dist = row.distance ? (row.distance / 1000).toFixed(1) : null;
  const maxSpd = row.max_speed ? (row.max_speed * 3.6).toFixed(1) : null;

  // HR zones
  const hrZones = [1, 2, 3, 4, 5].map(z => ({
    zone: z,
    seconds: Math.round(raw[`hrTimeInZone_${z}`] ?? 0),
  }));
  const totalZoneSec = hrZones.reduce((s, z) => s + z.seconds, 0);
  const zoneStr = hrZones.map(z =>
    `Z${z.zone}: ${Math.round(z.seconds / 60)}min (${totalZoneSec > 0 ? Math.round(z.seconds / totalZoneSec * 100) : 0}%)`
  ).join(', ');

  const sections: string[] = [];
  sections.push(`## Sesión analizada
Deporte: ${row.sport_type}
Fecha: ${row.start_time.split('T')[0]}
Duración: ${dur ? `${dur}min` : '-'}
Distancia: ${dist ? `${dist}km` : '-'}
Vel. Máx: ${maxSpd ? `${maxSpd}km/h` : '-'}
Vel. Prom: ${raw.averageSpeed ? `${(raw.averageSpeed * 3.6).toFixed(1)}km/h` : '-'}
FC Promedio: ${row.avg_hr ? `${row.avg_hr}bpm` : '-'}
FC Máxima: ${raw.maxHR ?? '-'}bpm
Calorías: ${row.calories ?? '-'}
Zonas FC: ${zoneStr}
Training Effect Aeróbico: ${raw.aerobicTrainingEffect ?? '-'}
Training Effect Anaeróbico: ${raw.anaerobicTrainingEffect ?? '-'}
Carga de entrenamiento: ${raw.activityTrainingLoad ? Math.round(raw.activityTrainingLoad) : '-'}
Lugar: ${raw.locationName ?? '-'}`);

  // Comparison with recent sessions of the same sport
  const recentSame = db.prepare(`
    SELECT duration, distance, avg_hr, max_speed, calories
    FROM activities WHERE sport_type = ? AND garmin_id != ?
    ORDER BY start_time DESC LIMIT 10
  `).all(row.sport_type, activityId) as any[];

  if (recentSame.length >= 2) {
    const avgDur = Math.round(recentSame.reduce((s: number, r: any) => s + (r.duration ?? 0), 0) / recentSame.length / 60);
    const avgHr = Math.round(recentSame.filter((r: any) => r.avg_hr).reduce((s: number, r: any) => s + r.avg_hr, 0) / recentSame.filter((r: any) => r.avg_hr).length) || null;
    const avgDist = recentSame.filter((r: any) => r.distance).reduce((s: number, r: any) => s + r.distance, 0) / recentSame.filter((r: any) => r.distance).length / 1000;

    sections.push(`## Promedios del usuario en ${row.sport_type} (últimas ${recentSame.length} sesiones)
Duración promedio: ${avgDur}min
FC promedio habitual: ${avgHr ? `${avgHr}bpm` : '-'}
Distancia promedio: ${avgDist > 0 ? `${avgDist.toFixed(1)}km` : '-'}`);
  }

  return sections.join('\n\n');
}

// --- Sleep context ---
function buildSleepContext(payload: AnalyzePayload): string {
  const limit = payload.period === 'monthly' ? 30 : 14;
  const sections: string[] = [];

  const sleepRows = db.prepare(`
    SELECT s.date, s.score, s.duration_seconds, s.deep_seconds, s.light_seconds, s.rem_seconds, s.awake_seconds,
           h.nightly_avg as hrv, h.status as hrv_status
    FROM sleep s LEFT JOIN hrv h ON s.date = h.date
    WHERE s.score IS NOT NULL ORDER BY s.date DESC LIMIT ?
  `).all(limit) as any[];

  if (sleepRows.length > 0) {
    const lines = sleepRows.map(s => {
      const dur = s.duration_seconds ? `${Math.floor(s.duration_seconds / 3600)}h${Math.round((s.duration_seconds % 3600) / 60)}m` : '-';
      const deep = s.deep_seconds ? `${Math.round(s.deep_seconds / 60)}min` : '-';
      const rem = s.rem_seconds ? `${Math.round(s.rem_seconds / 60)}min` : '-';
      const light = s.light_seconds ? `${Math.round(s.light_seconds / 60)}min` : '-';
      const hrv = s.hrv ? `${Number(s.hrv).toFixed(0)}ms` : '-';
      return `${s.date} | score:${s.score} | total:${dur} | profundo:${deep} | REM:${rem} | ligero:${light} | HRV:${hrv}`;
    });
    sections.push(`## Sueño (últimas ${sleepRows.length} noches)\nFecha | Score | Total | Profundo | REM | Ligero | HRV\n${lines.join('\n')}`);

    // Stats summary
    const scores = sleepRows.map(s => s.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    sections.push(`## Resumen: score promedio ${avg}, mín ${min}, máx ${max}`);
  }

  return sections.join('\n\n');
}

// --- Wellness context ---
function buildWellnessContext(payload: AnalyzePayload): string {
  const limit = payload.period === 'monthly' ? 30 : 14;
  const sections: string[] = [];

  const hrv = db.prepare(`
    SELECT date, nightly_avg, status FROM hrv
    WHERE nightly_avg IS NOT NULL ORDER BY date DESC LIMIT ?
  `).all(limit) as any[];

  const stress = db.prepare(`
    SELECT date, avg_stress, max_stress FROM stress
    WHERE avg_stress IS NOT NULL ORDER BY date DESC LIMIT ?
  `).all(limit) as any[];

  const summary = db.prepare(`
    SELECT date, steps, resting_hr FROM daily_summary
    WHERE steps IS NOT NULL ORDER BY date DESC LIMIT ?
  `).all(limit) as any[];

  if (hrv.length > 0) {
    const lines = hrv.map(h => `${h.date} | HRV:${Number(h.nightly_avg).toFixed(0)}ms | estado:${h.status || '-'}`);
    sections.push(`## HRV\n${lines.join('\n')}`);
  }
  if (stress.length > 0) {
    const lines = stress.map(s => `${s.date} | estrés prom:${s.avg_stress} | máx:${s.max_stress}`);
    sections.push(`## Estrés\n${lines.join('\n')}`);
  }
  if (summary.length > 0) {
    const lines = summary.map(s => `${s.date} | pasos:${s.steps} | FC reposo:${s.resting_hr ?? '-'}bpm`);
    sections.push(`## Actividad diaria\n${lines.join('\n')}`);
  }

  return sections.join('\n\n');
}

// --- Sport group context ---
function buildSportContext(payload: AnalyzePayload): string {
  const { groupId } = payload;
  if (!groupId) return '';

  const group = db.prepare('SELECT * FROM sport_groups WHERE id = ?').get(groupId) as any;
  if (!group) return 'Grupo de deportes no encontrado.';

  const sportTypes: string[] = JSON.parse(group.sport_types);
  const placeholders = sportTypes.map(() => '?').join(',');

  const activities = db.prepare(`
    SELECT sport_type, start_time, duration, distance, calories, avg_hr, max_speed
    FROM activities WHERE sport_type IN (${placeholders})
    ORDER BY start_time DESC LIMIT 30
  `).all(...sportTypes) as any[];

  const sections: string[] = [];
  sections.push(`## Grupo: ${group.name} (${group.subtitle})\nDeportes incluidos: ${sportTypes.join(', ')}`);

  if (activities.length > 0) {
    const lines = activities.map(a => {
      const date = a.start_time.slice(0, 10);
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
      const spd = a.max_speed ? `${(a.max_speed * 3.6).toFixed(1)}km/h` : '-';
      return `${date} | ${a.sport_type} | ${dur} | ${dist} | velMax:${spd} | FC:${a.avg_hr ?? '-'}bpm | ${a.calories ?? '-'}kcal`;
    });
    sections.push(`## Sesiones recientes (${activities.length})\n${lines.join('\n')}`);

    // Aggregate stats
    const totalDur = activities.reduce((s: number, a: any) => s + (a.duration ?? 0), 0);
    const totalDist = activities.reduce((s: number, a: any) => s + (a.distance ?? 0), 0);
    const avgHr = Math.round(activities.filter((a: any) => a.avg_hr).reduce((s: number, a: any) => s + a.avg_hr, 0) / activities.filter((a: any) => a.avg_hr).length) || null;
    sections.push(`## Stats agregadas
Total sesiones: ${activities.length}
Duración total: ${Math.round(totalDur / 60)}min
Distancia total: ${(totalDist / 1000).toFixed(1)}km
FC promedio: ${avgHr ? `${avgHr}bpm` : '-'}`);

    // Personal bests
    const fastest = activities.filter((a: any) => a.max_speed).sort((a: any, b: any) => b.max_speed - a.max_speed)[0];
    const longest = activities.filter((a: any) => a.duration).sort((a: any, b: any) => b.duration - a.duration)[0];
    if (fastest || longest) {
      const bests: string[] = [];
      if (fastest) bests.push(`Vel. máx: ${(fastest.max_speed * 3.6).toFixed(1)}km/h (${fastest.start_time.slice(0, 10)})`);
      if (longest) bests.push(`Sesión más larga: ${Math.round(longest.duration / 60)}min (${longest.start_time.slice(0, 10)})`);
      sections.push(`## Records personales\n${bests.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

// --- Monthly summary context ---
function buildMonthlyContext(payload: AnalyzePayload): string {
  const month = payload.month || new Date().toISOString().slice(0, 7); // YYYY-MM
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;
  const sections: string[] = [];

  // Activities in the month
  const activities = db.prepare(`
    SELECT sport_type, start_time, duration, distance, calories, avg_hr
    FROM activities WHERE start_time >= ? AND start_time <= ?
    ORDER BY start_time
  `).all(startDate + 'T00:00:00', endDate + 'T23:59:59') as any[];

  if (activities.length > 0) {
    // Group by sport type
    const bySport: Record<string, any[]> = {};
    for (const a of activities) {
      if (!bySport[a.sport_type]) bySport[a.sport_type] = [];
      bySport[a.sport_type].push(a);
    }
    const sportSummaries = Object.entries(bySport).map(([sport, acts]) => {
      const totalDur = acts.reduce((s, a) => s + (a.duration ?? 0), 0);
      const totalDist = acts.reduce((s, a) => s + (a.distance ?? 0), 0);
      return `${sport}: ${acts.length} sesiones, ${Math.round(totalDur / 60)}min total${totalDist > 0 ? `, ${(totalDist / 1000).toFixed(1)}km` : ''}`;
    });
    sections.push(`## Entrenamiento del mes ${month}\nTotal: ${activities.length} sesiones\n${sportSummaries.join('\n')}`);

    // Training days distribution
    const trainingDays = new Set(activities.map(a => a.start_time.slice(0, 10)));
    sections.push(`Días entrenados: ${trainingDays.size}`);
  } else {
    sections.push(`## Mes ${month}\nNo hay actividades registradas.`);
  }

  // Sleep averages for the month
  const sleepRows = db.prepare(`
    SELECT score, duration_seconds FROM sleep
    WHERE date >= ? AND date <= ? AND score IS NOT NULL
  `).all(startDate, endDate) as any[];

  if (sleepRows.length > 0) {
    const avgScore = Math.round(sleepRows.reduce((s: number, r: any) => s + r.score, 0) / sleepRows.length);
    const avgDur = Math.round(sleepRows.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0) / sleepRows.length / 3600 * 10) / 10;
    sections.push(`## Sueño del mes\nScore promedio: ${avgScore}\nDuración promedio: ${avgDur}h`);
  }

  // Stress average
  const stressRows = db.prepare(`
    SELECT avg_stress FROM stress WHERE date >= ? AND date <= ? AND avg_stress IS NOT NULL
  `).all(startDate, endDate) as any[];

  if (stressRows.length > 0) {
    const avgStress = Math.round(stressRows.reduce((s: number, r: any) => s + r.avg_stress, 0) / stressRows.length);
    sections.push(`## Estrés del mes\nEstrés promedio: ${avgStress}`);
  }

  return sections.join('\n\n');
}

// --- Daily briefing context (uses computeInsights) ---
function buildDailyContext(): string {
  const { stats, recommendations } = computeInsights();
  const sections: string[] = [];

  sections.push(`## Estado actual
Sueño anoche: score ${stats.sleep.current ?? 'sin datos'} (baseline: ${stats.sleep.baseline ?? '-'}, tendencia: ${stats.sleep.trend})
HRV: ${stats.hrv.current ? `${stats.hrv.current.toFixed(0)}ms` : 'sin datos'} (baseline: ${stats.hrv.baseline ? stats.hrv.baseline.toFixed(0) + 'ms' : '-'}, tendencia: ${stats.hrv.trend}, estado: ${stats.hrv.status ?? '-'})
Estrés: ${stats.stress.current ?? 'sin datos'} (baseline: ${stats.stress.baseline ?? '-'}, tendencia: ${stats.stress.trend})
FC reposo: ${stats.restingHR.current ?? 'sin datos'}bpm (prom 7d: ${stats.restingHR.avg7d ?? '-'}bpm, tendencia: ${stats.restingHR.trend})
Carga 3d: ${stats.trainingLoad.last3d}min | Carga 7d: ${stats.trainingLoad.last7d}min`);

  if (recommendations.length > 0) {
    const recStr = recommendations.map(r => `- [${r.priority}] ${r.title}: ${r.description}`).join('\n');
    sections.push(`## Alertas del motor de reglas\n${recStr}`);
  }

  // Today's plan
  const todayName = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][new Date().getDay()];
  const plans = db.prepare('SELECT sport, detail, completed FROM weekly_plan WHERE day = ?').all(todayName) as any[];
  if (plans.length > 0) {
    const planStr = plans.map(p => `- ${p.sport}${p.detail ? `: ${p.detail}` : ''} ${p.completed ? '✓' : '○'}`).join('\n');
    sections.push(`## Plan para hoy (${todayName})\n${planStr}`);
  }

  // Nutricion de hoy
  const todayStr = new Date().toISOString().slice(0, 10);
  const nutritionToday = db.prepare(`
    SELECT SUM(calories) as cals, SUM(protein_g) as prot, SUM(carbs_g) as carbs, SUM(fat_g) as fat, COUNT(*) as meals
    FROM nutrition_logs WHERE date = ?
  `).get(todayStr) as any;
  if (nutritionToday?.meals > 0) {
    sections.push(`## Nutrición de hoy\n${nutritionToday.meals} comidas | ${nutritionToday.cals || 0}kcal | prot:${nutritionToday.prot || 0}g | carbs:${nutritionToday.carbs || 0}g | grasa:${nutritionToday.fat || 0}g`);
  }

  return sections.join('\n\n');
}

// --- User assessment context ---
export function getAssessmentContext(): string {
  const row = db.prepare('SELECT * FROM user_assessment WHERE id = 1').get() as any;
  if (!row) return '';

  const lines: string[] = [];
  if (row.name) lines.push(`Nombre: ${row.name}`);
  if (row.age) lines.push(`Edad: ${row.age} años`);
  if (row.height) lines.push(`Altura: ${row.height} cm`);
  if (row.weight) lines.push(`Peso: ${row.weight} kg`);
  if (row.fitness_level) lines.push(`Nivel fitness: ${row.fitness_level}`);

  if (row.goals) {
    try { const g = JSON.parse(row.goals); if (g.length > 0) lines.push(`Objetivos de entrenamiento: ${g.join(', ')}`); } catch {}
  }
  if (row.goals_other) lines.push(`Otros objetivos: ${row.goals_other}`);
  if (row.sport_practice) lines.push(`Practica deportes: ${row.sport_practice}`);
  if (row.sport_name) lines.push(`Deportes que practica: ${row.sport_name}`);

  if (row.available_days) {
    try { const d = JSON.parse(row.available_days); if (d.length > 0) lines.push(`Días disponibles para entrenar: ${d.join(', ')}`); } catch {}
  }
  if (row.session_duration) lines.push(`Duración de sesión disponible: ${row.session_duration} minutos`);

  if (row.equipment) {
    try { const e = JSON.parse(row.equipment); if (e.length > 0) lines.push(`Equipamiento disponible: ${e.join(', ')}`); } catch {}
  }
  if (row.equipment_other) lines.push(`Equipamiento adicional: ${row.equipment_other}`);
  if (row.injuries_limitations) lines.push(`Lesiones/limitaciones actuales: ${row.injuries_limitations}`);
  if (row.training_preferences) lines.push(`Preferencias de entrenamiento: ${row.training_preferences}`);
  if (row.past_injuries_detail) lines.push(`Historial de lesiones: ${row.past_injuries_detail}`);
  if (row.time_constraints) lines.push(`Restricciones de tiempo: ${row.time_constraints}`);
  if (row.short_term_goals) lines.push(`Metas a corto plazo: ${row.short_term_goals}`);
  if (row.long_term_goals) lines.push(`Metas a largo plazo: ${row.long_term_goals}`);
  if (row.special_considerations) lines.push(`Consideraciones especiales: ${row.special_considerations}`);

  if (lines.length === 0) return '';
  return `## Perfil del usuario\n${lines.join('\n')}`;
}

// --- Training plan context ---
export function buildTrainingContext(goal: string): string {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sections: string[] = [];

  const assessmentCtx = getAssessmentContext();
  if (assessmentCtx) sections.push(assessmentCtx);

  sections.push(`## Objetivo del usuario\n${goal}`);

  // Activities
  const activities = db.prepare(`
    SELECT sport_type, start_time, duration, distance, avg_hr, max_speed, calories
    FROM activities WHERE start_time >= ? ORDER BY start_time DESC LIMIT 40
  `).all(cutoff + 'T00:00:00') as any[];
  if (activities.length > 0) {
    const lines = activities.map((a: any) => {
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
      const spd = a.max_speed ? `${(a.max_speed * 3.6).toFixed(1)}km/h` : '-';
      return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${dist} | velMax:${spd} | FC:${a.avg_hr ?? '-'}bpm`;
    });
    sections.push(`## Actividades recientes (30 días)\nFecha | Deporte | Duración | Distancia | VelMax | FC.Prom\n${lines.join('\n')}`);
  }

  // Sport groups (para saber categorías del usuario)
  const groups = db.prepare('SELECT name, sport_types FROM sport_groups ORDER BY sort_order').all() as any[];
  if (groups.length > 0) {
    const groupStr = groups.map((g: any) => {
      const types = JSON.parse(g.sport_types ?? '[]').join(', ');
      return `- ${g.name}: ${types}`;
    }).join('\n');
    sections.push(`## Categorías de deportes del usuario\n${groupStr}`);
  }

  // Sleep (últimas 2 semanas)
  const sleep = db.prepare(`
    SELECT date, score, duration_seconds, deep_seconds, rem_seconds
    FROM sleep WHERE date >= ? AND score IS NOT NULL ORDER BY date DESC LIMIT 14
  `).all(cutoff) as any[];
  if (sleep.length > 0) {
    const avgScore = Math.round(sleep.reduce((s: number, r: any) => s + r.score, 0) / sleep.length);
    const lines = sleep.slice(0, 7).map((s: any) => {
      const dur = s.duration_seconds ? `${Math.floor(s.duration_seconds / 3600)}h${Math.round((s.duration_seconds % 3600) / 60)}m` : '-';
      return `${s.date} | score:${s.score} | total:${dur}`;
    });
    sections.push(`## Sueño reciente (score promedio: ${avgScore})\n${lines.join('\n')}`);
  }

  // HRV
  const hrv = db.prepare(`
    SELECT date, nightly_avg, status FROM hrv
    WHERE date >= ? AND nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 7
  `).all(cutoff) as any[];
  if (hrv.length > 0) {
    const avgHrv = (hrv.reduce((s: number, r: any) => s + r.nightly_avg, 0) / hrv.length).toFixed(1);
    sections.push(`## HRV reciente (promedio: ${avgHrv}ms)\n${hrv.map((h: any) => `${h.date} | ${Number(h.nightly_avg).toFixed(1)}ms | ${h.status ?? '-'}`).join('\n')}`);
  }

  // Stress
  const stress = db.prepare(`
    SELECT date, avg_stress FROM stress
    WHERE date >= ? AND avg_stress IS NOT NULL ORDER BY date DESC LIMIT 7
  `).all(cutoff) as any[];
  if (stress.length > 0) {
    const avgStress = Math.round(stress.reduce((s: number, r: any) => s + r.avg_stress, 0) / stress.length);
    sections.push(`## Estrés reciente (promedio: ${avgStress})\n${stress.map((s: any) => `${s.date} | ${s.avg_stress}`).join('\n')}`);
  }

  // Ingesta nutricional promedio 7 dias (relevante para training plan — proteina/kg)
  const nutritionRows = db.prepare(`
    SELECT SUM(calories) as cals, SUM(protein_g) as prot, SUM(carbs_g) as carbs, SUM(fat_g) as fat, COUNT(DISTINCT date) as days
    FROM nutrition_logs WHERE date >= ?
  `).get(cutoff) as any;
  if (nutritionRows?.days > 0) {
    const avgCals = Math.round(nutritionRows.cals / nutritionRows.days);
    const avgProt = Math.round(nutritionRows.prot / nutritionRows.days);
    const avgCarbs = Math.round(nutritionRows.carbs / nutritionRows.days);
    const avgFat = Math.round(nutritionRows.fat / nutritionRows.days);
    sections.push(`## Ingesta nutricional promedio (${nutritionRows.days} dias con registro)\n${avgCals}kcal/dia | prot:${avgProt}g | carbs:${avgCarbs}g | grasa:${avgFat}g`);
  }

  return sections.join('\n\n');
}

// --- Goal plan context ---
export function buildGoalContext(objective: string, targetDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const targetMs = new Date(targetDate + 'T12:00:00').getTime();
  const todayMs = new Date(today + 'T12:00:00').getTime();
  const weeksUntilTarget = Math.max(1, Math.round((targetMs - todayMs) / (7 * 24 * 60 * 60 * 1000)));

  const sections: string[] = [];

  const assessmentCtx = getAssessmentContext();
  if (assessmentCtx) sections.push(assessmentCtx);

  sections.push(`## Objetivo del usuario\n${objective}`);
  sections.push(`## Información temporal\nFecha de hoy: ${today}\nFecha límite: ${targetDate}\nSemanas disponibles: ${weeksUntilTarget}\nNOTA: Generá EXACTAMENTE ${weeksUntilTarget} milestones, uno por semana.`);

  const activities = db.prepare(`
    SELECT sport_type, start_time, duration, distance, avg_hr
    FROM activities WHERE start_time >= ? ORDER BY start_time DESC LIMIT 30
  `).all(cutoff + 'T00:00:00') as any[];
  if (activities.length > 0) {
    const lines = activities.map((a: any) => {
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      const dist = a.distance ? `${(a.distance / 1000).toFixed(1)}km` : '-';
      return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${dist} | FC:${a.avg_hr ?? '-'}bpm`;
    });
    sections.push(`## Actividades recientes (30 días)\n${lines.join('\n')}`);
  }

  const groups = db.prepare('SELECT name, sport_types FROM sport_groups ORDER BY sort_order').all() as any[];
  if (groups.length > 0) {
    const groupStr = groups.map((g: any) => `- ${g.name}: ${JSON.parse(g.sport_types ?? '[]').join(', ')}`).join('\n');
    sections.push(`## Deportes del usuario\n${groupStr}`);
  }

  const sleep = db.prepare(`
    SELECT date, score FROM sleep WHERE date >= ? AND score IS NOT NULL ORDER BY date DESC LIMIT 7
  `).all(cutoff) as any[];
  if (sleep.length > 0) {
    const avgScore = Math.round(sleep.reduce((s: number, r: any) => s + r.score, 0) / sleep.length);
    sections.push(`## Sueño reciente (score promedio: ${avgScore})\n${sleep.map((s: any) => `${s.date} | score:${s.score}`).join('\n')}`);
  }

  const hrv = db.prepare(`
    SELECT date, nightly_avg, status FROM hrv
    WHERE date >= ? AND nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 7
  `).all(cutoff) as any[];
  if (hrv.length > 0) {
    const avgHrv = (hrv.reduce((s: number, r: any) => s + r.nightly_avg, 0) / hrv.length).toFixed(1);
    sections.push(`## HRV reciente (promedio: ${avgHrv}ms)\n${hrv.map((h: any) => `${h.date} | ${Number(h.nightly_avg).toFixed(1)}ms | ${h.status ?? '-'}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

// --- Main dispatcher ---
export type AnalyzeMode = 'session' | 'sleep' | 'wellness' | 'sport' | 'monthly' | 'daily';

export function buildAnalyzeContext(mode: AnalyzeMode, payload: AnalyzePayload): string {
  const modeContext = (() => {
    switch (mode) {
      case 'session': return buildSessionContext(payload);
      case 'sleep': return buildSleepContext(payload);
      case 'wellness': return buildWellnessContext(payload);
      case 'sport': return buildSportContext(payload);
      case 'monthly': return buildMonthlyContext(payload);
      case 'daily': return buildDailyContext();
      default: return '';
    }
  })();

  const assessmentCtx = getAssessmentContext();
  if (!assessmentCtx) return modeContext;
  return modeContext ? `${assessmentCtx}\n\n${modeContext}` : assessmentCtx;
}

// Cache key generation
export function getCacheKey(mode: AnalyzeMode, payload: AnalyzePayload): string {
  const today = new Date().toISOString().slice(0, 10);
  switch (mode) {
    case 'session': return `session:${payload.activityId}`;
    case 'sleep': return `sleep:${payload.period ?? 'weekly'}:${today}`;
    case 'wellness': return `wellness:${payload.period ?? 'weekly'}:${today}`;
    case 'sport': return `sport:${payload.groupId}:${payload.period ?? 'total'}:${today}`;
    case 'monthly': return `monthly:${payload.month || today.slice(0, 7)}`;
    case 'daily': return `daily:${today}`;
  }
}
