/**
 * Wrapper sobre @perfood/capacitor-healthkit
 * Solo se usa en iOS nativo — en web devuelve datos vacíos sin crashear.
 */
import { Capacitor } from '@capacitor/core';

// Importación dinámica para evitar errores en web/Android
let CapacitorHealthkit: typeof import('@perfood/capacitor-healthkit').CapacitorHealthkit | null = null;

async function getPlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!CapacitorHealthkit) {
    const mod = await import('@perfood/capacitor-healthkit');
    CapacitorHealthkit = mod.CapacitorHealthkit;
  }
  return CapacitorHealthkit;
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

const SAMPLE_NAMES = {
  WORKOUT_TYPE: 'HKWorkoutTypeIdentifier',
  SLEEP_ANALYSIS: 'HKCategoryTypeIdentifierSleepAnalysis',
  RESTING_HEART_RATE: 'HKQuantityTypeIdentifierRestingHeartRate',
  STEP_COUNT: 'HKQuantityTypeIdentifierStepCount',
};

/** Pide permisos de HealthKit. Devuelve true si el usuario los concedió. */
export async function requestHealthKitPermissions(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;

  try {
    await plugin.requestAuthorization({
      all: [],
      read: [
        SAMPLE_NAMES.WORKOUT_TYPE,
        SAMPLE_NAMES.SLEEP_ANALYSIS,
        SAMPLE_NAMES.RESTING_HEART_RATE,
        SAMPLE_NAMES.STEP_COUNT,
      ],
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
  const plugin = await getPlugin();
  if (!plugin) {
    return { workouts: [], sleep: [], restingHR: [], steps: [] };
  }

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [workoutRes, sleepRes, hrRes, stepsRes] = await Promise.allSettled([
    plugin.queryHKitSampleType({
      sampleName: SAMPLE_NAMES.WORKOUT_TYPE,
      startDate,
      endDate,
      limit: 500,
    }),
    plugin.queryHKitSampleType({
      sampleName: SAMPLE_NAMES.SLEEP_ANALYSIS,
      startDate,
      endDate,
      limit: 2000,
    }),
    plugin.queryHKitSampleType({
      sampleName: SAMPLE_NAMES.RESTING_HEART_RATE,
      startDate,
      endDate,
      limit: 200,
    }),
    plugin.queryHKitSampleType({
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
