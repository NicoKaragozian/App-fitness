import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'drift.db');

const db: InstanceType<typeof Database> = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    garmin_id TEXT UNIQUE,
    sport_type TEXT NOT NULL,
    category TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration INTEGER,
    distance REAL,
    calories INTEGER,
    avg_hr INTEGER,
    max_speed REAL,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS sleep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    score INTEGER,
    duration_seconds INTEGER,
    deep_seconds INTEGER,
    light_seconds INTEGER,
    rem_seconds INTEGER,
    awake_seconds INTEGER,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS hrv (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    nightly_avg REAL,
    status TEXT,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS stress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    avg_stress INTEGER,
    max_stress INTEGER,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    steps INTEGER,
    calories INTEGER,
    body_battery INTEGER,
    resting_hr INTEGER,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT DEFAULT 'running'
  );
`);

export default db;
