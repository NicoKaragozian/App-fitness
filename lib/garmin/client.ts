/**
 * Garmin Connect client — Phase 3
 *
 * This module will connect to a Python micro-service that uses the
 * `garminconnect` library to authenticate and fetch real Garmin data.
 *
 * Setup (Phase 3):
 *   1. Run the Python service: `python garmin_service.py`
 *   2. Set GARMIN_SERVICE_URL in .env.local
 *   3. Replace mock-data imports with calls to fetchGarminActivities()
 */

const GARMIN_SERVICE_URL = process.env.GARMIN_SERVICE_URL ?? "http://localhost:8000";

export async function fetchGarminActivities(days = 30) {
  const res = await fetch(`${GARMIN_SERVICE_URL}/activities?days=${days}`);
  if (!res.ok) throw new Error(`Garmin service error: ${res.status}`);
  return res.json();
}

export async function fetchGarminHealthMetrics(date: string) {
  const res = await fetch(`${GARMIN_SERVICE_URL}/health?date=${date}`);
  if (!res.ok) throw new Error(`Garmin service error: ${res.status}`);
  return res.json();
}
