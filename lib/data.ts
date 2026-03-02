/**
 * Unified data layer — switches between mock data and Garmin Connect
 * based on the USE_GARMIN environment variable.
 *
 * All functions are async so pages don't need to change if the source changes.
 * Set USE_GARMIN=true in .env.local to use real Garmin data.
 */

import type {
  Activity,
  DailyHealthMetrics,
  WeeklyStats,
  SportCategory,
  SportCategorySummary,
  MonthlyStats,
  SleepTrendSummary,
} from "@/types/fitness";
import { ACTIVITY_CATEGORY_MAP } from "@/types/fitness";
import {
  activities as mockActivities,
  healthMetrics as mockHealthMetrics,
  weeklyStats as mockWeeklyStats,
} from "@/lib/mock-data";
import {
  fetchActivities,
  fetchHealthMetrics,
  fetchHealthMetricsRange,
  fetchWeeklyStats,
} from "@/lib/garmin/client";

const USE_GARMIN = process.env.USE_GARMIN === "true";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ─── Activities ──────────────────────────────────────────────────────────────

export async function getActivities(days = 60): Promise<Activity[]> {
  if (USE_GARMIN) return fetchActivities(days);
  return mockActivities;
}

export async function getActivityById(id: string): Promise<Activity | undefined> {
  if (USE_GARMIN) {
    const acts = await fetchActivities(60);
    return acts.find((a) => a.id === id);
  }
  return mockActivities.find((a) => a.id === id);
}

export async function getRecentActivities(count = 5): Promise<Activity[]> {
  const acts = await getActivities();
  return [...acts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, count);
}

// ─── Health metrics ──────────────────────────────────────────────────────────

export async function getTodayMetrics(): Promise<DailyHealthMetrics> {
  if (USE_GARMIN) return fetchHealthMetrics(todayISO());
  return mockHealthMetrics[0];
}

export async function getHealthMetrics(days = 28): Promise<DailyHealthMetrics[]> {
  if (USE_GARMIN) {
    return fetchHealthMetricsRange(dateNDaysAgo(days - 1), todayISO());
  }
  return mockHealthMetrics.slice(0, days);
}

// ─── Weekly stats ─────────────────────────────────────────────────────────────

export async function getWeeklyStats(weeks = 4): Promise<WeeklyStats[]> {
  if (USE_GARMIN) return fetchWeeklyStats(weeks);
  return mockWeeklyStats.slice(0, weeks);
}

export async function getCurrentWeekStats(): Promise<WeeklyStats> {
  const stats = await getWeeklyStats();
  return stats[0];
}

export async function getPreviousWeekStats(): Promise<WeeklyStats> {
  const stats = await getWeeklyStats();
  return stats[1] ?? stats[0];
}

// ─── Analytics: Sport Category Summaries ─────────────────────────────────────

const CATEGORY_LABELS: Record<SportCategory, string> = {
  gym: "Gym",
  water_sports: "Water Sports",
  tennis: "Tennis",
  running: "Running",
  cycling: "Cycling",
  hiking: "Hiking",
};

// Inline map so this function doesn't depend on import order at runtime
const TYPE_TO_CATEGORY: Record<string, SportCategory> = {
  strength: "gym", cardio: "gym", swimming: "gym",
  running: "running", cycling: "cycling", hiking: "hiking",
  surf: "water_sports", wingfoil: "water_sports", windsurf: "water_sports",
  kiteboard: "water_sports", stand_up_paddling: "water_sports", open_water_swimming: "water_sports",
  tennis: "tennis", padel: "tennis", squash: "tennis",
};

export async function getSportCategorySummaries(days = 30): Promise<SportCategorySummary[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const acts = await getActivities(days);
  const recent = acts.filter((a) => new Date(a.date) >= cutoff);

  // Build 4-week buckets (oldest first)
  const now = new Date();
  const weekBuckets: Activity[][] = [[], [], [], []];
  for (const act of recent) {
    const daysAgo = Math.floor((now.getTime() - new Date(act.date).getTime()) / (1000 * 60 * 60 * 24));
    const weekIdx = Math.min(3, Math.floor(daysAgo / 7));
    weekBuckets[3 - weekIdx].push(act);
  }

  // Aggregate by category
  const byCategory = new Map<SportCategory, {
    sessions: number;
    totalDuration: number;
    totalCalories: number;
    totalHR: number;
    hrCount: number;
    weekCounts: number[];
  }>();

  for (const act of recent) {
    const cat: SportCategory = TYPE_TO_CATEGORY[act.type] ?? "gym";
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { sessions: 0, totalDuration: 0, totalCalories: 0, totalHR: 0, hrCount: 0, weekCounts: [0, 0, 0, 0] });
    }
    const entry = byCategory.get(cat)!;
    entry.sessions++;
    entry.totalDuration += act.duration;
    entry.totalCalories += act.calories;
    if (act.avgHeartRate > 0) {
      entry.totalHR += act.avgHeartRate;
      entry.hrCount++;
    }
  }

  // Weekly counts per category
  for (let w = 0; w < 4; w++) {
    for (const act of weekBuckets[w]) {
      const cat = ACTIVITY_CATEGORY_MAP[act.type] ?? "gym";
      const entry = byCategory.get(cat);
      if (entry) entry.weekCounts[w]++;
    }
  }

  const result: SportCategorySummary[] = [];
  for (const [category, data] of byCategory.entries()) {
    if (data.sessions === 0) continue;
    result.push({
      category,
      label: CATEGORY_LABELS[category],
      sessions: data.sessions,
      totalDuration: data.totalDuration,
      totalCalories: data.totalCalories,
      avgHeartRate: data.hrCount > 0 ? Math.round(data.totalHR / data.hrCount) : 0,
      weeklySessionCounts: data.weekCounts,
    });
  }

  // Sort by total duration descending
  return result.sort((a, b) => b.totalDuration - a.totalDuration);
}

// ─── Analytics: Monthly Stats ─────────────────────────────────────────────────

export async function getMonthlyStats(months = 3): Promise<MonthlyStats[]> {
  const acts = await getActivities(months * 31);

  const byMonth = new Map<string, MonthlyStats>();

  for (const act of acts) {
    const month = act.date.slice(0, 7); // "YYYY-MM"
    if (!byMonth.has(month)) {
      byMonth.set(month, { month, totalSessions: 0, totalDuration: 0, totalCalories: 0, byCategory: {} });
    }
    const entry = byMonth.get(month)!;
    entry.totalSessions++;
    entry.totalDuration += act.duration;
    entry.totalCalories += act.calories;

    const cat = ACTIVITY_CATEGORY_MAP[act.type] ?? "gym";
    if (!entry.byCategory[cat]) {
      entry.byCategory[cat] = { sessions: 0, duration: 0 };
    }
    entry.byCategory[cat]!.sessions++;
    entry.byCategory[cat]!.duration += act.duration;
  }

  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, months);
}

// ─── Analytics: Sleep Trend ───────────────────────────────────────────────────

export async function getSleepTrendSummary(days = 14): Promise<SleepTrendSummary> {
  const metrics = await getHealthMetrics(days);
  const trends = metrics
    .slice(0, days)
    .map((m) => ({ date: m.date, sleepScore: m.sleepScore, sleepHours: m.sleepHours }))
    .reverse(); // chronological order

  const avgScore = Math.round(trends.reduce((s, t) => s + t.sleepScore, 0) / (trends.length || 1));
  const avgHours = Math.round((trends.reduce((s, t) => s + t.sleepHours, 0) / (trends.length || 1)) * 10) / 10;

  // Trend: compare first half vs second half avg
  const half = Math.floor(trends.length / 2);
  const firstHalfAvg = trends.slice(0, half).reduce((s, t) => s + t.sleepScore, 0) / (half || 1);
  const secondHalfAvg = trends.slice(half).reduce((s, t) => s + t.sleepScore, 0) / ((trends.length - half) || 1);
  const diff = secondHalfAvg - firstHalfAvg;
  const trend: "improving" | "declining" | "stable" = diff > 3 ? "improving" : diff < -3 ? "declining" : "stable";

  return { trends, avgScore, avgHours, trend };
}

// ─── Re-export formatting utilities (unchanged) ───────────────────────────────

export { formatPace, formatDuration } from "@/lib/mock-data";
