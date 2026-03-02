import type { Activity, DailyHealthMetrics, WeeklyStats } from "@/types/fitness";

const GARMIN_SERVICE_URL =
  process.env.GARMIN_SERVICE_URL ?? "http://localhost:8000";

async function garminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GARMIN_SERVICE_URL}${path}`, {
    next: { revalidate: 300 }, // cache 5 minutes
  });
  if (!res.ok) {
    throw new Error(`Garmin service error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchActivities(days = 30): Promise<Activity[]> {
  return garminFetch<Activity[]>(`/activities?days=${days}`);
}

export async function fetchHealthMetrics(
  date: string
): Promise<DailyHealthMetrics> {
  return garminFetch<DailyHealthMetrics>(`/health?date=${date}`);
}

export async function fetchWeeklyStats(weeks = 4): Promise<WeeklyStats[]> {
  return garminFetch<WeeklyStats[]>(`/weekly-stats?weeks=${weeks}`);
}

export async function fetchHealthMetricsRange(
  start: string,
  end: string
): Promise<DailyHealthMetrics[]> {
  return garminFetch<DailyHealthMetrics[]>(
    `/health-range?start=${start}&end=${end}`
  );
}

export async function checkGarminHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GARMIN_SERVICE_URL}/health-check`, {
      next: { revalidate: 0 },
    });
    const data = (await res.json()) as { authenticated: boolean };
    return data.authenticated === true;
  } catch {
    return false;
  }
}
