/**
 * Wrapper sobre @perfood/capacitor-healthkit
 * Solo se usa en iOS nativo — en web devuelve datos vacíos sin crashear.
 */
import { Capacitor } from '@capacitor/core';

// Importación dinámica para evitar errores en web/Android
// IMPORTANTE: nunca retornar el plugin proxy desde una función async —
// JS trata cualquier objeto con .then como thenable y llama CapacitorHealthkit.then() nativo
let _hkPlugin: typeof import('@perfood/capacitor-healthkit').CapacitorHealthkit | null = null;

async function ensurePlugin(): Promise<void> {
  if (_hkPlugin || !Capacitor.isNativePlatform()) return;
  const mod = await import('@perfood/capacitor-healthkit');
  _hkPlugin = mod.CapacitorHealthkit;
}

export interface HKWorkout {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;           // en HORAS
  workoutActivityId: number;  // HKWorkoutActivityType rawValue
  workoutActivityName: string;
  totalEnergyBurned: number;  // kcal
  totalDistance: number;      // metros
}

export interface HKSleep {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;           // en HORAS
  sleepState: 'InBed' | 'Asleep';
}

export interface HKQuantity {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;           // en HORAS
  value: number;
  unitName: string;
}

export interface HealthKitData {
  workouts: HKWorkout[];
  sleep: HKSleep[];
  restingHR: HKQuantity[];
  steps: HKQuantity[];
}

// Keys para requestAuthorization → usa getTypes() del plugin Swift
// 'activity' cubre workoutType + sleepAnalysis
const AUTH_READ_TYPES = ['activity', 'steps', 'restingHeartRate'];

// Keys para queryHKitSampleType → usa getSampleType() del plugin Swift
const SAMPLE_NAMES = {
  WORKOUT_TYPE: 'workoutType',
  SLEEP_ANALYSIS: 'sleepAnalysis',
  RESTING_HEART_RATE: 'restingHeartRate',
  STEP_COUNT: 'stepCount',
};

/** Pide permisos de HealthKit. Devuelve true si el usuario los concedió. */
export async function requestHealthKitPermissions(): Promise<boolean> {
  await ensurePlugin();
  if (!_hkPlugin) return false;

  try {
    await _hkPlugin.requestAuthorization({
      all: [],
      read: AUTH_READ_TYPES,
      write: [],
    });
    return true;
  } catch (e) {
    console.error('[HealthKit] requestAuthorization failed:', e);
    return false;
  }
}

/** Obtiene datos de HealthKit de los últimos N días. */
export async function fetchHealthKitData(days = 90): Promise<HealthKitData> {
  await ensurePlugin();
  if (!_hkPlugin) {
    return { workouts: [], sleep: [], restingHR: [], steps: [] };
  }

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [workoutRes, sleepRes, hrRes, stepsRes] = await Promise.allSettled([
    _hkPlugin.queryHKitSampleType({
      sampleName: SAMPLE_NAMES.WORKOUT_TYPE,
      startDate,
      endDate,
      limit: 500,
    }),
    _hkPlugin.queryHKitSampleType({
      sampleName: SAMPLE_NAMES.SLEEP_ANALYSIS,
      startDate,
      endDate,
      limit: 2000,
    }),
    _hkPlugin.queryHKitSampleType({
      sampleName: SAMPLE_NAMES.RESTING_HEART_RATE,
      startDate,
      endDate,
      limit: 200,
    }),
    _hkPlugin.queryHKitSampleType({
      sampleName: SAMPLE_NAMES.STEP_COUNT,
      startDate,
      endDate,
      limit: 200,
    }),
  ]);

  const workouts = workoutRes.status === 'fulfilled'
    ? ((workoutRes.value as { resultData: HKWorkout[] }).resultData ?? [])
    : [];
  const sleep = sleepRes.status === 'fulfilled'
    ? ((sleepRes.value as { resultData: HKSleep[] }).resultData ?? [])
    : [];
  const restingHR = hrRes.status === 'fulfilled'
    ? ((hrRes.value as { resultData: HKQuantity[] }).resultData ?? [])
    : [];
  const steps = stepsRes.status === 'fulfilled'
    ? ((stepsRes.value as { resultData: HKQuantity[] }).resultData ?? [])
    : [];

  return { workouts, sleep, restingHR, steps };
}
