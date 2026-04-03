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

  CREATE TABLE IF NOT EXISTS weekly_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    sport TEXT NOT NULL,
    detail TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_cache (
    cache_key TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sport_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#6a9cff',
    icon TEXT NOT NULL DEFAULT '◎',
    sport_types TEXT NOT NULL,
    metrics TEXT NOT NULL,
    chart_metrics TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

`);

// Seed default sport groups if table is empty
const groupCount = (db.prepare('SELECT COUNT(*) as c FROM sport_groups').get() as { c: number }).c;
if (groupCount === 0) {
  const ins = db.prepare(
    'INSERT INTO sport_groups (id, name, subtitle, color, icon, sport_types, metrics, chart_metrics, sort_order) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  ins.run('water_sports', 'WATER SPORTS', 'WINGFOIL / SURF', '#6a9cff', '◎',
    JSON.stringify(['surfing','kitesurfing','kiteboarding','windsurfing','stand_up_paddleboarding','sailing','kayaking']),
    JSON.stringify(['sessions','distance','duration','calories']),
    JSON.stringify([{dataKey:'distance',name:'DISTANCIA KM',type:'bar'},{dataKey:'maxSpeed',name:'VEL. MÁX KM/H',type:'line'}]),
    0);
  ins.run('tennis', 'TENNIS', 'MATCH / TRAINING', '#f3ffca', '◈',
    JSON.stringify(['tennis']),
    JSON.stringify(['sessions','duration','calories']),
    JSON.stringify([{dataKey:'duration',name:'DURACIÓN MIN',type:'bar'},{dataKey:'avgHr',name:'FC PROM BPM',type:'line'}]),
    1);
  ins.run('gym', 'GYM / STRENGTH', 'FUERZA / POTENCIA', '#ff7439', '⚡',
    JSON.stringify(['strength_training','gym','indoor_cardio']),
    JSON.stringify(['sessions','duration','calories']),
    JSON.stringify([{dataKey:'calories',name:'CALORÍAS KCAL',type:'bar'}]),
    2);
}

export default db;
