"""
Maps raw Garmin Connect API responses to the TypeScript-compatible
JSON format expected by the Next.js app (types/fitness.ts).
"""

from datetime import datetime, timedelta, date
from typing import Any


# ─── Activity mapping ────────────────────────────────────────────────────────

ACTIVITY_TYPE_MAP = {
    "running": "running",
    "trail_running": "running",
    "treadmill_running": "running",
    "cycling": "cycling",
    "indoor_cycling": "cycling",
    "swimming": "swimming",
    "open_water_swimming": "swimming",
    "hiking": "hiking",
    "strength_training": "strength",
    "fitness_equipment": "strength",
}


def map_activity_type(garmin_type: str) -> str:
    return ACTIVITY_TYPE_MAP.get(garmin_type.lower(), "running")


def map_hr_zones(zones_data: list[dict]) -> list[dict]:
    """Convert Garmin HR zone data to our zone format."""
    zone_names = ["Recovery", "Base", "Aerobic", "Threshold", "VO2max"]
    result = []
    total_seconds = sum(z.get("secsInZone", 0) for z in zones_data)

    for i, zone in enumerate(zones_data[:5]):
        secs = zone.get("secsInZone", 0)
        result.append({
            "zone": i + 1,
            "name": zone_names[i],
            "minHR": zone.get("zoneLowBoundary", 0),
            "maxHR": zone.get("zoneHighBoundary", 220),
            "minutes": round(secs / 60),
            "percentage": round((secs / total_seconds * 100) if total_seconds > 0 else 0),
        })

    return result


def map_hr_samples(details: dict) -> list[dict]:
    """Extract heart rate samples from activity details."""
    samples = []
    measurements = details.get("measurementCount", 0)
    metrics = details.get("detailMetrics", [])

    # Find heart rate metric
    hr_metric = None
    for m in metrics:
        if m.get("metricsType") == "HEART_RATE":
            hr_metric = m
            break

    if hr_metric and "metrics" in hr_metric:
        for i, entry in enumerate(hr_metric["metrics"]):
            bpm = entry.get("value")
            if bpm and bpm > 0:
                samples.append({
                    "time": i * 30,  # Garmin samples are ~30s apart
                    "bpm": int(bpm),
                })

    return samples


def map_pace_samples(splits: list[dict]) -> list[dict]:
    """Convert Garmin lap/split data to pace samples per km."""
    samples = []
    for i, split in enumerate(splits):
        distance_m = split.get("distance", 0)
        duration_s = split.get("duration", 0)
        elevation = split.get("elevationGain", 0) or 0

        if distance_m > 0 and duration_s > 0:
            pace_sec_per_km = (duration_s / distance_m) * 1000
            samples.append({
                "km": i + 1,
                "pace": round(pace_sec_per_km),
                "elevation": round(elevation),
            })

    return samples


def map_activity(raw: dict, details: dict | None = None, zones: list | None = None, splits: list | None = None) -> dict:
    """Map a single Garmin activity to our Activity interface."""
    start_time = raw.get("startTimeLocal", raw.get("startTimeGMT", ""))
    distance_m = raw.get("distance", 0) or 0
    duration_s = raw.get("duration", 0) or 0
    avg_hr = raw.get("averageHR") or 0
    max_hr = raw.get("maxHR") or 0
    calories = raw.get("calories", 0) or 0
    elevation = raw.get("elevationGain", 0) or 0

    # Pace in seconds per km
    avg_pace = round((duration_s / distance_m) * 1000) if distance_m > 0 else 0

    hr_samples = map_hr_samples(details) if details else []
    zone_data = map_hr_zones(zones) if zones else _default_zones(avg_hr, duration_s)
    pace_samples = map_pace_samples(splits) if splits else []

    return {
        "id": str(raw.get("activityId", "")),
        "name": raw.get("activityName", "Activity"),
        "type": map_activity_type(raw.get("activityType", {}).get("typeKey", "running")),
        "date": start_time,
        "distance": round(distance_m / 1000, 2),
        "duration": round(duration_s),
        "avgPace": avg_pace,
        "avgHeartRate": round(avg_hr),
        "maxHeartRate": round(max_hr),
        "calories": round(calories),
        "elevationGain": round(elevation),
        "vo2maxEstimate": raw.get("vO2MaxValue"),
        "zones": zone_data,
        "heartRateSamples": hr_samples,
        "paceSamples": pace_samples,
    }


def _default_zones(avg_hr: float, duration_s: float) -> list[dict]:
    """Generate estimated zones when real zone data is unavailable."""
    zone_names = ["Recovery", "Base", "Aerobic", "Threshold", "VO2max"]
    boundaries = [(0, 115), (115, 135), (135, 152), (152, 168), (168, 220)]
    total = max(duration_s, 1)

    # Rough distribution based on avg HR
    intensity = max(0, min(1, (avg_hr - 90) / 80))
    weights = [0.05, max(0.1, 0.35 - intensity * 0.2), 0.3, 0.2 + intensity * 0.2, min(0.1, intensity * 0.1)]

    zones = []
    for i, (name, (lo, hi), w) in enumerate(zip(zone_names, boundaries, weights)):
        secs = total * w
        zones.append({
            "zone": i + 1,
            "name": name,
            "minHR": lo,
            "maxHR": hi,
            "minutes": round(secs / 60),
            "percentage": round(w * 100),
        })
    return zones


# ─── Health metrics mapping ──────────────────────────────────────────────────

def map_health_metrics(
    date_str: str,
    body_battery: list | None,
    sleep: dict | None,
    rhr: dict | None,
    steps: list | None,
    stress: list | None,
    vo2max: dict | None,
) -> dict:
    """Combine daily health data into DailyHealthMetrics format."""

    # Body Battery: use max value of the day
    bb_value = 0
    if body_battery:
        values = [e.get("bodyBatteryLevel", 0) for e in body_battery if e.get("bodyBatteryLevel")]
        bb_value = max(values) if values else 0

    # Sleep
    sleep_score = 0
    sleep_hours = 0.0
    if sleep:
        daily = sleep.get("dailySleepDTO", {})
        sleep_score = daily.get("sleepScores", {}).get("overall", {}).get("value", 0) or 0
        sleep_seconds = daily.get("sleepTimeSeconds", 0) or 0
        sleep_hours = round(sleep_seconds / 3600, 1)

    # Resting HR
    rhr_value = 0
    if rhr:
        rhr_value = rhr.get("restingHeartRate", 0) or 0

    # Steps: sum of all step entries
    steps_total = 0
    if steps:
        steps_total = sum(e.get("steps", 0) or 0 for e in steps)

    # Stress: average of all readings (0–100 scale)
    stress_avg = 0
    if stress:
        values = [e.get("stressLevel", 0) for e in stress if (e.get("stressLevel") or 0) > 0]
        stress_avg = round(sum(values) / len(values)) if values else 0

    # VO2 Max
    vo2_value = 0.0
    if vo2max:
        vo2_value = vo2max.get("generic", {}).get("vo2MaxValue") or \
                    vo2max.get("cycling", {}).get("vo2MaxValue") or 0.0

    return {
        "date": date_str,
        "bodyBattery": round(bb_value),
        "sleepScore": round(sleep_score),
        "sleepHours": sleep_hours,
        "restingHeartRate": round(rhr_value),
        "steps": round(steps_total),
        "stressScore": stress_avg,
        "vo2max": round(float(vo2_value), 1),
    }


# ─── Weekly stats computation ─────────────────────────────────────────────────

def compute_weekly_stats(activities: list[dict]) -> list[dict]:
    """Group activities by week and compute WeeklyStats."""
    from collections import defaultdict

    weeks: dict[str, list[dict]] = defaultdict(list)

    for act in activities:
        date_str = act.get("date", "")
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            # Get Monday of that week
            monday = dt.date() - timedelta(days=dt.weekday())
            weeks[monday.isoformat()].append(act)
        except Exception:
            continue

    result = []
    for week_start, week_acts in sorted(weeks.items(), reverse=True):
        total_distance = sum(a["distance"] for a in week_acts)
        total_duration = sum(a["duration"] for a in week_acts)
        total_calories = sum(a["calories"] for a in week_acts)
        avg_hr = round(sum(a["avgHeartRate"] for a in week_acts) / len(week_acts)) if week_acts else 0
        avg_pace = round(total_duration / (total_distance * 1000) * 1000) if total_distance > 0 else 0

        # Training load: rough approximation (duration * HR factor)
        training_load = round(sum(
            (a["duration"] / 3600) * (a["avgHeartRate"] / 150) * 100
            for a in week_acts
        ))

        result.append({
            "weekStart": week_start,
            "totalDistance": round(total_distance, 1),
            "totalDuration": round(total_duration),
            "totalActivities": len(week_acts),
            "avgPace": avg_pace,
            "avgHeartRate": avg_hr,
            "totalCalories": round(total_calories),
            "trainingLoad": training_load,
        })

    return result
