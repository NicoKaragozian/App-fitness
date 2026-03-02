export type ActivityType =
  | "running"
  | "cycling"
  | "swimming"
  | "hiking"
  | "strength"
  | "cardio"
  | "surf"
  | "wingfoil"
  | "windsurf"
  | "kiteboard"
  | "stand_up_paddling"
  | "open_water_swimming"
  | "tennis"
  | "padel"
  | "squash";

export type SportCategory =
  | "gym"
  | "water_sports"
  | "tennis"
  | "running"
  | "cycling"
  | "hiking";

export const ACTIVITY_CATEGORY_MAP: Record<ActivityType, SportCategory> = {
  strength: "gym",
  cardio: "gym",
  swimming: "gym",
  running: "running",
  cycling: "cycling",
  hiking: "hiking",
  surf: "water_sports",
  wingfoil: "water_sports",
  windsurf: "water_sports",
  kiteboard: "water_sports",
  stand_up_paddling: "water_sports",
  open_water_swimming: "water_sports",
  tennis: "tennis",
  padel: "tennis",
  squash: "tennis",
};

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
  distance?: number; // km (optional for gym/tennis)
  duration: number; // seconds
  avgPace?: number; // seconds per km (optional for gym/tennis/water)
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

export interface SportCategorySummary {
  category: SportCategory;
  label: string;
  sessions: number;
  totalDuration: number; // seconds
  totalCalories: number;
  avgHeartRate: number;
  weeklySessionCounts: number[]; // 4 weeks, oldest first
}

export interface MonthlyStats {
  month: string; // "YYYY-MM"
  totalSessions: number;
  totalDuration: number;
  totalCalories: number;
  byCategory: Partial<Record<SportCategory, { sessions: number; duration: number }>>;
}

export interface SleepTrend {
  date: string; // YYYY-MM-DD
  sleepScore: number;
  sleepHours: number;
}

export interface SleepTrendSummary {
  trends: SleepTrend[];
  avgScore: number;
  avgHours: number;
  trend: "improving" | "declining" | "stable";
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
