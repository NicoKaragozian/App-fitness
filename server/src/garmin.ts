import GarminConnectModule from '@gooin/garmin-connect';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.resolve(path.join(__dirname, '..'));

console.log(`[garmin] SESSION_DIR = ${SESSION_DIR}`);

// @gooin/garmin-connect is CJS; support both named and default export shapes in ESM runtime.
const GarminConnect =
  (GarminConnectModule as unknown as { GarminConnect?: any }).GarminConnect ??
  GarminConnectModule;

let client: any = null;
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
    const oauth1Path = path.join(SESSION_DIR, 'oauth1_token.json');
    const oauth2Path = path.join(SESSION_DIR, 'oauth2_token.json');
    const has1 = fs.existsSync(oauth1Path);
    const has2 = fs.existsSync(oauth2Path);
    console.log(`[garmin] oauth1_token.json exists: ${has1} (${oauth1Path})`);
    console.log(`[garmin] oauth2_token.json exists: ${has2} (${oauth2Path})`);
    if (!has1 || !has2) {
      console.error('[garmin] Token files missing — run: npx tsx server/src/get-tokens.ts');
      return false;
    }
    client = new GarminConnect({ username: 'token', password: 'token' });
    await client.loadTokenByFile(SESSION_DIR);
    isLoggedIn = true;
    console.log('[garmin] Session restored from file');
    return true;
  } catch (err) {
    console.error('[garmin] tryRestoreSession failed:', err);
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
    return activities.filter((a: any) => {
      const d = new Date(a.startTimeLocal || a.startTimeGMT || '');
      return d >= startDate;
    });
  } catch (err: any) {
    console.warn('[garmin] fetchActivities failed:', err?.message ?? err);
    return [];
  }
}

export async function fetchSleep(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    const data = await client.getSleepData(new Date(date));
    await sleep(1000);
    return data;
  } catch (err: any) {
    console.warn('[garmin] fetchSleep failed:', err?.message ?? err);
    return null;
  }
}

export async function fetchStress(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    // Use generic get for stress endpoint
    const data = await client.get(
      `https://connectapi.garmin.com/wellness-service/wellness/dailyStress/${date}`
    );
    await sleep(1000);
    return data;
  } catch (err: any) {
    console.warn('[garmin] fetchStress failed:', err?.message ?? err);
    return null;
  }
}

export async function fetchHRV(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    const data = await client.getHRVData(new Date(date));
    await sleep(1000);
    return data;
  } catch (err: any) {
    console.warn('[garmin] fetchHRV failed:', err?.message ?? err);
    return null;
  }
}

export async function fetchDailySummary(date: string) {
  if (!client || !isLoggedIn) throw new Error('Not logged in');
  try {
    // Use generic get for user summary
    const data = await client.get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${date}`
    );
    await sleep(1000);
    return data;
  } catch (err: any) {
    // 403 es esperado — API bloqueada, caemos al fallback silenciosamente
    if (err?.status !== 403 && !err?.message?.includes('403')) {
      console.warn('[garmin] fetchDailySummary failed:', err?.message ?? err);
    }
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
