/**
 * get-tokens.ts — Fetches Garmin OAuth tokens via real browser (bypass Cloudflare SSO)
 *
 * Usage:
 *   npx tsx server/src/get-tokens.ts --email=you@example.com
 *
 * Opens Chrome, wait for redirect to connect.garmin.com/modern after logging in,
 * captures the ticket automatically, exchanges for OAuth1/2 tokens, and saves
 * them encrypted to the DB for the specified user.
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import querystring from 'querystring';
import db from './db/client.js';
import { user } from './db/schema/auth.js';
import { saveTokensForUser } from './garmin.js';

const SSO_URL = 'https://connect.garmin.com/signin';
const PREAUTH_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/preauthorized?login-url=https://connect.garmin.com/app&accepts-mfa-tokens=true';
const EXCHANGE_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0';

// ── Parse --email ─────────────────────────────────────────────────────────────

const emailArg: string = process.argv.find((a) => a.startsWith('--email='))?.split('=')[1] ?? '';
if (!emailArg) {
  console.error('Usage: npx tsx server/src/get-tokens.ts --email=you@example.com');
  process.exit(1);
}

// ── OAuth helpers ──────────────────────────────────────────────────────────────

async function fetchConsumerKeys(): Promise<{ consumer_key: string; consumer_secret: string }> {
  const res = await fetch('https://thegarth.s3.amazonaws.com/oauth_consumer.json');
  if (!res.ok) throw new Error(`Failed to fetch consumer keys: ${res.status}`);
  return res.json() as Promise<{ consumer_key: string; consumer_secret: string }>;
}

async function getOAuth1Token(
  ticket: string,
  consumer: { consumer_key: string; consumer_secret: string }
): Promise<{ oauth_token: string; oauth_token_secret: string }> {
  const oauth = new (OAuth as any)({
    consumer: { key: consumer.consumer_key, secret: consumer.consumer_secret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string: string, key: string) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    },
  });
  const url = `${PREAUTH_URL}&ticket=${encodeURIComponent(ticket)}`;
  const requestData = { url, method: 'GET' };
  const headers = oauth.toHeader(oauth.authorize(requestData));
  const res = await fetch(url, {
    headers: { ...headers, 'User-Agent': 'com.garmin.android.apps.connectmobile' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth1 preauth failed (${res.status}): ${text}`);
  const parsed = querystring.parse(text);
  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new Error(`Unexpected OAuth1 response: ${text}`);
  }
  return { oauth_token: parsed.oauth_token as string, oauth_token_secret: parsed.oauth_token_secret as string };
}

async function getOAuth2Token(
  oauth1Token: { oauth_token: string; oauth_token_secret: string },
  consumer: { consumer_key: string; consumer_secret: string }
): Promise<object> {
  const oauth = new (OAuth as any)({
    consumer: { key: consumer.consumer_key, secret: consumer.consumer_secret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string: string, key: string) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    },
  });
  const requestData = { url: EXCHANGE_URL, method: 'POST' };
  const token = { key: oauth1Token.oauth_token, secret: oauth1Token.oauth_token_secret };
  const headers = oauth.toHeader(oauth.authorize(requestData, token));
  const res = await fetch(EXCHANGE_URL, {
    method: 'POST',
    headers: {
      ...headers,
      'User-Agent': 'com.garmin.android.apps.connectmobile',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth2 exchange failed (${res.status}): ${text}`);
  const data = JSON.parse(text);
  const now = Date.now();
  data.expires_at = Math.floor(now / 1000) + data.expires_in;
  data.refresh_token_expires_at = Math.floor(now / 1000) + (data.refresh_token_expires_in ?? 7776000);
  data.last_update_date = new Date(now).toISOString();
  data.expires_date = new Date(now + data.expires_in * 1000).toISOString();
  return data;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve user id from email
  const [foundUser] = await db.select({ id: user.id, name: user.name })
    .from(user).where(eq(user.email, emailArg));

  if (!foundUser) {
    console.error(`\n[get-tokens] User not found for email: ${emailArg}`);
    console.error('[get-tokens] Make sure the user has signed up first, then run this script.');
    process.exit(1);
  }

  const userId = foundUser.id;
  console.log(`\n=== Garmin Token Fetcher ===`);
  console.log(`User: ${emailArg} (id=${userId})`);
  console.log('Opening browser... Log in to Garmin Connect and wait for the dashboard to load.\n');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  let ticket: string | null = null;

  await page.route('**', async (route) => {
    const url = route.request().url();
    const match = url.match(/[?&]ticket=([^&]+)/);
    if (match && !ticket) {
      ticket = decodeURIComponent(match[1]);
      console.log(`Ticket captured (aborting redirect): ${ticket.substring(0, 20)}...`);
      await route.abort();
    } else {
      await route.continue();
    }
  });

  await page.goto(SSO_URL);

  const timeout = 300_000;
  const start = Date.now();
  while (!ticket) {
    if (Date.now() - start > timeout) {
      await browser.close();
      throw new Error('Timeout: ticket was not captured within 5 minutes');
    }
    await page.waitForTimeout(500);
  }

  await browser.close();
  console.log('\nBrowser closed. Processing tokens...');

  const consumer = await fetchConsumerKeys();
  const oauth1Token = await getOAuth1Token(ticket, consumer);
  console.log('OAuth1 token obtained.');
  const oauth2Token = await getOAuth2Token(oauth1Token, consumer);
  console.log('OAuth2 token obtained.');

  await saveTokensForUser(userId, oauth1Token, oauth2Token);
  console.log(`\n✓ Tokens saved to DB for user ${emailArg} (id=${userId})`);
  console.log('\nNow start the server — sync will run automatically.\n');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
