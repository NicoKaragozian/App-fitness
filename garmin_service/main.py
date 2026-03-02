"""
Garmin Connect micro-service — FastAPI
Exposes fitness data from Garmin Connect in the format expected by the Next.js app.

Run with:
    uvicorn main:app --reload --port 8000
"""

from datetime import date, timedelta
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from garmin_client import get_client, reset_client
from data_mapper import map_activity, map_health_metrics, compute_weekly_stats

app = FastAPI(title="Garmin Connect Service", version="1.0.0")

# Allow Next.js dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/health-check")
def health_check():
    try:
        client = get_client()
        return {"status": "ok", "authenticated": True}
    except Exception as e:
        return {"status": "error", "authenticated": False, "detail": str(e)}


# ─── Activities ───────────────────────────────────────────────────────────────

@app.get("/activities")
def get_activities(days: int = Query(default=30, ge=1, le=365)):
    """
    Returns Activity[] for the last N days.
    For each activity fetches: basic info + HR zones.
    HR samples and pace splits are fetched only for the 10 most recent
    activities to avoid rate limiting.
    """
    try:
        client = get_client()
        raw_activities = client.get_activities(0, days * 2)  # overfetch, filter by date
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Garmin API error: {e}")

    cutoff = date.today() - timedelta(days=days)
    mapped = []

    for i, raw in enumerate(raw_activities):
        start = raw.get("startTimeLocal", "")
        try:
            act_date = date.fromisoformat(start[:10])
            if act_date < cutoff:
                continue
        except Exception:
            continue

        activity_id = raw.get("activityId")

        # Fetch zones for all activities
        zones = None
        try:
            zones_raw = client.get_activity_hr_in_timezones(activity_id)
            zones = zones_raw if isinstance(zones_raw, list) else None
        except Exception:
            pass

        # Fetch details + splits only for the 10 most recent (rate limit friendly)
        details = None
        splits = None
        if i < 10:
            try:
                details = client.get_activity_details(activity_id)
            except Exception:
                pass
            try:
                splits_raw = client.get_activity_splits(activity_id)
                splits = splits_raw.get("lapDTOs", []) if splits_raw else None
            except Exception:
                pass

        mapped.append(map_activity(raw, details=details, zones=zones, splits=splits))

    return mapped


# ─── Daily health metrics ─────────────────────────────────────────────────────

@app.get("/health")
def get_health(date_str: str = Query(default=None, alias="date")):
    """
    Returns DailyHealthMetrics for a given date (YYYY-MM-DD).
    Defaults to today.
    """
    if date_str is None:
        date_str = date.today().isoformat()

    try:
        client = get_client()

        body_battery = _safe(lambda: client.get_body_battery(date_str))
        sleep = _safe(lambda: client.get_sleep_data(date_str))
        rhr = _safe(lambda: client.get_rhr_day(date_str))
        steps = _safe(lambda: client.get_steps_data(date_str))
        stress = _safe(lambda: client.get_stress_data(date_str))
        vo2max = _safe(lambda: client.get_max_metrics(date_str))

        return map_health_metrics(date_str, body_battery, sleep, rhr, steps, stress, vo2max)

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Garmin API error: {e}")


# ─── Weekly stats ─────────────────────────────────────────────────────────────

@app.get("/weekly-stats")
def get_weekly_stats(weeks: int = Query(default=4, ge=1, le=12)):
    """
    Returns WeeklyStats[] for the last N weeks, computed from activities.
    """
    try:
        client = get_client()
        raw_activities = client.get_activities(0, weeks * 10)  # ~10 runs/week max
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Garmin API error: {e}")

    cutoff = date.today() - timedelta(weeks=weeks)
    filtered = []

    for raw in raw_activities:
        start = raw.get("startTimeLocal", "")
        try:
            if date.fromisoformat(start[:10]) >= cutoff:
                distance_m = raw.get("distance", 0) or 0
                duration_s = raw.get("duration", 0) or 0
                avg_hr = raw.get("averageHR") or 0
                avg_pace = round((duration_s / distance_m) * 1000) if distance_m > 0 else 0
                filtered.append({
                    "id": str(raw.get("activityId", "")),
                    "date": start,
                    "distance": round(distance_m / 1000, 2),
                    "duration": round(duration_s),
                    "avgPace": avg_pace,
                    "avgHeartRate": round(avg_hr),
                    "calories": round(raw.get("calories", 0) or 0),
                })
        except Exception:
            continue

    return compute_weekly_stats(filtered)


# ─── Helper ───────────────────────────────────────────────────────────────────

@app.get("/health-range")
def get_health_range(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """
    Returns DailyHealthMetrics[] for a date range (inclusive).
    Fetches each day sequentially to avoid rate limiting.
    """
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if (end_date - start_date).days > 90:
        raise HTTPException(status_code=400, detail="Range cannot exceed 90 days")

    client = get_client()
    results = []
    current = start_date

    while current <= end_date:
        date_str = current.isoformat()
        body_battery = _safe(lambda d=date_str: client.get_body_battery(d))
        sleep = _safe(lambda d=date_str: client.get_sleep_data(d))
        rhr = _safe(lambda d=date_str: client.get_rhr_day(d))
        steps = _safe(lambda d=date_str: client.get_steps_data(d))
        stress = _safe(lambda d=date_str: client.get_stress_data(d))
        vo2max = _safe(lambda d=date_str: client.get_max_metrics(d))
        results.append(
            map_health_metrics(date_str, body_battery, sleep, rhr, steps, stress, vo2max)
        )
        current += timedelta(days=1)

    return results


def _safe(fn):
    """Call fn, return None on any exception (prevents one bad endpoint killing the response)."""
    try:
        return fn()
    except Exception:
        return None
