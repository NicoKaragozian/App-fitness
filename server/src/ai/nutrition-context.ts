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
        if (raw.preferred_foods) lines.push(`Alimentos que le gustan (incorporar, no usar exclusivamente): ${raw.preferred_foods}`);
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

// Context builder para el chat de nutricion — contexto del dia seleccionado
export function buildNutritionChatContext(date: string): string {
  const sections: string[] = [];

  sections.push(`## Fecha consultada\n${date}`);

  // Perfil y targets
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
  const targets = {
    daily_calorie_target: profile?.daily_calorie_target || 2000,
    daily_protein_g: profile?.daily_protein_g || 150,
    daily_carbs_g: profile?.daily_carbs_g || 250,
    daily_fat_g: profile?.daily_fat_g || 65,
  };

  if (profile) {
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
        dietPrefsText = lines.length > 0 ? lines.join(' | ') : 'ninguna';
      }
    } catch { /* ignorar */ }

    sections.push(`## Perfil del usuario
Peso: ${profile.weight_kg || '-'}kg | Objetivo: ${profile.primary_goal || '-'}
Preferencias: ${dietPrefsText}`);
  }

  // Comidas registradas en el dia
  const logs = db.prepare(
    'SELECT meal_slot, meal_name, calories, protein_g, carbs_g, fat_g, logged_at FROM nutrition_logs WHERE date = ? ORDER BY logged_at'
  ).all(date) as any[];

  if (logs.length > 0) {
    const totalCals = logs.reduce((s: number, l: any) => s + (l.calories || 0), 0);
    const totalProt = logs.reduce((s: number, l: any) => s + (l.protein_g || 0), 0);
    const totalCarbs = logs.reduce((s: number, l: any) => s + (l.carbs_g || 0), 0);
    const totalFat = logs.reduce((s: number, l: any) => s + (l.fat_g || 0), 0);

    const SLOT_ES: Record<string, string> = {
      breakfast: 'Desayuno', lunch: 'Almuerzo', snack: 'Snack',
      dinner: 'Cena', pre_workout: 'Pre-entreno', post_workout: 'Post-entreno',
    };

    const logLines = logs.map((l: any, i: number) => {
      const time = l.logged_at ? new Date(l.logged_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
      const slot = SLOT_ES[l.meal_slot] || l.meal_slot || '';
      return `${i + 1}. ${slot}${time ? ' (' + time + ')' : ''}: ${l.meal_name || 'Sin nombre'} — ${l.calories || 0}kcal | ${l.protein_g || 0}g prot | ${l.carbs_g || 0}g carbs | ${l.fat_g || 0}g grasa`;
    });

    const remCals = Math.max(0, targets.daily_calorie_target - totalCals);
    const remProt = Math.max(0, targets.daily_protein_g - totalProt);
    const remCarbs = Math.max(0, targets.daily_carbs_g - totalCarbs);
    const remFat = Math.max(0, targets.daily_fat_g - totalFat);

    sections.push(`## Comidas registradas hoy (${logs.length} comidas)
${logLines.join('\n')}
Total consumido: ${totalCals}kcal | ${totalProt}g prot | ${totalCarbs}g carbs | ${totalFat}g grasa`);

    sections.push(`## Objetivos diarios y macros restantes
Objetivo: ${targets.daily_calorie_target}kcal | ${targets.daily_protein_g}g prot | ${targets.daily_carbs_g}g carbs | ${targets.daily_fat_g}g grasa
Restante: ${remCals}kcal | ${remProt}g prot | ${remCarbs}g carbs | ${remFat}g grasa
Progreso: ${Math.round(totalCals / targets.daily_calorie_target * 100)}% cal | ${Math.round(totalProt / targets.daily_protein_g * 100)}% prot | ${Math.round(totalCarbs / targets.daily_carbs_g * 100)}% carbs | ${Math.round(totalFat / targets.daily_fat_g * 100)}% grasa`);
  } else {
    sections.push(`## Comidas registradas hoy\nNinguna comida registrada aún.`);
    sections.push(`## Objetivos diarios
${targets.daily_calorie_target}kcal | ${targets.daily_protein_g}g prot | ${targets.daily_carbs_g}g carbs | ${targets.daily_fat_g}g grasa`);
  }

  // Plan nutricional activo con sus comidas
  const activePlan = db.prepare(
    "SELECT id, title, strategy, daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g FROM nutrition_plans ORDER BY id DESC LIMIT 1"
  ).get() as any;

  if (activePlan) {
    const meals = db.prepare(
      'SELECT slot, option_number, name, calories, protein_g, carbs_g, fat_g FROM nutrition_plan_meals WHERE plan_id = ? ORDER BY slot, option_number'
    ).all(activePlan.id) as any[];

    const SLOT_ES: Record<string, string> = {
      breakfast: 'Desayuno', lunch: 'Almuerzo', snack: 'Snack',
      dinner: 'Cena', pre_workout: 'Pre-entreno', post_workout: 'Post-entreno',
    };

    const mealLines = meals.map((m: any) =>
      `  - ${SLOT_ES[m.slot] || m.slot} Op.${m.option_number}: ${m.name} (${m.calories}kcal | ${m.protein_g}g P | ${m.carbs_g}g C | ${m.fat_g}g G)`
    );

    sections.push(`## Plan nutricional activo: "${activePlan.title}" (${activePlan.strategy})
Objetivo del plan: ${activePlan.daily_calories}kcal | ${activePlan.daily_protein_g}g prot | ${activePlan.daily_carbs_g}g carbs | ${activePlan.daily_fat_g}g grasa
Opciones disponibles:
${mealLines.join('\n')}`);
  }

  return sections.join('\n\n');
}
