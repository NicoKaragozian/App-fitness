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

  CREATE TABLE IF NOT EXISTS training_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    objective TEXT,
    frequency TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    ai_model TEXT,
    raw_ai_response TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS training_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS training_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'main',
    target_sets INTEGER,
    target_reps TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS workout_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES training_plans(id),
    session_id INTEGER NOT NULL REFERENCES training_sessions(id),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_log_id INTEGER NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES training_exercises(id),
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    completed INTEGER DEFAULT 0,
    notes TEXT
  );

`);

// Migration: agregar columna description a training_exercises si no existe
try {
  db.exec('ALTER TABLE training_exercises ADD COLUMN description TEXT');
} catch { /* ya existe, ignorar */ }

// Migration: vincular weekly_plan con training_plans/sessions
try {
  db.exec('ALTER TABLE weekly_plan ADD COLUMN plan_id INTEGER');
} catch { /* ya existe */ }
try {
  db.exec('ALTER TABLE weekly_plan ADD COLUMN session_id INTEGER');
} catch { /* ya existe */ }

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
