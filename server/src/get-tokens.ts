/**
 * get-tokens.ts — Fetches Garmin OAuth tokens via real browser (bypass Cloudflare SSO)
 *
 * Usage:
 *   npx tsx server/src/get-tokens.ts
 *
 * Opens Chromium, wait for the browser to redirect to connect.garmin.com/modern after
 * logging in, and the script captures the ticket automatically.
 */

import { chromium } from 'playwright';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import querystring from 'querystring';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..');

const SSO_URL = 'https://connect.garmin.com/signin';

const PREAUTH_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/preauthorized?login-url=https://connect.garmin.com/app&accepts-mfa-tokens=true';

const EXCHANGE_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0';

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
    headers: {
      ...headers,
      'User-Agent': 'com.garmin.android.apps.connectmobile',
    },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth1 preauth failed (${res.status}): ${text}`);

  const parsed = querystring.parse(text);
  if (!parsed.oauth_token || !parsed.oauth_token_secret) {
    throw new Error(`Unexpected OAuth1 response: ${text}`);
  }

  return {
    oauth_token: parsed.oauth_token as string,
    oauth_token_secret: parsed.oauth_token_secret as string,
  };
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

  // Calculate expiration fields that the library expects
  const now = Date.now();
  data.expires_at = Math.floor(now / 1000) + data.expires_in;
  data.refresh_token_expires_at = Math.floor(now / 1000) + (data.refresh_token_expires_in ?? 7776000);
  data.last_update_date = new Date(now).toISOString();
  data.expires_date = new Date(now + data.expires_in * 1000).toISOString();

  return data;
}

async function main() {
  console.log('\n=== Garmin Token Fetcher ===\n');
  console.log(`OUTPUT_DIR = ${path.resolve(OUTPUT_DIR)}`);
  console.log('Opening browser... Log in to Garmin Connect and wait for the dashboard to load.');
  console.log('The script detects the ticket automatically.\n');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  // Hide the navigator.webdriver flag that reveals automation
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  let ticket: string | null = null;

  // Intercept the redirect containing the ticket and ABORT the request
  // so connect.garmin.com doesn't consume the ticket before us
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

  // Wait until the ticket is captured (max 5 min)
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
  console.log('Consumer keys obtained.');

  const oauth1Token = await getOAuth1Token(ticket, consumer);
  console.log('OAuth1 token obtained.');

  const oauth2Token = await getOAuth2Token(oauth1Token, consumer);
  console.log('OAuth2 token obtained.');

  const oauth1Path = path.join(OUTPUT_DIR, 'oauth1_token.json');
  const oauth2Path = path.join(OUTPUT_DIR, 'oauth2_token.json');

  fs.writeFileSync(oauth1Path, JSON.stringify(oauth1Token, null, 2));
  fs.writeFileSync(oauth2Path, JSON.stringify(oauth2Token, null, 2));

  const verify1 = fs.existsSync(oauth1Path);
  const verify2 = fs.existsSync(oauth2Path);
  console.log(`\n✓ Tokens saved to:`);
  console.log(`  ${path.resolve(oauth1Path)} (exists: ${verify1})`);
  console.log(`  ${path.resolve(oauth2Path)} (exists: ${verify2})`);
  console.log('\nNow start the server — it will connect automatically.\n');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
