export const readinessScore = 94;
export const bodyBattery = 78;
export const sleepScore = 85;
export const sleepHours = '7h 45m';
export const restingHR = 48;

export const weeklyStressData = [
  { day: 'LUN', stress: 28, date: '2026-03-14' },
  { day: 'MAR', stress: 35, date: '2026-03-15' },
  { day: 'MIÉ', stress: 22, date: '2026-03-16' },
  { day: 'JUE', stress: 41, date: '2026-03-17' },
  { day: 'VIE', stress: 30, date: '2026-03-18' },
  { day: 'SÁB', stress: 18, date: '2026-03-19' },
  { day: 'DOM', stress: 25, date: '2026-03-20' },
];

export const monthlyStressData = [
  { week: 'S1', stress: 32 },
  { week: 'S2', stress: 28 },
  { week: 'S3', stress: 38 },
  { week: 'S4', stress: 25 },
];

export const weeklyStressAvg = Math.round(weeklyStressData.reduce((a, b) => a + b.stress, 0) / weeklyStressData.length);
export const monthlyStressAvg = Math.round(monthlyStressData.reduce((a, b) => a + b.stress, 0) / monthlyStressData.length);

export const weeklySleepData = [
  { day: 'LUN', hours: 7.2, score: 78, hrv: 58 },
  { day: 'MAR', hours: 8.1, score: 88, hrv: 64 },
  { day: 'MIÉ', hours: 6.8, score: 72, hrv: 52 },
  { day: 'JUE', hours: 7.5, score: 82, hrv: 61 },
  { day: 'VIE', hours: 8.5, score: 91, hrv: 70 },
  { day: 'SÁB', hours: 9.0, score: 94, hrv: 75 },
  { day: 'DOM', hours: 7.75, score: 85, hrv: 64 },
];

export const monthlySleepData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  hours: 6.5 + Math.random() * 2.5,
  score: 70 + Math.floor(Math.random() * 25),
  hrv: 50 + Math.floor(Math.random() * 30),
}));

// Sports data
export const sportsData = {
  waterSports: {
    daily: { sessions: 1, distance: 12.4, duration: 95, calories: 580 },
    weekly: { sessions: 3, distance: 54.2, duration: 285, calories: 1740 },
    monthly: { sessions: 12, distance: 218.6, duration: 1140, calories: 6960 },
    weeklyHistory: [
      { day: 'LUN', distance: 0 },
      { day: 'MAR', distance: 18.4 },
      { day: 'MIÉ', distance: 0 },
      { day: 'JUE', distance: 14.2 },
      { day: 'VIE', distance: 0 },
      { day: 'SÁB', distance: 21.6 },
      { day: 'DOM', distance: 0 },
    ],
  },
  tennis: {
    daily: { sessions: 1, duration: 90, calories: 420, matchesWon: 2 },
    weekly: { sessions: 4, duration: 360, calories: 1680, matchesWon: 7 },
    monthly: { sessions: 15, duration: 1350, calories: 6300, matchesWon: 28 },
    weeklyHistory: [
      { day: 'LUN', duration: 90 },
      { day: 'MAR', duration: 0 },
      { day: 'MIÉ', duration: 75 },
      { day: 'JUE', duration: 90 },
      { day: 'VIE', duration: 0 },
      { day: 'SÁB', duration: 105 },
      { day: 'DOM', duration: 0 },
    ],
  },
  gym: {
    daily: { sessions: 1, duration: 65, calories: 380, volume: 12400 },
    weekly: { sessions: 4, duration: 260, calories: 1520, volume: 49600 },
    monthly: { sessions: 16, duration: 1040, calories: 6080, volume: 198400 },
    weeklyHistory: [
      { day: 'LUN', volume: 12400 },
      { day: 'MAR', volume: 0 },
      { day: 'MIÉ', volume: 14200 },
      { day: 'JUE', volume: 11800 },
      { day: 'VIE', volume: 0 },
      { day: 'SÁB', volume: 11200 },
      { day: 'DOM', volume: 0 },
    ],
  },
  others: [
    { name: 'Ciclismo', sessions: 2, distance: 46.0 },
    { name: 'Running', sessions: 3, distance: 19.0 },
    { name: 'Paddleboard', sessions: 2, distance: 8.5 },
    { name: 'Yoga', sessions: 4, duration: 180 },
  ],
};

export const chartDataMock = {
  water_sports: [
    { date: '2025-10-05', distance: 14.2, maxSpeed: 38, duration: 95 },
    { date: '2025-10-18', distance: 18.6, maxSpeed: 42, duration: 110 },
    { date: '2025-11-02', distance: 12.0, maxSpeed: 35, duration: 80 },
    { date: '2025-11-15', distance: 21.3, maxSpeed: 45, duration: 125 },
    { date: '2025-12-01', distance: 9.5, maxSpeed: 31, duration: 65 },
    { date: '2026-01-10', distance: 16.8, maxSpeed: 40, duration: 100 },
    { date: '2026-01-24', distance: 22.1, maxSpeed: 48, duration: 130 },
    { date: '2026-02-08', distance: 18.4, maxSpeed: 44, duration: 115 },
    { date: '2026-02-22', distance: 25.6, maxSpeed: 52, duration: 145 },
    { date: '2026-03-08', distance: 19.2, maxSpeed: 46, duration: 120 },
    { date: '2026-03-15', distance: 21.6, maxSpeed: 49, duration: 135 },
    { date: '2026-03-19', distance: 12.4, maxSpeed: 36, duration: 90 },
  ],
  tennis: [
    { date: '2025-10-07', duration: 90, avgHr: 138, calories: 520 },
    { date: '2025-10-14', duration: 75, avgHr: 132, calories: 440 },
    { date: '2025-10-21', duration: 105, avgHr: 145, calories: 610 },
    { date: '2025-11-04', duration: 90, avgHr: 140, calories: 530 },
    { date: '2025-11-11', duration: 80, avgHr: 135, calories: 470 },
    { date: '2025-11-18', duration: 95, avgHr: 142, calories: 555 },
    { date: '2025-12-03', duration: 70, avgHr: 130, calories: 410 },
    { date: '2026-01-07', duration: 90, avgHr: 138, calories: 525 },
    { date: '2026-01-14', duration: 100, avgHr: 143, calories: 585 },
    { date: '2026-01-21', duration: 85, avgHr: 136, calories: 498 },
    { date: '2026-02-04', duration: 90, avgHr: 140, calories: 528 },
    { date: '2026-02-11', duration: 110, avgHr: 147, calories: 642 },
    { date: '2026-02-18', duration: 90, avgHr: 139, calories: 526 },
    { date: '2026-03-04', duration: 95, avgHr: 141, calories: 555 },
    { date: '2026-03-11', duration: 80, avgHr: 134, calories: 468 },
  ],
  gym: [
    { date: '2025-10-03', duration: 60, calories: 380 },
    { date: '2025-10-10', duration: 65, calories: 410 },
    { date: '2025-11-05', duration: 55, calories: 350 },
    { date: '2025-11-12', duration: 70, calories: 440 },
    { date: '2025-12-08', duration: 60, calories: 380 },
    { date: '2026-01-05', duration: 65, calories: 410 },
    { date: '2026-01-12', duration: 70, calories: 445 },
    { date: '2026-01-19', duration: 60, calories: 382 },
    { date: '2026-02-02', duration: 75, calories: 472 },
    { date: '2026-02-09', duration: 65, calories: 411 },
    { date: '2026-02-16', duration: 60, calories: 380 },
    { date: '2026-03-02', duration: 70, calories: 442 },
    { date: '2026-03-09', duration: 65, calories: 411 },
    { date: '2026-03-16', duration: 60, calories: 380 },
    { date: '2026-03-18', duration: 65, calories: 411 },
    { date: '2026-03-20', duration: 55, calories: 350 },
  ],
};

export const activityDetailMock = {
  water_sports: {
    activities: [
      { id: 'w1', date: '2026-03-19', sportType: 'windsurfing', duration: 90, distance: 12.4, maxSpeed: 36, avgHr: 142, calories: 580 },
      { id: 'w2', date: '2026-03-15', sportType: 'kiteboarding', duration: 135, distance: 21.6, maxSpeed: 49, avgHr: 155, calories: 820 },
      { id: 'w3', date: '2026-03-08', sportType: 'windsurfing', duration: 120, distance: 19.2, maxSpeed: 46, avgHr: 148, calories: 720 },
    ],
    stats: { totalSessions: 12, totalDistance: 218.6, totalDuration: 1140, totalCalories: 6960, avgDuration: 95, avgHr: undefined },
    personalBests: {
      longestSession: { date: '2026-02-22', value: 145, unit: 'min' },
      longestDistance: { date: '2026-02-22', value: 25.6, unit: 'km' },
      highestSpeed: { date: '2026-02-22', value: 52, unit: 'km/h' },
      mostCalories: { date: '2026-02-22', value: 980, unit: 'kcal' },
    },
  },
  tennis: {
    activities: [
      { id: 't1', date: '2026-03-11', sportType: 'tennis', duration: 80, distance: 0, maxSpeed: null, avgHr: 134, calories: 468 },
      { id: 't2', date: '2026-03-04', sportType: 'tennis', duration: 95, distance: 0, maxSpeed: null, avgHr: 141, calories: 555 },
      { id: 't3', date: '2026-02-18', sportType: 'tennis', duration: 90, distance: 0, maxSpeed: null, avgHr: 139, calories: 526 },
    ],
    stats: { totalSessions: 15, totalDistance: undefined, totalDuration: 1350, totalCalories: 6300, avgDuration: 90, avgHr: 139 },
    personalBests: {
      longestSession: { date: '2026-02-11', value: 110, unit: 'min' },
      longestDistance: null,
      highestSpeed: null,
      mostCalories: { date: '2026-02-11', value: 642, unit: 'kcal' },
    },
  },
  gym: {
    activities: [
      { id: 'g1', date: '2026-03-20', sportType: 'strength_training', duration: 55, distance: 0, maxSpeed: null, avgHr: null, calories: 350 },
      { id: 'g2', date: '2026-03-18', sportType: 'strength_training', duration: 65, distance: 0, maxSpeed: null, avgHr: null, calories: 411 },
      { id: 'g3', date: '2026-03-16', sportType: 'strength_training', duration: 60, distance: 0, maxSpeed: null, avgHr: null, calories: 380 },
    ],
    stats: { totalSessions: 16, totalDistance: undefined, totalDuration: 1040, totalCalories: 6080, avgDuration: 65, avgHr: undefined },
    personalBests: {
      longestSession: { date: '2026-02-02', value: 75, unit: 'min' },
      longestDistance: null,
      highestSpeed: null,
      mostCalories: { date: '2026-02-02', value: 472, unit: 'kcal' },
    },
  },
};

export const volumeHistoryMonthly = [
  { month: 'Oct', water: 180, tennis: 280, gym: 160 },
  { month: 'Nov', water: 220, tennis: 320, gym: 200 },
  { month: 'Dic', water: 150, tennis: 260, gym: 180 },
  { month: 'Ene', water: 190, tennis: 300, gym: 220 },
  { month: 'Feb', water: 240, tennis: 350, gym: 240 },
  { month: 'Mar', water: 210, tennis: 330, gym: 200 },
];

export const recentSession = {
  sport: 'WINGFOIL',
  location: 'PUNTA DEL ESTE',
  distance: 18.6,
  speed: '24.1 KT',
  hr: 142,
  intensity: 'STRENUOUS',
  date: 'HOY',
};

export const consistencyMatrix = Array.from({ length: 7 }, (_, week) =>
  Array.from({ length: 7 }, (_, day) => ({
    week,
    day,
    activity: Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : 0,
  }))
);

export const weeklyPlan = [
  { day: 'LUN', sport: 'GYM / FUERZA', completed: true, detail: 'UPPER BODY STRENGTH' },
  { day: 'MAR', sport: 'WINGFOIL', completed: true, detail: 'SESIÓN TÉCNICA - VIENTO 15KT' },
  { day: 'MIÉ', sport: 'TENIS', completed: true, detail: 'MATCH PLAY - 90 MIN' },
  { day: 'JUE', sport: 'GYM / FUERZA', completed: false, detail: 'LOWER BODY + CORE' },
  { day: 'VIE', sport: 'TENIS', completed: false, detail: 'ENTRENAMIENTO TÉCNICO' },
];
