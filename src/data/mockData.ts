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
