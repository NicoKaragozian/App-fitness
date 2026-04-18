import GarminConnectModule from '@gooin/garmin-connect';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { eq } from 'drizzle-orm';
import db from './db/client.js';
import { garmin_tokens } from './db/schema/auth.js';

// @gooin/garmin-connect is CJS; support both named and default export shapes in ESM runtime.
const GarminConnect =
  (GarminConnectModule as unknown as { GarminConnect?: any }).GarminConnect ??
  GarminConnectModule;

// ── Encryption helpers (AES-256-GCM) ─────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.GARMIN_ENCRYPTION_KEY;
  if (!hex) throw new Error('GARMIN_ENCRYPTION_KEY env var is required');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('GARMIN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return key;
}

function encryptToken(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptToken(ciphertext: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

// ── In-memory client cache (LRU-ish: max 20 users, 15 min TTL) ───────────────

interface CacheEntry { client: any; createdAt: number }
const clientCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 20;

function cacheSet(userId: string, client: any) {
  if (clientCache.size >= CACHE_MAX) {
    // Evict oldest entry
    const oldest = [...clientCache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) clientCache.delete(oldest[0]);
  }
  clientCache.set(userId, { client, createdAt: Date.now() });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns an authenticated GarminConnect client for the given user,
 * or null if the user has no stored tokens.
 */
export async function getGarminClient(userId: string): Promise<any | null> {
  const cached = clientCache.get(userId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.client;
  }

  const [row] = await db.select().from(garmin_tokens).where(eq(garmin_tokens.user_id, userId));
  if (!row) return null;

  const oauth1Json = decryptToken(row.oauth1_ciphertext, row.oauth1_iv, row.oauth1_tag);
  const oauth2Json = decryptToken(row.oauth2_ciphertext, row.oauth2_iv, row.oauth2_tag);

  // Write tokens to a per-user temp directory, load them, then clean up.
  const tmpDir = path.join(os.tmpdir(), `drift_garmin_${userId}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'oauth1_token.json'), oauth1Json);
  fs.writeFileSync(path.join(tmpDir, 'oauth2_token.json'), oauth2Json);

  const client = new GarminConnect({ username: 'token', password: 'token' });
  await client.loadTokenByFile(tmpDir);

  try {
    fs.unlinkSync(path.join(tmpDir, 'oauth1_token.json'));
    fs.unlinkSync(path.join(tmpDir, 'oauth2_token.json'));
    fs.rmdirSync(tmpDir);
  } catch {}

  cacheSet(userId, client);
  return client;
}

/** Encrypts and persists Garmin OAuth tokens for the given user. */
export async function saveTokensForUser(
  userId: string,
  oauth1: object,
  oauth2: object
): Promise<void> {
  const e1 = encryptToken(JSON.stringify(oauth1));
  const e2 = encryptToken(JSON.stringify(oauth2));

  await db.insert(garmin_tokens).values({
    user_id: userId,
    oauth1_ciphertext: e1.ciphertext,
    oauth1_iv: e1.iv,
    oauth1_tag: e1.tag,
    oauth2_ciphertext: e2.ciphertext,
    oauth2_iv: e2.iv,
    oauth2_tag: e2.tag,
  }).onConflictDoUpdate({
    target: garmin_tokens.user_id,
    set: {
      oauth1_ciphertext: e1.ciphertext,
      oauth1_iv: e1.iv,
      oauth1_tag: e1.tag,
      oauth2_ciphertext: e2.ciphertext,
      oauth2_iv: e2.iv,
      oauth2_tag: e2.tag,
      updated_at: new Date(),
    },
  });

  // Invalidate cache so next request picks up fresh client
  clientCache.delete(userId);
}

/** Removes stored tokens for the given user and evicts them from cache. */
export async function deleteTokensForUser(userId: string): Promise<void> {
  await db.delete(garmin_tokens).where(eq(garmin_tokens.user_id, userId));
  clientCache.delete(userId);
}

/** Returns true if the user has stored Garmin tokens. */
export async function hasTokensForUser(userId: string): Promise<boolean> {
  if (clientCache.has(userId)) return true;
  const [row] = await db.select({ user_id: garmin_tokens.user_id })
    .from(garmin_tokens).where(eq(garmin_tokens.user_id, userId));
  return !!row;
}

/** Returns all user_ids that have Garmin tokens stored. */
export async function getAllUsersWithTokens(): Promise<string[]> {
  const rows = await db.select({ user_id: garmin_tokens.user_id }).from(garmin_tokens);
  return rows.map((r) => r.user_id);
}

// ── Garmin data-fetch helpers (accept a pre-built client) ────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function fetchActivities(client: any, startDate: Date, _endDate: Date) {
  try {
    const items = await client.getActivities(0, 100);
    await sleep(1000);
    return items.filter((a: any) => {
      const d = new Date(a.startTimeLocal || a.startTimeGMT || '');
      return d >= startDate;
    });
  } catch (err: any) {
    console.warn('[garmin] fetchActivities failed:', err?.message ?? err);
    return [];
  }
}

export async function fetchSleep(client: any, date: string) {
  try {
    const data = await client.getSleepData(new Date(date));
    await sleep(1000);
    return data;
  } catch (err: any) {
    console.warn('[garmin] fetchSleep failed:', err?.message ?? err);
    return null;
  }
}

export async function fetchStress(client: any, date: string) {
  try {
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

export async function fetchHRV(client: any, date: string) {
  try {
    const data = await client.getHRVData(new Date(date));
    await sleep(1000);
    return data;
  } catch (err: any) {
    console.warn('[garmin] fetchHRV failed:', err?.message ?? err);
    return null;
  }
}

export async function fetchDailySummary(client: any, date: string) {
  try {
    const data = await client.get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${date}`
    );
    await sleep(1000);
    return data;
  } catch (err: any) {
    if (err?.status !== 403 && !err?.message?.includes('403')) {
      console.warn('[garmin] fetchDailySummary failed:', err?.message ?? err);
    }
    try {
      const steps = await client.getSteps(new Date(date));
      await sleep(1000);
      const hr = await client.getHeartRate(new Date(date));
      await sleep(1000);
      return { totalSteps: steps, restingHeartRate: (hr as any)?.restingHeartRate ?? null };
    } catch {
      return null;
    }
  }
}
