export type ActivityType = "running" | "cycling" | "swimming" | "hiking" | "strength";

export interface HeartRateZone {
  zone: 1 | 2 | 3 | 4 | 5;
  name: string;
  minHR: number;
  maxHR: number;
  minutes: number;
  percentage: number;
}

export interface HeartRateSample {
  time: number; // seconds from start
  bpm: number;
}

export interface PaceSample {
  km: number;
  pace: number; // seconds per km
  elevation: number; // meters
}

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  date: string; // ISO 8601
  distance: number; // km
  duration: number; // seconds
  avgPace: number; // seconds per km
  avgHeartRate: number; // bpm
  maxHeartRate: number; // bpm
  calories: number;
  elevationGain: number; // meters
  vo2maxEstimate?: number;
  zones: HeartRateZone[];
  heartRateSamples: HeartRateSample[];
  paceSamples: PaceSample[];
}

export interface DailyHealthMetrics {
  date: string; // YYYY-MM-DD
  bodyBattery: number; // 0–100
  sleepScore: number; // 0–100
  sleepHours: number;
  restingHeartRate: number; // bpm
  steps: number;
  stressScore: number; // 0–100
  vo2max: number;
}

export interface WeeklyStats {
  weekStart: string; // YYYY-MM-DD (Monday)
  totalDistance: number; // km
  totalDuration: number; // seconds
  totalActivities: number;
  avgPace: number; // seconds per km
  avgHeartRate: number;
  totalCalories: number;
  trainingLoad: number; // arbitrary 0–1000
}

export interface AIInsight {
  type: "pattern" | "summary" | "recommendation" | "comparison";
  title: string;
  description: string;
  metric?: string;
  trend?: "improving" | "declining" | "stable";
  confidence: "high" | "medium" | "low";
}

export interface InsightsResponse {
  insights: AIInsight[];
  weeklySummary: string;
  weekComparison: {
    metric: string;
    current: number;
    previous: number;
    unit: string;
    change: number; // percentage
  }[];
}
