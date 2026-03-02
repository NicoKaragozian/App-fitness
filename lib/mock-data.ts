import type { Activity, DailyHealthMetrics, WeeklyStats } from "@/types/fitness";
import { ACTIVITY_CATEGORY_MAP } from "@/types/fitness";
export { ACTIVITY_CATEGORY_MAP };

// Helper: generate HR samples for a run
function generateHRSamples(
  duration: number,
  avgHR: number,
  maxHR: number
): { time: number; bpm: number }[] {
  const samples: { time: number; bpm: number }[] = [];
  const intervalSec = 30;
  let currentHR = avgHR - 20;

  for (let t = 0; t <= duration; t += intervalSec) {
    const progress = t / duration;
    // warm-up → peak → cooldown shape
    let target: number;
    if (progress < 0.1) {
      target = avgHR - 20 + (avgHR - (avgHR - 20)) * (progress / 0.1);
    } else if (progress < 0.8) {
      target = avgHR + Math.sin(progress * Math.PI * 3) * 8;
      if (progress > 0.6) target += (maxHR - avgHR) * ((progress - 0.6) / 0.2);
    } else {
      target = maxHR - (maxHR - (avgHR - 10)) * ((progress - 0.8) / 0.2);
    }
    currentHR = currentHR * 0.85 + target * 0.15 + (Math.random() - 0.5) * 5;
    samples.push({ time: t, bpm: Math.round(Math.min(maxHR, Math.max(100, currentHR))) });
  }
  return samples;
}

// Helper: generate pace samples per km
function generatePaceSamples(
  distance: number,
  avgPace: number
): { km: number; pace: number; elevation: number }[] {
  const samples = [];
  let elevation = 0;
  for (let km = 1; km <= Math.ceil(distance); km++) {
    const variation = (Math.random() - 0.5) * 20;
    const elChange = (Math.random() - 0.4) * 10;
    elevation = Math.max(0, elevation + elChange);
    samples.push({
      km,
      pace: Math.round(avgPace + variation + elChange * 2),
      elevation: Math.round(elevation),
    });
  }
  return samples;
}

// Helper: generate HR zones from avg and max
function generateZones(
  duration: number,
  avgHR: number
): Activity["zones"] {
  const intensity = (avgHR - 90) / 80; // 0–1 scale
  const z1 = Math.round(duration * 0.05);
  const z2 = Math.round(duration * Math.max(0.1, 0.35 - intensity * 0.2));
  const z3 = Math.round(duration * (0.3 - intensity * 0.05));
  const z4 = Math.round(duration * (0.2 + intensity * 0.2));
  const z5 = Math.round(duration * Math.min(0.1, intensity * 0.1));
  const total = z1 + z2 + z3 + z4 + z5;

  return [
    { zone: 1, name: "Recovery", minHR: 90, maxHR: 115, minutes: Math.round(z1 / 60), percentage: Math.round((z1 / total) * 100) },
    { zone: 2, name: "Base", minHR: 115, maxHR: 135, minutes: Math.round(z2 / 60), percentage: Math.round((z2 / total) * 100) },
    { zone: 3, name: "Aerobic", minHR: 135, maxHR: 152, minutes: Math.round(z3 / 60), percentage: Math.round((z3 / total) * 100) },
    { zone: 4, name: "Threshold", minHR: 152, maxHR: 168, minutes: Math.round(z4 / 60), percentage: Math.round((z4 / total) * 100) },
    { zone: 5, name: "VO2max", minHR: 168, maxHR: 190, minutes: Math.round(z5 / 60), percentage: Math.round((z5 / total) * 100) },
  ];
}

// ─── 20 Activities (4 weeks, ~5 per week) ───────────────────────────────────

export const activities: Activity[] = [
  // Week 4 (most recent — Feb 24–Mar 1 2026)
  {
    id: "act-001",
    name: "Morning Tempo",
    type: "running",
    date: "2026-03-01T07:15:00",
    distance: 10.2,
    duration: 3180,
    avgPace: 312, // 5:12/km
    avgHeartRate: 158,
    maxHeartRate: 177,
    calories: 698,
    elevationGain: 45,
    vo2maxEstimate: 52.4,
    zones: generateZones(3180, 158),
    heartRateSamples: generateHRSamples(3180, 158, 177),
    paceSamples: generatePaceSamples(10.2, 312),
  },
  {
    id: "act-002",
    name: "Recovery Jog",
    type: "running",
    date: "2026-02-27T06:45:00",
    distance: 6.0,
    duration: 2280,
    avgPace: 380, // 6:20/km
    avgHeartRate: 132,
    maxHeartRate: 148,
    calories: 398,
    elevationGain: 22,
    vo2maxEstimate: 52.1,
    zones: generateZones(2280, 132),
    heartRateSamples: generateHRSamples(2280, 132, 148),
    paceSamples: generatePaceSamples(6.0, 380),
  },
  {
    id: "act-003",
    name: "Interval Session",
    type: "running",
    date: "2026-02-25T07:00:00",
    distance: 8.5,
    duration: 2700,
    avgPace: 318, // 5:18/km
    avgHeartRate: 163,
    maxHeartRate: 185,
    calories: 612,
    elevationGain: 30,
    vo2maxEstimate: 52.8,
    zones: generateZones(2700, 163),
    heartRateSamples: generateHRSamples(2700, 163, 185),
    paceSamples: generatePaceSamples(8.5, 318),
  },
  {
    id: "act-004",
    name: "Long Run",
    type: "running",
    date: "2026-02-23T08:00:00",
    distance: 18.4,
    duration: 6480,
    avgPace: 352, // 5:52/km
    avgHeartRate: 148,
    maxHeartRate: 168,
    calories: 1205,
    elevationGain: 112,
    vo2maxEstimate: 52.2,
    zones: generateZones(6480, 148),
    heartRateSamples: generateHRSamples(6480, 148, 168),
    paceSamples: generatePaceSamples(18.4, 352),
  },
  {
    id: "act-005",
    name: "Easy Run",
    type: "running",
    date: "2026-02-22T07:30:00",
    distance: 7.2,
    duration: 2640,
    avgPace: 367, // 6:07/km
    avgHeartRate: 138,
    maxHeartRate: 154,
    calories: 487,
    elevationGain: 28,
    vo2maxEstimate: 51.9,
    zones: generateZones(2640, 138),
    heartRateSamples: generateHRSamples(2640, 138, 154),
    paceSamples: generatePaceSamples(7.2, 367),
  },

  // Week 3 (Feb 15–21)
  {
    id: "act-006",
    name: "Fartlek Run",
    type: "running",
    date: "2026-02-20T07:10:00",
    distance: 9.8,
    duration: 3060,
    avgPace: 312, // 5:12/km
    avgHeartRate: 156,
    maxHeartRate: 181,
    calories: 658,
    elevationGain: 55,
    vo2maxEstimate: 51.7,
    zones: generateZones(3060, 156),
    heartRateSamples: generateHRSamples(3060, 156, 181),
    paceSamples: generatePaceSamples(9.8, 312),
  },
  {
    id: "act-007",
    name: "Threshold Run",
    type: "running",
    date: "2026-02-18T06:55:00",
    distance: 7.5,
    duration: 2340,
    avgPace: 312, // 5:12/km
    avgHeartRate: 161,
    maxHeartRate: 178,
    calories: 523,
    elevationGain: 40,
    vo2maxEstimate: 51.5,
    zones: generateZones(2340, 161),
    heartRateSamples: generateHRSamples(2340, 161, 178),
    paceSamples: generatePaceSamples(7.5, 312),
  },
  {
    id: "act-008",
    name: "Long Run",
    type: "running",
    date: "2026-02-16T08:00:00",
    distance: 16.1,
    duration: 5700,
    avgPace: 354, // 5:54/km
    avgHeartRate: 146,
    maxHeartRate: 165,
    calories: 1065,
    elevationGain: 98,
    vo2maxEstimate: 51.2,
    zones: generateZones(5700, 146),
    heartRateSamples: generateHRSamples(5700, 146, 165),
    paceSamples: generatePaceSamples(16.1, 354),
  },
  {
    id: "act-009",
    name: "Recovery Jog",
    type: "running",
    date: "2026-02-15T07:00:00",
    distance: 5.5,
    duration: 2100,
    avgPace: 382, // 6:22/km
    avgHeartRate: 129,
    maxHeartRate: 145,
    calories: 362,
    elevationGain: 18,
    vo2maxEstimate: 51.0,
    zones: generateZones(2100, 129),
    heartRateSamples: generateHRSamples(2100, 129, 145),
    paceSamples: generatePaceSamples(5.5, 382),
  },
  {
    id: "act-010",
    name: "Track Session",
    type: "running",
    date: "2026-02-13T07:30:00",
    distance: 10.0,
    duration: 3000,
    avgPace: 300, // 5:00/km
    avgHeartRate: 165,
    maxHeartRate: 188,
    calories: 695,
    elevationGain: 12,
    vo2maxEstimate: 50.8,
    zones: generateZones(3000, 165),
    heartRateSamples: generateHRSamples(3000, 165, 188),
    paceSamples: generatePaceSamples(10.0, 300),
  },

  // Week 2 (Feb 8–14)
  {
    id: "act-011",
    name: "Morning Run",
    type: "running",
    date: "2026-02-12T07:00:00",
    distance: 8.0,
    duration: 2880,
    avgPace: 360, // 6:00/km
    avgHeartRate: 145,
    maxHeartRate: 162,
    calories: 548,
    elevationGain: 35,
    vo2maxEstimate: 50.5,
    zones: generateZones(2880, 145),
    heartRateSamples: generateHRSamples(2880, 145, 162),
    paceSamples: generatePaceSamples(8.0, 360),
  },
  {
    id: "act-012",
    name: "Tempo Run",
    type: "running",
    date: "2026-02-10T07:15:00",
    distance: 9.5,
    duration: 2940,
    avgPace: 309, // 5:09/km
    avgHeartRate: 159,
    maxHeartRate: 176,
    calories: 640,
    elevationGain: 42,
    vo2maxEstimate: 50.3,
    zones: generateZones(2940, 159),
    heartRateSamples: generateHRSamples(2940, 159, 176),
    paceSamples: generatePaceSamples(9.5, 309),
  },
  {
    id: "act-013",
    name: "Long Run",
    type: "running",
    date: "2026-02-09T08:00:00",
    distance: 15.0,
    duration: 5400,
    avgPace: 360, // 6:00/km
    avgHeartRate: 143,
    maxHeartRate: 162,
    calories: 990,
    elevationGain: 85,
    vo2maxEstimate: 50.0,
    zones: generateZones(5400, 143),
    heartRateSamples: generateHRSamples(5400, 143, 162),
    paceSamples: generatePaceSamples(15.0, 360),
  },
  {
    id: "act-014",
    name: "Easy Run",
    type: "running",
    date: "2026-02-08T07:30:00",
    distance: 6.5,
    duration: 2460,
    avgPace: 378, // 6:18/km
    avgHeartRate: 133,
    maxHeartRate: 149,
    calories: 432,
    elevationGain: 25,
    vo2maxEstimate: 49.8,
    zones: generateZones(2460, 133),
    heartRateSamples: generateHRSamples(2460, 133, 149),
    paceSamples: generatePaceSamples(6.5, 378),
  },
  {
    id: "act-015",
    name: "Hill Repeats",
    type: "running",
    date: "2026-02-06T07:00:00",
    distance: 7.8,
    duration: 2700,
    avgPace: 346, // 5:46/km
    avgHeartRate: 162,
    maxHeartRate: 182,
    calories: 575,
    elevationGain: 210,
    vo2maxEstimate: 49.5,
    zones: generateZones(2700, 162),
    heartRateSamples: generateHRSamples(2700, 162, 182),
    paceSamples: generatePaceSamples(7.8, 346),
  },

  // Week 1 (Feb 1–7)
  {
    id: "act-016",
    name: "Easy Run",
    type: "running",
    date: "2026-02-05T07:30:00",
    distance: 6.0,
    duration: 2340,
    avgPace: 390, // 6:30/km
    avgHeartRate: 130,
    maxHeartRate: 147,
    calories: 400,
    elevationGain: 20,
    vo2maxEstimate: 49.2,
    zones: generateZones(2340, 130),
    heartRateSamples: generateHRSamples(2340, 130, 147),
    paceSamples: generatePaceSamples(6.0, 390),
  },
  {
    id: "act-017",
    name: "Tempo Run",
    type: "running",
    date: "2026-02-04T07:00:00",
    distance: 8.2,
    duration: 2700,
    avgPace: 329, // 5:29/km
    avgHeartRate: 155,
    maxHeartRate: 172,
    calories: 558,
    elevationGain: 38,
    vo2maxEstimate: 49.0,
    zones: generateZones(2700, 155),
    heartRateSamples: generateHRSamples(2700, 155, 172),
    paceSamples: generatePaceSamples(8.2, 329),
  },
  {
    id: "act-018",
    name: "Long Run",
    type: "running",
    date: "2026-02-02T08:00:00",
    distance: 14.0,
    duration: 5220,
    avgPace: 373, // 6:13/km
    avgHeartRate: 141,
    maxHeartRate: 160,
    calories: 930,
    elevationGain: 75,
    vo2maxEstimate: 48.8,
    zones: generateZones(5220, 141),
    heartRateSamples: generateHRSamples(5220, 141, 160),
    paceSamples: generatePaceSamples(14.0, 373),
  },
  {
    id: "act-019",
    name: "Morning Jog",
    type: "running",
    date: "2026-02-01T07:45:00",
    distance: 5.5,
    duration: 2220,
    avgPace: 403, // 6:43/km
    avgHeartRate: 128,
    maxHeartRate: 143,
    calories: 360,
    elevationGain: 15,
    vo2maxEstimate: 48.5,
    zones: generateZones(2220, 128),
    heartRateSamples: generateHRSamples(2220, 128, 143),
    paceSamples: generatePaceSamples(5.5, 403),
  },
  {
    id: "act-020",
    name: "Interval Training",
    type: "running",
    date: "2026-01-30T07:00:00",
    distance: 9.0,
    duration: 2880,
    avgPace: 320, // 5:20/km
    avgHeartRate: 160,
    maxHeartRate: 183,
    calories: 620,
    elevationGain: 32,
    vo2maxEstimate: 48.2,
    zones: generateZones(2880, 160),
    heartRateSamples: generateHRSamples(2880, 160, 183),
    paceSamples: generatePaceSamples(9.0, 320),
  },

  // ─── Multi-sport activities ───────────────────────────────────────────────

  // Week 4 gym + sports
  {
    id: "act-021",
    name: "Gym — Upper Body",
    type: "strength",
    date: "2026-02-28T09:00:00",
    duration: 3600,
    avgHeartRate: 122,
    maxHeartRate: 148,
    calories: 390,
    elevationGain: 0,
    zones: generateZones(3600, 122),
    heartRateSamples: generateHRSamples(3600, 122, 148),
    paceSamples: [],
  },
  {
    id: "act-022",
    name: "San Isidro Tennis",
    type: "tennis",
    date: "2026-02-26T18:00:00",
    duration: 5400,
    avgHeartRate: 140,
    maxHeartRate: 168,
    calories: 560,
    elevationGain: 0,
    zones: generateZones(5400, 140),
    heartRateSamples: generateHRSamples(5400, 140, 168),
    paceSamples: [],
  },
  {
    id: "act-023",
    name: "Wingfoil — Punta Lara",
    type: "wingfoil",
    date: "2026-02-24T11:00:00",
    duration: 7200,
    avgHeartRate: 135,
    maxHeartRate: 162,
    calories: 720,
    elevationGain: 0,
    zones: generateZones(7200, 135),
    heartRateSamples: generateHRSamples(7200, 135, 162),
    paceSamples: [],
  },

  // Week 3 gym + sports
  {
    id: "act-024",
    name: "Gym — Legs & Core",
    type: "strength",
    date: "2026-02-19T10:00:00",
    duration: 4200,
    avgHeartRate: 125,
    maxHeartRate: 152,
    calories: 420,
    elevationGain: 0,
    zones: generateZones(4200, 125),
    heartRateSamples: generateHRSamples(4200, 125, 152),
    paceSamples: [],
  },
  {
    id: "act-025",
    name: "Surf — Mar del Plata",
    type: "surf",
    date: "2026-02-17T09:30:00",
    duration: 5400,
    avgHeartRate: 128,
    maxHeartRate: 155,
    calories: 480,
    elevationGain: 0,
    zones: generateZones(5400, 128),
    heartRateSamples: generateHRSamples(5400, 128, 155),
    paceSamples: [],
  },
  {
    id: "act-026",
    name: "Tennis — Club Atlético",
    type: "tennis",
    date: "2026-02-15T19:00:00",
    duration: 4800,
    avgHeartRate: 143,
    maxHeartRate: 170,
    calories: 510,
    elevationGain: 0,
    zones: generateZones(4800, 143),
    heartRateSamples: generateHRSamples(4800, 143, 170),
    paceSamples: [],
  },

  // Week 2 gym + sports
  {
    id: "act-027",
    name: "Gym — Full Body HIIT",
    type: "cardio",
    date: "2026-02-11T08:30:00",
    duration: 3000,
    avgHeartRate: 155,
    maxHeartRate: 178,
    calories: 445,
    elevationGain: 0,
    zones: generateZones(3000, 155),
    heartRateSamples: generateHRSamples(3000, 155, 178),
    paceSamples: [],
  },
  {
    id: "act-028",
    name: "Windsurf — Tigre",
    type: "windsurf",
    date: "2026-02-09T10:00:00",
    duration: 6600,
    avgHeartRate: 130,
    maxHeartRate: 158,
    calories: 610,
    elevationGain: 0,
    zones: generateZones(6600, 130),
    heartRateSamples: generateHRSamples(6600, 130, 158),
    paceSamples: [],
  },
  {
    id: "act-029",
    name: "Tennis — Dobles",
    type: "tennis",
    date: "2026-02-08T11:00:00",
    duration: 3600,
    avgHeartRate: 136,
    maxHeartRate: 161,
    calories: 380,
    elevationGain: 0,
    zones: generateZones(3600, 136),
    heartRateSamples: generateHRSamples(3600, 136, 161),
    paceSamples: [],
  },

  // Week 1 gym + sports
  {
    id: "act-030",
    name: "Gym — Upper Body",
    type: "strength",
    date: "2026-02-05T09:00:00",
    duration: 3900,
    avgHeartRate: 120,
    maxHeartRate: 145,
    calories: 360,
    elevationGain: 0,
    zones: generateZones(3900, 120),
    heartRateSamples: generateHRSamples(3900, 120, 145),
    paceSamples: [],
  },
  {
    id: "act-031",
    name: "Surf — Necochea",
    type: "surf",
    date: "2026-02-03T08:00:00",
    duration: 6000,
    avgHeartRate: 132,
    maxHeartRate: 160,
    calories: 540,
    elevationGain: 0,
    zones: generateZones(6000, 132),
    heartRateSamples: generateHRSamples(6000, 132, 160),
    paceSamples: [],
  },
  {
    id: "act-032",
    name: "Wingfoil — Río de la Plata",
    type: "wingfoil",
    date: "2026-02-01T10:30:00",
    duration: 7800,
    avgHeartRate: 138,
    maxHeartRate: 165,
    calories: 780,
    elevationGain: 0,
    zones: generateZones(7800, 138),
    heartRateSamples: generateHRSamples(7800, 138, 165),
    paceSamples: [],
  },
];

// ─── Daily Health Metrics (last 28 days) ───────────────────────────────────

export const healthMetrics: DailyHealthMetrics[] = [
  { date: "2026-03-01", bodyBattery: 72, sleepScore: 78, sleepHours: 7.5, restingHeartRate: 48, steps: 9240, stressScore: 28, vo2max: 52.4 },
  { date: "2026-02-28", bodyBattery: 65, sleepScore: 68, sleepHours: 6.2, restingHeartRate: 51, steps: 12800, stressScore: 42, vo2max: 52.3 },
  { date: "2026-02-27", bodyBattery: 81, sleepScore: 85, sleepHours: 8.1, restingHeartRate: 46, steps: 8900, stressScore: 22, vo2max: 52.2 },
  { date: "2026-02-26", bodyBattery: 55, sleepScore: 61, sleepHours: 5.8, restingHeartRate: 53, steps: 11200, stressScore: 58, vo2max: 52.1 },
  { date: "2026-02-25", bodyBattery: 78, sleepScore: 80, sleepHours: 7.8, restingHeartRate: 47, steps: 10500, stressScore: 31, vo2max: 52.0 },
  { date: "2026-02-24", bodyBattery: 88, sleepScore: 90, sleepHours: 8.5, restingHeartRate: 45, steps: 7800, stressScore: 18, vo2max: 51.9 },
  { date: "2026-02-23", bodyBattery: 70, sleepScore: 74, sleepHours: 7.2, restingHeartRate: 49, steps: 14200, stressScore: 35, vo2max: 51.8 },
  { date: "2026-02-22", bodyBattery: 62, sleepScore: 70, sleepHours: 6.8, restingHeartRate: 50, steps: 9800, stressScore: 39, vo2max: 51.7 },
  { date: "2026-02-21", bodyBattery: 85, sleepScore: 88, sleepHours: 8.3, restingHeartRate: 46, steps: 8200, stressScore: 20, vo2max: 51.6 },
  { date: "2026-02-20", bodyBattery: 75, sleepScore: 77, sleepHours: 7.4, restingHeartRate: 48, steps: 11500, stressScore: 29, vo2max: 51.5 },
  { date: "2026-02-19", bodyBattery: 60, sleepScore: 65, sleepHours: 6.0, restingHeartRate: 52, steps: 10200, stressScore: 48, vo2max: 51.4 },
  { date: "2026-02-18", bodyBattery: 77, sleepScore: 81, sleepHours: 7.7, restingHeartRate: 47, steps: 9600, stressScore: 27, vo2max: 51.3 },
  { date: "2026-02-17", bodyBattery: 90, sleepScore: 92, sleepHours: 8.8, restingHeartRate: 44, steps: 7500, stressScore: 15, vo2max: 51.2 },
  { date: "2026-02-16", bodyBattery: 68, sleepScore: 72, sleepHours: 7.0, restingHeartRate: 50, steps: 13000, stressScore: 37, vo2max: 51.1 },
  { date: "2026-02-15", bodyBattery: 58, sleepScore: 63, sleepHours: 5.9, restingHeartRate: 54, steps: 10800, stressScore: 52, vo2max: 51.0 },
  { date: "2026-02-14", bodyBattery: 82, sleepScore: 86, sleepHours: 8.0, restingHeartRate: 46, steps: 8100, stressScore: 24, vo2max: 50.9 },
  { date: "2026-02-13", bodyBattery: 74, sleepScore: 76, sleepHours: 7.3, restingHeartRate: 49, steps: 11800, stressScore: 33, vo2max: 50.8 },
  { date: "2026-02-12", bodyBattery: 66, sleepScore: 69, sleepHours: 6.5, restingHeartRate: 51, steps: 10100, stressScore: 44, vo2max: 50.7 },
  { date: "2026-02-11", bodyBattery: 80, sleepScore: 83, sleepHours: 7.9, restingHeartRate: 47, steps: 8700, stressScore: 26, vo2max: 50.6 },
  { date: "2026-02-10", bodyBattery: 73, sleepScore: 75, sleepHours: 7.1, restingHeartRate: 48, steps: 12200, stressScore: 32, vo2max: 50.5 },
  { date: "2026-02-09", bodyBattery: 69, sleepScore: 71, sleepHours: 6.7, restingHeartRate: 50, steps: 11600, stressScore: 38, vo2max: 50.4 },
  { date: "2026-02-08", bodyBattery: 83, sleepScore: 87, sleepHours: 8.2, restingHeartRate: 45, steps: 8400, stressScore: 21, vo2max: 50.3 },
  { date: "2026-02-07", bodyBattery: 91, sleepScore: 93, sleepHours: 9.0, restingHeartRate: 44, steps: 6900, stressScore: 14, vo2max: 50.2 },
  { date: "2026-02-06", bodyBattery: 76, sleepScore: 79, sleepHours: 7.6, restingHeartRate: 48, steps: 10400, stressScore: 30, vo2max: 50.1 },
  { date: "2026-02-05", bodyBattery: 63, sleepScore: 66, sleepHours: 6.1, restingHeartRate: 52, steps: 9700, stressScore: 46, vo2max: 50.0 },
  { date: "2026-02-04", bodyBattery: 79, sleepScore: 82, sleepHours: 7.8, restingHeartRate: 47, steps: 10900, stressScore: 28, vo2max: 49.9 },
  { date: "2026-02-03", bodyBattery: 87, sleepScore: 89, sleepHours: 8.4, restingHeartRate: 45, steps: 7600, stressScore: 19, vo2max: 49.8 },
  { date: "2026-02-02", bodyBattery: 71, sleepScore: 73, sleepHours: 7.0, restingHeartRate: 49, steps: 13500, stressScore: 36, vo2max: 49.7 },
];

// ─── Weekly Stats ───────────────────────────────────────────────────────────

export const weeklyStats: WeeklyStats[] = [
  {
    weekStart: "2026-02-23",
    totalDistance: 49.9,
    totalDuration: 17280,
    totalActivities: 5,
    avgPace: 346,
    avgHeartRate: 148,
    totalCalories: 3400,
    trainingLoad: 742,
  },
  {
    weekStart: "2026-02-16",
    totalDistance: 48.9,
    totalDuration: 16620,
    totalActivities: 5,
    avgPace: 340,
    avgHeartRate: 151,
    totalCalories: 3401,
    trainingLoad: 728,
  },
  {
    weekStart: "2026-02-09",
    totalDistance: 46.7,
    totalDuration: 16380,
    totalActivities: 5,
    avgPace: 351,
    avgHeartRate: 148,
    totalCalories: 3185,
    trainingLoad: 695,
  },
  {
    weekStart: "2026-02-02",
    totalDistance: 42.7,
    totalDuration: 15360,
    totalActivities: 5,
    avgPace: 360,
    avgHeartRate: 143,
    totalCalories: 2868,
    trainingLoad: 641,
  },
];

// ─── Utility functions ──────────────────────────────────────────────────────

export function formatPace(secondsPerKm: number): string {
  const min = Math.floor(secondsPerKm / 60);
  const sec = secondsPerKm % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function getActivityById(id: string): Activity | undefined {
  return activities.find((a) => a.id === id);
}

export function getTodayMetrics(): DailyHealthMetrics {
  return healthMetrics[0];
}

export function getRecentActivities(count = 5): Activity[] {
  return [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, count);
}

export function getCurrentWeekStats(): WeeklyStats {
  return weeklyStats[0];
}

export function getPreviousWeekStats(): WeeklyStats {
  return weeklyStats[1];
}
