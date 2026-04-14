// ai/nutrition-context.ts — Context builder para generacion de planes nutricionales
// Consulta DB y construye un string con el perfil, training plan activo y datos recientes.

import db from '../db.js';

export function buildNutritionPlanContext(strategy?: string): string {
  const sections: string[] = [];

  // Perfil del usuario
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  if (profile) {
    const sports = JSON.parse(profile.sports || '[]');

    // Parsear preferencias: soporte para formato objeto (nuevo) y array (viejo)
    let dietPrefsText = 'ninguna';
    try {
      const raw = JSON.parse(profile.dietary_preferences || 'null');
      if (Array.isArray(raw)) {
        dietPrefsText = raw.length > 0 ? raw.join(', ') : 'ninguna';
      } else if (raw && typeof raw === 'object') {
        const lines: string[] = [];
        if (raw.diet_type) lines.push(`Tipo de dieta: ${raw.diet_type}`);
        if (raw.allergies?.length > 0) lines.push(`Alergias/intolerancias: ${raw.allergies.join(', ')}`);
        if (raw.excluded_foods) lines.push(`Alimentos excluidos: ${raw.excluded_foods}`);
        if (raw.preferred_foods) lines.push(`Alimentos preferidos: ${raw.preferred_foods}`);
        if (raw.meals_per_day) lines.push(`Comidas por día: ${raw.meals_per_day}`);
        dietPrefsText = lines.length > 0 ? '\n' + lines.map(l => `  - ${l}`).join('\n') : 'ninguna';
      }
    } catch { /* formato invalido, ignorar */ }

    sections.push(`## Perfil del usuario
Nombre: ${profile.name || 'N/A'}
Edad: ${profile.age || '-'} años | Sexo: ${profile.sex || '-'} | Altura: ${profile.height_cm || '-'}cm | Peso: ${profile.weight_kg || '-'}kg
Nivel de experiencia: ${profile.experience_level || '-'}
Objetivo principal: ${profile.primary_goal || '-'}
Deportes: ${sports.join(', ') || 'no especificado'}
Días de entrenamiento por semana: ${profile.training_days_per_week || '-'}
Preferencias dietarias: ${dietPrefsText}
Lesiones: ${profile.injuries || 'ninguna'}
Targets actuales: ${profile.daily_calorie_target || '-'}kcal | Prot: ${profile.daily_protein_g || '-'}g | Carbs: ${profile.daily_carbs_g || '-'}g | Grasa: ${profile.daily_fat_g || '-'}g`);
  } else {
    sections.push('## Perfil del usuario\nNo hay perfil configurado. Generá un plan estándar equilibrado.');
  }

  if (strategy) {
    sections.push(`## Estrategia solicitada\n${strategy}`);
  }

  // Training plan activo
  const activePlan = db.prepare(
    'SELECT tp.*, COUNT(ts.id) as session_count FROM training_plans tp LEFT JOIN training_sessions ts ON ts.plan_id = tp.id WHERE tp.status = ? GROUP BY tp.id ORDER BY tp.id DESC LIMIT 1'
  ).get('active') as any;

  if (activePlan) {
    const sessions = db.prepare('SELECT name, notes FROM training_sessions WHERE plan_id = ? ORDER BY sort_order').all(activePlan.id) as any[];
    const sessionNames = sessions.map((s: any) => s.name).join(', ');
    sections.push(`## Plan de entrenamiento activo
Titulo: ${activePlan.title}
Objetivo: ${activePlan.objective || '-'}
Frecuencia: ${activePlan.frequency || '-'}
Sesiones: ${sessionNames || '-'}`);
  }

  // Actividades recientes (7 dias) para calcular carga de entrenamiento
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const activities = db.prepare(`
    SELECT sport_type, start_time, duration, calories, avg_hr
    FROM activities WHERE start_time >= ? ORDER BY start_time DESC
  `).all(cutoff7d + 'T00:00:00') as any[];

  if (activities.length > 0) {
    const totalDur = activities.reduce((s: number, a: any) => s + (a.duration || 0), 0);
    const totalCal = activities.reduce((s: number, a: any) => s + (a.calories || 0), 0);
    const lines = activities.map((a: any) => {
      const dur = a.duration ? `${Math.round(a.duration / 60)}min` : '-';
      return `${a.start_time.slice(0, 10)} | ${a.sport_type} | ${dur} | ${a.calories || '-'}kcal`;
    });
    sections.push(`## Actividades ultimos 7 dias (${activities.length} sesiones)
Total entrenado: ${Math.round(totalDur / 60)}min | Calorias quemadas: ${totalCal}kcal
${lines.join('\n')}`);
  }

  // Ingesta promedio de los ultimos 7 dias (si hay logs de nutricion)
  const nutritionLogs = db.prepare(`
    SELECT date,
      SUM(calories) as cals, SUM(protein_g) as prot, SUM(carbs_g) as carbs, SUM(fat_g) as fat
    FROM nutrition_logs
    WHERE date >= ?
    GROUP BY date ORDER BY date DESC
  `).all(cutoff7d) as any[];

  if (nutritionLogs.length > 0) {
    const avgCals = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.cals || 0), 0) / nutritionLogs.length);
    const avgProt = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.prot || 0), 0) / nutritionLogs.length);
    const avgCarbs = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.carbs || 0), 0) / nutritionLogs.length);
    const avgFat = Math.round(nutritionLogs.reduce((s: number, r: any) => s + (r.fat || 0), 0) / nutritionLogs.length);
    sections.push(`## Ingesta promedio ultimos ${nutritionLogs.length} dias con registro
Calorias: ${avgCals}kcal | Proteina: ${avgProt}g | Carbs: ${avgCarbs}g | Grasa: ${avgFat}g`);
  } else {
    sections.push('## Ingesta reciente\nNo hay registros de nutricion previos.');
  }

  return sections.join('\n\n');
}
