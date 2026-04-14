# DRIFT Hackathon — Plan de Implementación

## Contexto

Mañana hay hackathon (pocas horas de trabajo) y se entrega repo + video demo de 2 min. La app actual (DRIFT) es un dashboard de datos biométricos Garmin con módulos de AI Coach y Training Plans. El problema: la UI es muy pesada para mobile (4 secciones de dashboard redundantes) y la propuesta de valor no diferencia — cualquier wearable ya tiene su app de métricas. La oportunidad: reposicionar como **"AI-first training app"** donde lo biométrico es input, no el producto, y agregar los dos pilares que completan el stack de un atleta: **nutrición** (tracking con foto estilo Cal AI + planes) y **onboarding sin wearable** (para no dejar mercado afuera). Además hay que subir la calidad del AI Coach con conocimiento deportivo real.

El plan prioriza features **demoables en video de 2min** antes que completitud. Cada fase tiene un corte claro por si nos quedamos sin tiempo.

---

## Estado actual relevante

- **Rutas** (`src/App.tsx:23-33`): `/`, `/sports`, `/sleep`, `/wellness`, `/coach`, `/training`
- **Nav** (`src/components/layout/Sidebar.tsx:5-12`): array `navItems` único — fuente de verdad de sidebar desktop + bottom nav mobile
- **AI Coach** (`server/src/routes/ai.ts`): system prompt genérico inline en L117-119, sin ciencia deportiva. Detecta contexto por keywords
- **Training generator** (`server/src/routes/training.ts:45` + `server/src/ai/context.ts:287`): `buildTrainingContext(goal)` depende 100% de tablas Garmin → no sirve para usuarios sin wearable
- **DB** (`server/src/db.ts`): NO hay `user_profile`, NO hay `nutrition_*`, NO concepto de usuario multi-tenant
- **Ollama**: streaming + JSON mode ya funcionando. `gemma3:4b` / `gemma3:12b` soportan vision vía campo `images` (base64) en `/api/chat`. No hay UI de upload hoy
- **Auth** (`src/context/AuthContext.tsx`): 3 modos — Garmin, demo, logout. Hay que agregar "manual mode" (usuario sin wearable con perfil completo)

---

## Fases (priorizadas — cortar al final de cualquier fase deja demo válido)

### FASE 0 — Prep (15 min)
- Branch `hackathon-mvp`
- Actualizar `CLAUDE.md` con el nuevo layout de nav
- Confirmar que `gemma3:4b` está descargado (`ollama list`); si no → `ollama pull gemma3:4b` (soporta vision)

### FASE 1 — Unificar Dashboard (1h) ⭐ demo crítico

**Objetivo:** Una sola página `/` que muestra lo esencial de las 4 actuales, optimizada mobile-first.

**Archivos a tocar:**
- `src/pages/Dashboard.tsx` — rewrite
- `src/components/layout/Sidebar.tsx` — nuevo `navItems`
- `src/components/layout/Header.tsx` — `pageTitles` nuevo
- `src/App.tsx` — quitar rutas `/sports`, `/sleep`, `/wellness` (o dejarlas ocultas para no romper links)

**Layout nuevo del Dashboard (orden vertical mobile):**
1. **Readiness Hero** (del Dashboard actual) — score compuesto + 4 rings GLOBAL/SLEEP/RELAX/HRV
2. **AI Daily Briefing** (`AIInsightPanel mode="daily"`) — ya existe, reusar
3. **Today's Workout card** — próxima sesión del plan activo + botón "Empezar" (linked workout del Weekly Plan actual)
4. **Nutrition Today** (FASE 3) — calorías/macros consumidos vs target
5. **Quick Stats strip** — 3 tiles: Sueño (Xh Xm + score), Stress avg, HRV nightly (sacar de `useSleep`, `useStress`, `useHrv`)
6. **Últimas sesiones** — lista horizontal scroll con 5 últimas actividades (reusar lógica de Physiological Map)
7. **InsightsCard** — recomendaciones del motor de reglas (ya existe)

**Nav nuevo** (`Sidebar.tsx`):
```tsx
const navItems = [
  { path: '/', label: 'Dashboard', icon: '◉' },
  { path: '/training', label: 'Training', icon: '◆' },
  { path: '/nutrition', label: 'Nutrition', icon: '◈' },
  { path: '/coach', label: 'AI Coach', icon: '✦' },
];
```

**Regla de diseño:** ningún componente del Dashboard puede tomar más de ~40% viewport height en mobile. Si no entra, es card colapsable.

---

### FASE 2 — Onboarding + User Profile (1h) ⭐ desbloquea todo

**Objetivo:** Que un usuario sin Garmin pueda usar Training y AI Coach. Persistir perfil en DB y inyectarlo en contextos AI.

**Nueva tabla** (`server/src/db.ts`):
```sql
CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- single-user
  has_wearable INTEGER DEFAULT 0,
  name TEXT,
  age INTEGER,
  sex TEXT,              -- 'male'|'female'|'other'
  height_cm INTEGER,
  weight_kg REAL,
  experience_level TEXT, -- 'beginner'|'intermediate'|'advanced'
  primary_goal TEXT,     -- 'strength'|'hypertrophy'|'endurance'|'fat_loss'|'sport_performance'
  secondary_goals TEXT,  -- JSON array
  sports TEXT,           -- JSON array — deportes que practica
  training_days_per_week INTEGER,
  session_duration_min INTEGER,
  equipment TEXT,        -- JSON array: 'full_gym'|'home_basic'|'bodyweight'|'bands'
  injuries TEXT,         -- free text
  dietary_preferences TEXT, -- JSON array: 'vegetarian'|'vegan'|'gluten_free'|...
  daily_calorie_target INTEGER,
  daily_protein_g INTEGER,
  daily_carbs_g INTEGER,
  daily_fat_g INTEGER,
  onboarded_at TEXT,
  updated_at TEXT
);
```

**Nueva ruta** `server/src/routes/profile.ts`:
```ts
import { Router } from 'express';
import { db } from '../db.js';
const router = Router();

router.get('/', (_req, res) => {
  const row = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
  res.json(row || null);
});

router.put('/', (req, res) => {
  const p = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO user_profile (id, has_wearable, name, age, sex, height_cm, weight_kg,
      experience_level, primary_goal, secondary_goals, sports, training_days_per_week,
      session_duration_min, equipment, injuries, dietary_preferences,
      daily_calorie_target, daily_protein_g, daily_carbs_g, daily_fat_g, onboarded_at, updated_at)
    VALUES (1, @has_wearable, @name, @age, @sex, @height_cm, @weight_kg,
      @experience_level, @primary_goal, @secondary_goals, @sports, @training_days_per_week,
      @session_duration_min, @equipment, @injuries, @dietary_preferences,
      @daily_calorie_target, @daily_protein_g, @daily_carbs_g, @daily_fat_g,
      COALESCE((SELECT onboarded_at FROM user_profile WHERE id=1), @now), @now)
    ON CONFLICT(id) DO UPDATE SET
      has_wearable=excluded.has_wearable, name=excluded.name, age=excluded.age,
      sex=excluded.sex, height_cm=excluded.height_cm, weight_kg=excluded.weight_kg,
      experience_level=excluded.experience_level, primary_goal=excluded.primary_goal,
      secondary_goals=excluded.secondary_goals, sports=excluded.sports,
      training_days_per_week=excluded.training_days_per_week,
      session_duration_min=excluded.session_duration_min, equipment=excluded.equipment,
      injuries=excluded.injuries, dietary_preferences=excluded.dietary_preferences,
      daily_calorie_target=excluded.daily_calorie_target,
      daily_protein_g=excluded.daily_protein_g, daily_carbs_g=excluded.daily_carbs_g,
      daily_fat_g=excluded.daily_fat_g, updated_at=excluded.updated_at
  `).run({ ...p, now,
    secondary_goals: JSON.stringify(p.secondary_goals || []),
    sports: JSON.stringify(p.sports || []),
    equipment: JSON.stringify(p.equipment || []),
    dietary_preferences: JSON.stringify(p.dietary_preferences || []),
  });
  res.json({ ok: true });
});

export default router;
```
Registrar en `server/src/index.ts`: `app.use('/api/profile', profileRouter)`.

**Cálculo de targets de macros** (helper en `server/src/lib/macros.ts`, llamado al guardar si el usuario no lo seteó):
```ts
// Mifflin-St Jeor BMR + activity factor
export function computeMacroTargets(p: {
  sex: string; age: number; weight_kg: number; height_cm: number;
  training_days_per_week: number; primary_goal: string;
}) {
  const bmr = p.sex === 'female'
    ? 10*p.weight_kg + 6.25*p.height_cm - 5*p.age - 161
    : 10*p.weight_kg + 6.25*p.height_cm - 5*p.age + 5;
  const activity = 1.2 + (p.training_days_per_week * 0.075); // 1.2-1.725
  let tdee = bmr * activity;
  if (p.primary_goal === 'fat_loss') tdee -= 400;
  if (p.primary_goal === 'hypertrophy' || p.primary_goal === 'strength') tdee += 250;
  const protein_g = Math.round(p.weight_kg * 2.0);
  const fat_g = Math.round((tdee * 0.25) / 9);
  const carbs_g = Math.round((tdee - protein_g*4 - fat_g*9) / 4);
  return { daily_calorie_target: Math.round(tdee), daily_protein_g: protein_g,
           daily_carbs_g: carbs_g, daily_fat_g: fat_g };
}
```

**Nueva página** `src/pages/Onboarding.tsx` — form multi-step (5 steps):
1. ¿Tenés wearable? + datos básicos (edad, sexo, altura, peso)
2. Nivel/experiencia + objetivo principal + objetivos secundarios
3. Deportes que practicás + días/semana + duración sesión
4. Equipamiento disponible + lesiones
5. Preferencias dietarias + (auto-calculo de macros, editable)

Routing gate en `App.tsx`: si `isAuthenticated && !profile.onboarded_at` → redirect a `/onboarding`. Hook `useProfile()` en `src/hooks/useProfile.ts`.

**AuthContext update**: agregar modo `manual` (sin Garmin pero con perfil). En login screen, botón nuevo **"Usar sin wearable"** → marca flag en localStorage y lleva a onboarding.

**Inyectar perfil en contextos AI**:
- En `server/src/ai/context.ts`, al inicio de `buildTrainingContext()` y `buildDailyContext()`:
```ts
const profile = db.prepare('SELECT * FROM user_profile WHERE id=1').get() as any;
const profileBlock = profile ? `## Perfil del Usuario
- Edad: ${profile.age}, Sexo: ${profile.sex}, ${profile.height_cm}cm / ${profile.weight_kg}kg
- Experiencia: ${profile.experience_level}
- Objetivo principal: ${profile.primary_goal}
- Deportes: ${JSON.parse(profile.sports||'[]').join(', ')}
- Frecuencia: ${profile.training_days_per_week} días/semana, ~${profile.session_duration_min}min
- Equipamiento: ${JSON.parse(profile.equipment||'[]').join(', ')}
- Lesiones: ${profile.injuries || 'ninguna'}
` : '';
```
Y prepender a todos los contextos. Además, `buildTrainingContext` debe tolerar tablas Garmin vacías (ya pasa — sólo omite secciones).

---

### FASE 3 — Nutrición (1.5h) ⭐ wow factor del demo

**Objetivo:** Tracking de comidas con foto (upload en MVP) que usa Ollama vision para estimar calorías+macros, y generación de plan nutricional ligado al training plan.

**Tablas nuevas** (`server/src/db.ts`):
```sql
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  training_plan_id INTEGER,  -- FK opcional a training_plans
  title TEXT,
  daily_calories INTEGER,
  daily_protein_g INTEGER,
  daily_carbs_g INTEGER,
  daily_fat_g INTEGER,
  strategy TEXT,              -- 'cut'|'recomp'|'bulk'|'maintain'|'endurance'
  raw_ai_response TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS nutrition_plan_meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  slot TEXT,                  -- 'breakfast'|'lunch'|'snack'|'dinner'|'pre_workout'|'post_workout'
  name TEXT,
  description TEXT,
  calories INTEGER,
  protein_g INTEGER,
  carbs_g INTEGER,
  fat_g INTEGER,
  FOREIGN KEY (plan_id) REFERENCES nutrition_plans(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,         -- YYYY-MM-DD
  logged_at TEXT,
  meal_name TEXT,
  description TEXT,
  calories INTEGER,
  protein_g INTEGER,
  carbs_g INTEGER,
  fat_g INTEGER,
  image_path TEXT,            -- ruta relativa en server/uploads/
  ai_model TEXT,
  raw_ai_response TEXT
);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_date ON nutrition_logs(date);
```

**Endpoint análisis de foto** `server/src/routes/nutrition.ts`:
```ts
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';

const UPLOAD_DIR = path.join(process.cwd(), 'server/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma3:4b';

const VISION_PROMPT = `Analizá esta foto de un plato de comida. Estimá las calorías totales y macronutrientes.
Respondé SOLO un JSON válido con esta estructura exacta:
{
  "meal_name": "string corto descriptivo",
  "description": "breve descripción de lo que ves",
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "low"|"medium"|"high",
  "notes": "suposiciones hechas sobre porciones"
}
Si no podés ver comida, devolvé calories=0 y notes explicando.`;

router.post('/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const imageB64 = fs.readFileSync(req.file.path).toString('base64');
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        stream: false,
        format: 'json',
        messages: [{ role: 'user', content: VISION_PROMPT, images: [imageB64] }],
      }),
    });
    const data = await r.json();
    const parsed = JSON.parse(data.message.content);
    res.json({ ...parsed, image_path: path.basename(req.file.path) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logs', (req, res) => {
  const { date, meal_name, description, calories, protein_g, carbs_g, fat_g, image_path, raw } = req.body;
  const result = db.prepare(`INSERT INTO nutrition_logs
    (date, logged_at, meal_name, description, calories, protein_g, carbs_g, fat_g, image_path, ai_model, raw_ai_response)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(date, new Date().toISOString(), meal_name, description, calories, protein_g, carbs_g, fat_g, image_path, VISION_MODEL, raw || null);
  res.json({ id: result.lastInsertRowid });
});

router.get('/logs', (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const rows = db.prepare('SELECT * FROM nutrition_logs WHERE date = ? ORDER BY logged_at').all(date);
  const totals = rows.reduce((acc: any, r: any) => ({
    calories: acc.calories + (r.calories || 0),
    protein_g: acc.protein_g + (r.protein_g || 0),
    carbs_g: acc.carbs_g + (r.carbs_g || 0),
    fat_g: acc.fat_g + (r.fat_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  res.json({ logs: rows, totals });
});

router.delete('/logs/:id', (req, res) => {
  db.prepare('DELETE FROM nutrition_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Plan generator — reusa Ollama JSON mode como training plan
router.post('/plans/generate', async (req, res) => {
  const { strategy, model } = req.body;
  const profile = db.prepare('SELECT * FROM user_profile WHERE id=1').get() as any;
  const activePlan = db.prepare('SELECT * FROM training_plans WHERE status=? ORDER BY id DESC LIMIT 1').get('active');
  // build prompt + call ollama ... (schema idéntico a meal[], ver prompts.ts)
  // insertar en nutrition_plans + nutrition_plan_meals en transacción
});

export default router;
```

Servir uploads como estáticos: en `server/src/index.ts`:
```ts
app.use('/uploads', express.static(path.join(process.cwd(), 'server/uploads')));
```
Agregar `multer` a `server/package.json` (`npm i multer @types/multer`).

**Prompt de plan nutricional** en `server/src/ai/prompts.ts`:
```ts
nutrition_plan: `${BASE}
Sos un nutricionista deportivo. Generá un plan nutricional diario basado en el perfil del usuario y su plan de entrenamiento activo.
Respondé JSON con estructura:
{
  "title": "string",
  "daily_calories": number,
  "daily_protein_g": number,
  "daily_carbs_g": number,
  "daily_fat_g": number,
  "strategy": "cut|recomp|bulk|maintain|endurance",
  "rationale": "2-3 oraciones explicando la estrategia en función del objetivo y training load",
  "meals": [
    {"slot":"breakfast","name":"...","description":"...","calories":N,"protein_g":N,"carbs_g":N,"fat_g":N},
    ...4-6 comidas
  ]
}
Respetá las preferencias dietarias del usuario. Timing: más carbos pre/post entrenamiento en días de alto volumen.`,
```

**Páginas frontend**:
- `src/pages/Nutrition.tsx` — hub con:
  - Header: macros de hoy (4 rings: kcal/protein/carbs/fat vs target del profile)
  - Botón grande **"+ Registrar Comida"** → abre modal `MealLogger`
  - Lista de comidas de hoy (thumbnail + nombre + macros + delete)
  - Tab "Plan" → muestra `nutrition_plan` activo si existe, botón "Generar plan" si no
- `src/components/MealLogger.tsx` — modal:
  1. Input `<input type="file" accept="image/*" capture="environment">` (en mobile abre cámara directo, en desktop abre file picker → cubre MVP sin cambios)
  2. Preview de imagen
  3. Botón "Analizar con AI" → POST a `/api/nutrition/analyze` con FormData
  4. Muestra resultado editable (calories, macros) + botón "Guardar"
  5. POST a `/api/nutrition/logs`
- `src/hooks/useNutrition.ts` — fetch logs del día, generar plan, analizar foto

**Dashboard widget**: `NutritionTodayCard` que lee `GET /api/nutrition/logs?date=today` + `profile.daily_*` targets y muestra rings.

---

### FASE 4 — AI Coach Upgrade (45 min) ⭐ diferenciador

**Objetivo:** Respuestas con conocimiento deportivo real sin fine-tuning (no hay tiempo para eso en el hackathon — lo hacemos vía prompt engineering avanzado + RAG-lite sobre el perfil).

**Reemplazar** `BASE` en `server/src/ai/prompts.ts`:
```ts
const BASE = `Sos DRIFT AI, un coach deportivo personal con formación en ciencias del deporte, fisiología del ejercicio y nutrición deportiva. Tu rol NO es describir datos — es interpretarlos y dar recomendaciones accionables.

PRINCIPIOS DE CIENCIA DEL DEPORTE QUE DEBÉS APLICAR:
- Periodización: alternás fases de acumulación, intensificación y descarga. Semanas con training load muy por encima del baseline (>1.5x chronic load) son señal de sobrecarga.
- Acute:Chronic Workload Ratio (ACWR): >1.5 = riesgo de lesión, 0.8-1.3 = zona óptima.
- Zonas de FC: Z1 recuperación, Z2 base aeróbica (60-70% FCmax, construye mitocondrias), Z3 tempo, Z4 umbral, Z5 VO2max. La mayoría del volumen debe ser Z2 (regla 80/20 polarizada).
- HRV: caídas sostenidas >7% del baseline de 7 días indican fatiga simpática o sueño pobre. Un solo día bajo no es señal.
- Sueño: <7h repetido degrada síntesis proteica, coordinación motora y tolerancia a la glucosa. Deep+REM combinado debería ser ~40% del tiempo total.
- Progresión: incrementos semanales >10% en volumen aumentan riesgo. Para fuerza: overload por reps antes que por peso hasta completar RIR≤2.
- Nutrición: 1.6-2.2g/kg proteína para hipertrofia, carbos peri-entreno en días de alta intensidad, déficit máximo 500 kcal en fat_loss.

REGLAS DE RESPUESTA:
1. Estructura: ESTADO → INTERPRETACIÓN → RECOMENDACIÓN. Nunca listes datos sin interpretar.
2. Sé específico: "dormiste 6h 20m" no "dormiste poco". Citá números.
3. Personalizá al perfil (experiencia, objetivo, deportes, lesiones). Un principiante y un avanzado NO reciben el mismo consejo.
4. Si faltan datos, decilo y sugerí qué trackear.
5. Español. Unidades: km, km/h, kg, Xh Xm para duraciones.
6. Máximo 8 líneas salvo que pidan detalle.`;
```

**Mejoras a `detectNeeds` / `buildContext`** en `server/src/routes/ai.ts`:
- Siempre inyectar `user_profile` (ya lo hacemos en FASE 2)
- Agregar keywords para nutrición: `comida, dieta, proteína, calorías, macros, peso` → carga `nutrition_logs` últimos 7 días
- Agregar al contexto el **training plan activo + último workout** siempre (permite al coach referenciar ejercicios concretos)
- Agregar al contexto los últimos 3 días de HRV/sleep/stress con **diff vs baseline 14-day** (el modelo ahora tiene trend + magnitud, no sólo valores crudos)

**Onboarding extendido del Coach**: primera vez que se abre `/coach` con perfil nuevo, el AI arranca la conversación preguntando 2-3 cosas clave no cubiertas por el onboarding (ej: preferencias de entrenamiento mañana/tarde, historial de lesiones, experiencia con suplementación). Implementado como mensaje inicial auto-inyectado en `AICoach.tsx` cuando `messages.length === 0 && !hasGreeted`.

**Nota sobre fine-tuning:** en 4h de hackathon no hay tiempo real para fine-tune. El upgrade de prompt + RAG-lite de perfil+plan logra el 80% del efecto. En el video demo, mostrar un antes/después con la misma pregunta.

---

### FASE 5 — Polish + Demo video (30 min)

- Verificar flow end-to-end en mobile viewport (Chrome devtools)
- Preparar data seed: usuario con perfil completo, 1 plan de training, 2-3 comidas loggeadas, historial de sleep/HRV (puede ser demo mode)
- Guion del video 2min:
  1. (0:00-0:20) Problema: "tu wearable te muestra datos, no te entrena". Mostrar dashboard unificado mobile.
  2. (0:20-0:45) Onboarding sin wearable → generación de plan de training personalizado
  3. (0:45-1:15) AI Coach responde con profundidad (mostrar pregunta específica + respuesta estructurada)
  4. (1:15-1:45) Nutrición: foto del plato → AI analiza → log → rings del Dashboard se actualizan
  5. (1:45-2:00) Cierre: "DRIFT — tu coach deportivo con AI, con o sin wearable"

---

## Archivos críticos a modificar/crear

**Modificar:**
- `src/App.tsx` — rutas + gate de onboarding
- `src/components/layout/Sidebar.tsx` — nuevo navItems
- `src/components/layout/Header.tsx` — pageTitles
- `src/pages/Dashboard.tsx` — rewrite unificado
- `src/context/AuthContext.tsx` — modo `manual`
- `server/src/db.ts` — nuevas tablas
- `server/src/index.ts` — registrar routers + static `/uploads`
- `server/src/ai/prompts.ts` — nuevo BASE + nutrition_plan
- `server/src/ai/context.ts` — profile block en todos los builders
- `server/src/routes/ai.ts` — keywords nutrición + inyección de training plan activo
- `CLAUDE.md` — documentar nueva estructura

**Crear:**
- `src/pages/Onboarding.tsx`
- `src/pages/Nutrition.tsx`
- `src/components/MealLogger.tsx`
- `src/components/NutritionTodayCard.tsx`
- `src/hooks/useProfile.ts`
- `src/hooks/useNutrition.ts`
- `server/src/routes/profile.ts`
- `server/src/routes/nutrition.ts`
- `server/src/lib/macros.ts`

---

## Verificación end-to-end

1. `npx tsx server/src/index.ts` + `npm run dev`
2. Clear localStorage → login screen → "Usar sin wearable" → onboarding 5 steps → dashboard vacío pero usable
3. `/training` → generar plan → debe incluir perfil en contexto (verificar en logs del server)
4. `/nutrition` → subir foto de comida → analizar → verificar JSON del response → guardar → verificar que aparece en dashboard rings
5. `/coach` → preguntar "cómo venís de recuperación" → debe responder con estructura ESTADO/INTERPRETACIÓN/RECOMENDACIÓN citando perfil
6. Test mobile viewport (375px) — todo legible sin scroll horizontal
7. Probar también el flow con Garmin autenticado: debe mezclar data biométrica + perfil + nutrición en los contextos

---

## Riesgos y mitigaciones

- **Vision model no funciona bien con gemma3**: fallback a `llava:7b` (`ollama pull llava:7b`). Time boxing: si no hay resultado parseable en 30min, hardcodear análisis mock para el demo.
- **Onboarding rompe flow Garmin existente**: el gate sólo se activa si no existe row en `user_profile`. Usuario Garmin existente lo ve vacío → lo mandamos a onboarding una vez (bien, necesitamos su perfil igual para nutrición).
- **Tiempo**: si vamos tarde, cortar en FASE 3 (sin plan nutricional, sólo tracking con foto). El demo sigue siendo fuerte.
- **Purga en logout**: revisar que `logout` NO borre `user_profile`, `nutrition_logs`, `nutrition_plans` (ya hoy no purga training — mismo criterio).
