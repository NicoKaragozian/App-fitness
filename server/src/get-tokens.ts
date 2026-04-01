/**
 * get-tokens.ts — Obtiene tokens OAuth de Garmin via browser real (bypass Cloudflare SSO)
 *
 * Uso:
 *   npx tsx server/src/get-tokens.ts
 *
 * Abre Chromium, esperá que el browser te redirija a connect.garmin.com/modern después
 * de loguearte, y el script captura el ticket automáticamente.
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

  // Calcular campos de expiración que la librería espera
  const now = Date.now();
  data.expires_at = Math.floor(now / 1000) + data.expires_in;
  data.refresh_token_expires_at = Math.floor(now / 1000) + (data.refresh_token_expires_in ?? 7776000);
  data.last_update_date = new Date(now).toISOString();
  data.expires_date = new Date(now + data.expires_in * 1000).toISOString();

  return data;
}

async function main() {
  console.log('\n=== Garmin Token Fetcher ===\n');
  console.log('Abriendo browser... Logueate en Garmin Connect y esperá que cargue el dashboard.');
  console.log('El script detecta el ticket automáticamente.\n');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  // Ocultar el flag navigator.webdriver que delata la automatización
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  let ticket: string | null = null;

  // Interceptar el redirect que contiene el ticket y ABORTAR la request
  // para que connect.garmin.com no consuma el ticket antes que nosotros
  await page.route('**', async (route) => {
    const url = route.request().url();
    const match = url.match(/[?&]ticket=([^&]+)/);
    if (match && !ticket) {
      ticket = decodeURIComponent(match[1]);
      console.log(`Ticket capturado (abortando redirect): ${ticket.substring(0, 20)}...`);
      await route.abort();
    } else {
      await route.continue();
    }
  });

  await page.goto(SSO_URL);

  // Esperar hasta que el ticket sea capturado (máx 5 min)
  const timeout = 300_000;
  const start = Date.now();
  while (!ticket) {
    if (Date.now() - start > timeout) {
      await browser.close();
      throw new Error('Timeout: no se capturó el ticket en 5 minutos');
    }
    await page.waitForTimeout(500);
  }

  await browser.close();
  console.log('\nBrowser cerrado. Procesando tokens...');

  const consumer = await fetchConsumerKeys();
  console.log('Consumer keys obtenidas.');

  const oauth1Token = await getOAuth1Token(ticket, consumer);
  console.log('OAuth1 token obtenido.');

  const oauth2Token = await getOAuth2Token(oauth1Token, consumer);
  console.log('OAuth2 token obtenido.');

  const oauth1Path = path.join(OUTPUT_DIR, 'oauth1_token.json');
  const oauth2Path = path.join(OUTPUT_DIR, 'oauth2_token.json');

  fs.writeFileSync(oauth1Path, JSON.stringify(oauth1Token, null, 2));
  fs.writeFileSync(oauth2Path, JSON.stringify(oauth2Token, null, 2));

  console.log(`\n✓ Tokens guardados en:`);
  console.log(`  ${oauth1Path}`);
  console.log(`  ${oauth2Path}`);
  console.log('\nAhora levantá el servidor — se va a conectar automáticamente.\n');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
