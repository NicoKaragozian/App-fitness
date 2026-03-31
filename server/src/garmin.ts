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

import fs from 'fs';

export function logout(): void {
  client = null;
  isLoggedIn = false;
  try {
    const oauth1 = path.join(SESSION_DIR, 'oauth1_token.json');
    const oauth2 = path.join(SESSION_DIR, 'oauth2_token.json');
    if (fs.existsSync(oauth1)) fs.unlinkSync(oauth1);
    if (fs.existsSync(oauth2)) fs.unlinkSync(oauth2);
  } catch (err) {
    console.error('Error deleting tokens:', err);
  }
}

export function getStatus(): boolean {
  return isLoggedIn;
}

export async function fetchActivities(startDate: Date, _endDate: Date) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    const activities = await client.getActivities(0, 100);
    await sleep(1000);
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
    await sleep(1000);
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
      `https://connectapi.garmin.com/wellness-service/wellness/dailyStress/${date}`
    );
    await sleep(1000);
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
    await sleep(1000);
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
    await sleep(1000);
    return data;
  } catch (err) {
    console.error('fetchDailySummary error:', err);
    // Fallback: try to get steps and heart rate individually
    try {
      const steps = await client!.getSteps(new Date(date));
      await sleep(1000);
      const hr = await client!.getHeartRate(new Date(date));
      await sleep(1000);
      return { totalSteps: steps, restingHeartRate: (hr as any)?.restingHeartRate ?? null };
    } catch {
      return null;
    }
  }
}

export { formatDate };
