import { GarminConnect } from '@gooin/garmin-connect';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '..');

let client: GarminConnect | null = null;
let isLoggedIn = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function saveSession() {
  if (!client) return;
  try {
    await client.exportTokenToFile(SESSION_DIR);
  } catch (err) {
    console.error('[garmin] Failed to save session:', err);
  }
}

export async function tryRestoreSession(): Promise<boolean> {
  try {
    client = new GarminConnect({ username: '', password: '' });
    await client.loadTokenByFile(SESSION_DIR);
    isLoggedIn = true;
    console.log('[garmin] Session restored from file');
    return true;
  } catch {
    client = null;
    return false;
  }
}

export async function login(email: string, password: string): Promise<void> {
  client = new GarminConnect({
    username: email,
    password: password,
  });
  await client.login();
  isLoggedIn = true;
  await saveSession();
}

export function logout(): void {
  client = null;
  isLoggedIn = false;
}

export function getStatus(): boolean {
  return isLoggedIn;
}

export async function fetchActivities(startDate: Date, _endDate: Date) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    const activities = await client.getActivities(0, 100);
    await sleep(500);
    return activities.filter((a) => {
      const d = new Date(a.startTimeLocal || a.startTimeGMT || '');
      return d >= startDate;
    });
  } catch (err) {
    console.error('fetchActivities error:', err);
    return [];
  }
}

export async function fetchSleep(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    const data = await client.getSleepData(new Date(date));
    await sleep(500);
    return data;
  } catch (err) {
    console.error('fetchSleep error:', err);
    return null;
  }
}

export async function fetchStress(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    // Use generic get for stress endpoint
    const data = await client.get<any>(
      `https://connectapi.garmin.com/usersummary-service/stats/stress/daily/${date}/${date}`
    );
    await sleep(500);
    return data;
  } catch (err) {
    console.error('fetchStress error:', err);
    return null;
  }
}

export async function fetchHRV(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    const data = await client.getHRVData(new Date(date));
    await sleep(500);
    return data;
  } catch (err) {
    console.error('fetchHRV error:', err);
    return null;
  }
}

export async function fetchDailySummary(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    // Use generic get for user summary
    const data = await client.get<any>(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${date}`
    );
    await sleep(500);
    return data;
  } catch (err) {
    console.error('fetchDailySummary error:', err);
    // Fallback: try to get steps and heart rate individually
    try {
      const steps = await client!.getSteps(new Date(date));
      const hr = await client!.getHeartRate(new Date(date));
      return { totalSteps: steps, restingHeartRate: (hr as any)?.restingHeartRate ?? null };
    } catch {
      return null;
    }
  }
}

export { formatDate };
