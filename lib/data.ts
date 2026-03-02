/**
 * Unified data layer — switches between mock data and Garmin Connect
 * based on the USE_GARMIN environment variable.
 *
 * All functions are async so pages don't need to change if the source changes.
 * Set USE_GARMIN=true in .env.local to use real Garmin data.
 */

import type { Activity, DailyHealthMetrics, WeeklyStats } from "@/types/fitness";
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

// ─── Re-export formatting utilities (unchanged) ───────────────────────────────

export { formatPace, formatDuration } from "@/lib/mock-data";
