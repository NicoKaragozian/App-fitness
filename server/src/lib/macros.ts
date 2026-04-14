// lib/macros.ts — Calculadora de macronutrientes (Mifflin-St Jeor BMR)

interface MacroInput {
  sex: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  training_days_per_week: number;
  primary_goal: string;
}

interface MacroTargets {
  daily_calorie_target: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
}

export function computeMacroTargets(p: MacroInput): MacroTargets {
  // BMR con formula Mifflin-St Jeor
  const bmr =
    p.sex === 'female'
      ? 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age - 161
      : 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + 5;

  // Factor de actividad (1.2 sedentario → 1.725 muy activo)
  const activityFactor = Math.min(1.725, 1.2 + (p.training_days_per_week || 0) * 0.075);
  let tdee = bmr * activityFactor;

  // Ajuste por objetivo
  if (p.primary_goal === 'fat_loss') tdee -= 400;
  if (p.primary_goal === 'hypertrophy' || p.primary_goal === 'strength') tdee += 250;
  if (p.primary_goal === 'endurance') tdee += 150;

  const calories = Math.round(tdee);

  // Macros: proteina 2g/kg, grasa 25% TDEE, resto carbs
  const protein_g = Math.round(p.weight_kg * 2.0);
  const fat_g = Math.round((tdee * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((tdee - protein_g * 4 - fat_g * 9) / 4));

  return {
    daily_calorie_target: calories,
    daily_protein_g: protein_g,
    daily_carbs_g: carbs_g,
    daily_fat_g: fat_g,
  };
}
