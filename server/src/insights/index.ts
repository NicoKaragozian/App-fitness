// insights/index.ts — Orquestador: consulta DB, computa stats, evalúa reglas

import db from '../db.js';
import {
  rollingAverage, mean, standardDeviation, zScore, trend,
  consecutiveTrainingDays, daysSinceLastTraining, trainingLoad,
} from './stats.js';
import { evaluateRules, type InsightStats, type Recommendation } from './rules.js';

interface InsightsResult {
  recommendations: Recommendation[];
  stats: {
    sleep: { current: number | null; baseline: number | null; trend: string };
    hrv: { current: number | null; baseline: number | null; trend: string; status: string | null };
    stress: { current: number | null; baseline: number | null; trend: string };
    restingHR: { current: number | null; avg7d: number | null; trend: string };
    trainingLoad: { last3d: number; last7d: number };
  };
}

export function computeInsights(): InsightsResult {
  const today = new Date().toISOString().slice(0, 10);

  // --- Sueño (últimos 30 días) ---
  const sleepRows = db.prepare(
    `SELECT date, score FROM sleep WHERE score IS NOT NULL ORDER BY date DESC LIMIT 30`
  ).all() as { date: string; score: number }[];

  const sleepValues = [...sleepRows].reverse().map(r => r.score);
  const sleepToday = sleepRows[0]?.score ?? null;
  const sleep7d = sleepValues.length >= 3 ? rollingAverage(sleepValues, 7) : null;
  const sleepBaseline = sleepValues.length >= 3 ? mean(sleepValues) : null;
  const sleepStddev = sleepValues.length >= 3 ? standardDeviation(sleepValues) : null;
  const sleepZScore = (sleepToday !== null && sleepBaseline !== null && sleepStddev !== null)
    ? zScore(sleepToday, sleepBaseline, sleepStddev)
    : null;
  const sleepTrend = sleepValues.length >= 5 ? trend(sleepValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };

  // --- HRV (últimos 30 días) ---
  const hrvRows = db.prepare(
    `SELECT date, nightly_avg, status FROM hrv WHERE nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 30`
  ).all() as { date: string; nightly_avg: number; status: string }[];

  const hrvValues = [...hrvRows].reverse().map(r => r.nightly_avg);
  const hrvToday = hrvRows[0]?.nightly_avg ?? null;
  const hrv7d = hrvValues.length >= 3 ? rollingAverage(hrvValues, 7) : null;
  const hrvBaseline = hrvValues.length >= 3 ? mean(hrvValues) : null;
  const hrvStddev = hrvValues.length >= 3 ? standardDeviation(hrvValues) : null;
  const hrvZScore = (hrvToday !== null && hrvBaseline !== null && hrvStddev !== null)
    ? zScore(hrvToday, hrvBaseline, hrvStddev)
    : null;
  const hrvTrend = hrvValues.length >= 5 ? trend(hrvValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };
  const hrvStatus = hrvRows[0]?.status ?? null;

  // --- Stress (últimos 30 días) ---
  const stressRows = db.prepare(
    `SELECT date, avg_stress FROM stress WHERE avg_stress IS NOT NULL ORDER BY date DESC LIMIT 30`
  ).all() as { date: string; avg_stress: number }[];

  const stressValues = [...stressRows].reverse().map(r => r.avg_stress);
  const stressToday = stressRows[0]?.avg_stress ?? null;
  const stress7d = stressValues.length >= 3 ? rollingAverage(stressValues, 7) : null;
  const stressBaseline = stressValues.length >= 3 ? mean(stressValues) : null;
  // Para stress: "improving" en la pendiente = valores BAJANDO (mejor). Invertimos la señal.
  const stressTrendRaw = stressValues.length >= 5 ? trend(stressValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };
  const stressTrendDir = stressTrendRaw.direction === 'improving' ? 'declining'
    : stressTrendRaw.direction === 'declining' ? 'improving'
    : 'stable';

  // --- FC reposo (últimos 14 días) ---
  const hrRows = db.prepare(
    `SELECT date, resting_hr FROM daily_summary WHERE resting_hr IS NOT NULL ORDER BY date DESC LIMIT 14`
  ).all() as { date: string; resting_hr: number }[];

  const hrValues = [...hrRows].reverse().map(r => r.resting_hr);
  const hrToday = hrRows[0]?.resting_hr ?? null;
  const hr7d = hrValues.length >= 3 ? rollingAverage(hrValues, 7) : null;
  // Para resting HR: pendiente positiva = mala señal (HR sube)
  const hrTrendRaw = hrValues.length >= 5 ? trend(hrValues.slice(-7)) : { direction: 'stable' as const, slope: 0 };

  // --- Actividades (últimos 30 días) ---
  const actRows = db.prepare(
    `SELECT date(start_time) as date, duration, avg_hr FROM activities ORDER BY start_time DESC LIMIT 100`
  ).all() as { date: string; duration: number; avg_hr: number | null }[];

  const actDates = actRows.map(r => r.date);
  const consecutiveDays = consecutiveTrainingDays(actDates);
  const daysSinceLast = daysSinceLastTraining(actDates);
  const load3d = trainingLoad(actRows, 3);
  const load7d = trainingLoad(actRows, 7);

  // --- Plan de hoy ---
  const todayName = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][new Date().getDay()];
  const planRow = db.prepare(
    `SELECT sport, detail FROM weekly_plan WHERE day = ? AND completed = 0 LIMIT 1`
  ).get(todayName) as { sport: string; detail: string | null } | undefined;
  const todayPlan = planRow ?? null;

  // --- Construir InsightStats ---
  const stats: InsightStats = {
    sleep: {
      current: sleepToday,
      avg7d: sleep7d,
      baseline: sleepBaseline,
      stddev: sleepStddev,
      zScore: sleepZScore,
      trend: sleepTrend.direction,
      values: sleepValues,
    },
    hrv: {
      current: hrvToday,
      avg7d: hrv7d,
      baseline: hrvBaseline,
      stddev: hrvStddev,
      zScore: hrvZScore,
      trend: hrvTrend.direction,
      status: hrvStatus,
      values: hrvValues,
    },
    stress: {
      current: stressToday,
      avg7d: stress7d,
      baseline: stressBaseline,
      trend: stressTrendDir,
      values: stressValues,
    },
    restingHR: {
      current: hrToday,
      avg7d: hr7d,
      trend: hrTrendRaw.direction,
      values: hrValues,
    },
    training: {
      consecutiveDays,
      daysSinceLast,
      load3d,
      load7d,
    },
    todayPlan,
  };

  const recommendations = evaluateRules(stats);

  return {
    recommendations,
    stats: {
      sleep: { current: sleepToday, baseline: sleepBaseline, trend: sleepTrend.direction },
      hrv: { current: hrvToday, baseline: hrvBaseline, trend: hrvTrend.direction, status: hrvStatus },
      stress: { current: stressToday, baseline: stressBaseline, trend: stressTrendDir },
      restingHR: { current: hrToday, avg7d: hr7d, trend: hrTrendRaw.direction },
      trainingLoad: { last3d: load3d.totalMinutes, last7d: load7d.totalMinutes },
    },
  };
}
