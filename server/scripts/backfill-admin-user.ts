/**
 * backfill-admin-user.ts
 *
 * Creates the initial admin user via Better Auth and backfills all existing
 * table rows with that user's ID. Also migrates Garmin tokens from disk
 * (oauth1_token.json / oauth2_token.json) if they exist.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-admin-user.ts \
 *     --email=you@example.com \
 *     --name="Your Name" \
 *     --password=yourpassword
 *
 * Run from the project root.
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../src/db/client.js';
import { user } from '../src/db/schema/auth.js';
import {
  activities, sleep, stress, hrv, daily_summary, sync_log,
  ai_cache, weekly_plan, sport_groups,
  training_plans, training_sessions, training_exercises, workout_logs, workout_sets,
  goals, goal_milestones,
  nutrition_logs, nutrition_plans, nutrition_plan_meals,
  user_profile, user_assessment,
} from '../src/db/schema/index.js';
import { auth } from '../src/auth.js';
import { saveTokensForUser } from '../src/garmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Parse CLI args ────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag?.split('=').slice(1).join('=');
}

const adminEmail = arg('email');
const adminName = arg('name') ?? 'Admin';
const adminPassword = arg('password');

if (!adminEmail || !adminPassword) {
  console.error('Usage: --email=you@example.com --password=yourpassword [--name="Your Name"]');
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[backfill] Starting admin user backfill...');

  // 1. Check for existing admin user
  const [existingUser] = await db.select({ id: user.id, role: user.role })
    .from(user).where(eq(user.email, adminEmail));

  let adminId: string;

  if (existingUser) {
    console.log(`[backfill] User ${adminEmail} already exists (id=${existingUser.id}). Skipping creation.`);
    adminId = existingUser.id;
  } else {
    // 2. Create admin via Better Auth
    console.log(`[backfill] Creating admin user: ${adminEmail}`);
    const response = await auth.api.signUpEmail({
      body: {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
      },
    });

    if (!response || !(response as any).user) {
      console.error('[backfill] Failed to create user. Response:', response);
      process.exit(1);
    }

    adminId = (response as any).user.id;
    console.log(`[backfill] Created user id=${adminId}`);
  }

  // 3. Set role = admin
  await db.update(user).set({ role: 'admin' }).where(eq(user.id, adminId));
  console.log(`[backfill] Set role=admin for ${adminEmail}`);

  // 4. Backfill user_id on all app tables
  const tables = [
    activities, sleep, stress, hrv, daily_summary, sync_log,
    ai_cache, weekly_plan, sport_groups,
    training_plans, training_sessions, training_exercises, workout_logs, workout_sets,
    goals, goal_milestones,
    nutrition_logs, nutrition_plans, nutrition_plan_meals,
    user_profile, user_assessment,
  ] as const;

  for (const table of tables) {
    try {
      const result = await (db as any).update(table).set({ user_id: adminId });
      console.log(`[backfill]   Updated ${table['_']['name']} → user_id set`);
    } catch (err: any) {
      console.warn(`[backfill]   Warning on ${(table as any)['_']['name']}: ${err.message}`);
    }
  }

  // 5. Migrate Garmin tokens from disk (if present)
  const SERVER_DIR = path.resolve(__dirname, '..');
  const oauth1Path = path.join(SERVER_DIR, 'oauth1_token.json');
  const oauth2Path = path.join(SERVER_DIR, 'oauth2_token.json');

  if (fs.existsSync(oauth1Path) && fs.existsSync(oauth2Path)) {
    console.log('[backfill] Found Garmin token files — migrating to DB...');
    try {
      const oauth1 = JSON.parse(fs.readFileSync(oauth1Path, 'utf8'));
      const oauth2 = JSON.parse(fs.readFileSync(oauth2Path, 'utf8'));
      await saveTokensForUser(adminId, oauth1, oauth2);
      console.log('[backfill] Garmin tokens migrated to DB.');
      console.log('[backfill] You can now safely delete:');
      console.log(`           ${oauth1Path}`);
      console.log(`           ${oauth2Path}`);
    } catch (err: any) {
      console.error('[backfill] Failed to migrate Garmin tokens:', err.message);
    }
  } else {
    console.log('[backfill] No Garmin token files found on disk — skipping.');
    console.log('[backfill] After the server is running, connect Garmin by running:');
    console.log(`           npx tsx server/src/get-tokens.ts --email=${adminEmail}`);
  }

  console.log('\n[backfill] ✓ Done. Now run migration 2 to make user_id NOT NULL:');
  console.log('           cd server && npm run db:migrate');
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
