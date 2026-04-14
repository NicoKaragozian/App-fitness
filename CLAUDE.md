# DRIFT — Claude Context

## Qué es esto
App de fitness personal conectada a Garmin Connect. Dashboard de datos biométricos: sueño, HRV, actividades, wellness + nutrición con análisis de fotos AI. Stack: React + TypeScript (Vite) frontend, Express + SQLite backend, `@gooin/garmin-connect`. AI: Ollama (local) para AI Coach; Claude API para nutrición, Training Plans, Goals y Assessment.

## Estructura del proyecto
```
/                       → Frontend React (src/)
/server/                → Backend Express (src/)
/server/drift.db        → SQLite (gitignored)
/server/oauth*.json     → Tokens Garmin (gitignored)
/server/uploads/        → Fotos de comidas (gitignored)
/server/.env            → ANTHROPIC_API_KEY, OLLAMA_MODEL, etc.
/render.yaml            → Deploy Render
/docs/                  → Documentación interna
```

## Arquitectura

### Frontend (`src/`)
- `pages/` → Dashboard, Sports, SportDetail, Sleep, Wellness, AICoach, TrainingPlans, PlanDetail, ActiveWorkout, Nutrition, Goals, GoalDetail, Assessment, Login
- `components/` → DynamicChart, SportGroupEditor, InsightsCard, AIInsightPanel, MealLogger, NutritionTodayCard, ui/{MarkdownText, TTSButton, STTButton, AIProgressIndicator, ActivityRing, LoadingSkeleton}
- `context/AuthContext.tsx` → Auth global con `login`, `logout`, `enterDemoMode`
- `hooks/` → useDailySummary, useSleep, useActivities, useHrv, useStress, useInsights, useSportGroups, useTrainingPlans, useTrainingPlan, useWorkout, useExerciseHistory, useNutrition, useNutritionPlan, useProfile, useGoals, useGoal, useAssessment, useSTT, useTTS, useAIProgress
- `api/client.ts` → `apiFetch()` helper (lanza `error.status` con el HTTP code)

### Backend (`server/src/`)
- `index.ts` → Express. Producción: sirve `/dist/` + SPA fallback. Registra `/uploads` estático.
- `garmin.ts` → Wrapper OAuth Garmin
- `sync.ts` → `syncInitial()` (30 días) y `syncToday()` (cada 15min). Función `nextDay()` para offset Garmin.
- `db.ts` → SQLite. Migrations con ALTER TABLE + try/catch para idempotencia.
- `routes/` → auth, activities, health, sync, plan, insights, sport-groups, ai, training, nutrition, profile, goals, assessment
- `insights/` → stats.ts, rules.ts (8 reglas), index.ts
- `ai/` → prompts.ts, context.ts (buildAnalyzeContext, buildTrainingContext, buildGoalContext, getAssessmentContext), index.ts, claude.ts (claudeChat, claudeStreamChat, claudeStreamGenerate, claudeVisionStream, isClaudeConfigured), nutrition-context.ts
- `lib/` → macros.ts (Mifflin-St Jeor), upload-dir.ts (evita dependencia circular)

## El offset sistemático de Garmin (CRÍTICO)

**Garmin devuelve datos con 1 día de offset**: para obtener datos de fecha X, hay que consultar con X+1.

Implementado en `sync.ts` con `nextDay()`. Para sleep se usa `calendarDate` del response como clave. Para HRV/stress/summary se usa `dateStr` directamente.

**Sleep queries**: siempre filtrar `WHERE score IS NOT NULL` — el sync crea la fila del día siguiente con score null.

## Endpoints de Garmin — qué funciona

✅ Via librería: `getActivities`, `getSleepData`, `getHRVData`, `getSteps`, `getHeartRate`
✅ Via `client.get()`: `/wellness-service/wellness/dailyStress/${date}`
❌ 403 permanente: `/usersummary-service/usersummary/daily/${date}` (body battery, calories), `/wellness-service/wellness/dailyHeartRate/${date}`

**Body battery no disponible** → se usa `sleepScore` como proxy (rings READY y BATTERY en Dashboard).

## Rate limiting de Garmin (CRÍTICO)

Cloudflare WAF bloquea con 429 si hay demasiadas requests. `syncInitial()` hace ~190 requests.

- `sleep(1000)` después de **cada** request en `garmin.ts` (incluyendo fallbacks)
- Sync inicial tarda ~3 min — esperado
- Si persiste 429: esperar 30 min. Subir a `sleep(2000)` si hace falta.

## Sport type mapping

Garmin devuelve tipos con sufijo `_v2`. Strip antes de buscar:
```typescript
const key = sportType.toLowerCase().replace(/\s+/g, '_').replace(/_v\d+$/, '');
```
La columna `category` en `activities` es **legacy** — fuente de verdad: tabla `sport_groups`.

### Tabla `sport_groups`
- `id` TEXT slug, `sport_types` JSON array, `metrics` JSON array, `chart_metrics` JSON array `[{dataKey,name,type}]`, `sort_order`
- Al arrancar: si vacía, seedea 3 grupos default (water_sports, tennis, gym)

### Endpoint `/api/activities`
```typescript
{ groups: [{id, name, subtitle, color, icon, metrics, chartMetrics, data}], others, chartData, volumeHistory, trainingReadiness }
```

## Velocidades y formatos

- `maxSpeed` de Garmin: **m/s** → multiplicar × 3.6 para KM/H
- Sleep: mostrar como `Xh Xm` (nunca decimal): `` `${Math.floor(h)}h ${Math.round((h%1)*60)}m` ``

## Auth — login con Playwright

Garmin bloqueó SSO programático (Cloudflare WAF, marzo 2026). Requiere browser real.

**Flujo**: `npx tsx server/src/get-tokens.ts` → abre Chrome → login manual → captura ticket del redirect (abort antes de que lo consuma) → guarda `oauth1_token.json` + `oauth2_token.json` → polling en AuthContext detecta tokens automáticamente (cada 3s).

**Tokens duran ~90 días**. `tryRestoreSession()` los carga al reiniciar el server.

## Deploy (Render)

- Build: `npm install --legacy-peer-deps && npm run build && cd server && npm install`
- Start: `cd server && npx tsx src/index.ts`
- Env vars: `NODE_ENV=production`, `DB_PATH=/data/drift.db`, `ANTHROPIC_API_KEY=...`, `UPLOAD_PATH=/data/uploads`

## DB — resumen de tablas

| Tabla | Clave | Notas |
|-------|-------|-------|
| `activities` | `garmin_id` | `category` legacy |
| `sleep` | `date` = calendarDate | offset -1 día; filtrar `WHERE score IS NOT NULL` |
| `hrv` | `date` = dateStr | |
| `stress` | `date` = dateStr | |
| `daily_summary` | `date` = dateStr | `body_battery` siempre null |
| `weekly_plan` | autoincrement | `plan_id` FK nullable, `session_id` FK nullable |
| `sport_groups` | TEXT slug | `sport_types`, `metrics`, `chart_metrics` son JSON |
| `training_plans` | autoincrement | `status`: active/archived |
| `training_sessions` | autoincrement | `plan_id` FK |
| `training_exercises` | autoincrement | `session_id` FK, `description` TEXT (AI, nullable) |
| `workout_logs` | autoincrement | `plan_id` FK, `session_id` FK |
| `workout_sets` | autoincrement | `workout_log_id` FK CASCADE |
| `user_profile` | `id=1` single-row | macros auto-calculados Mifflin-St Jeor si no hay targets manuales |
| `nutrition_logs` | autoincrement | `image_path` = basename en `uploads/` |
| `nutrition_plans` | autoincrement | `strategy`: cut/bulk/recomp/maintain/endurance |
| `nutrition_plan_meals` | autoincrement | `option_number` 1/2/3 por slot |
| `goals` | autoincrement | `status`: active/completed/abandoned |
| `goal_milestones` | autoincrement | `goal_id` FK CASCADE, `workouts` JSON array |
| `user_assessment` | `id=1` single-row | contexto AI. `goals`, `available_days`, `equipment` son JSON |

## Logout — purga de datos

POST `/api/auth/logout` borra: activities, sleep, stress, hrv, daily_summary, sync_log.
**No se purgan**: training_plans, nutrition_logs, nutrition_plans, user_profile, goals, goal_milestones, user_assessment — son datos del usuario de la app, no de Garmin.

## Errores de API

`apiFetch()` lanza `Error` con `error.status`. Usar `error.status === 429` para distinguir rate-limit vs `401` credenciales incorrectas.

## AI Coach

Chat con Ollama (local). `POST /api/ai/chat` con `{ messages, model }`. El backend detecta keywords y carga contexto relevante (activities/sleep/wellness/nutrition). Sin keywords → carga los 4. Streaming via SSE. Historial en localStorage (`drift_ai_chats`).

Env vars: `OLLAMA_MODEL=gemma3:4b`, `OLLAMA_URL=http://localhost:11434`

## Training Plans

Generados con Claude API (streaming SSE). **Prompt de dos fases**:
1. 3-5 oraciones de análisis
2. Línea exacta `---PLAN_JSON---` seguida del JSON limpio

**CRÍTICO**: El prompt `training_plan` **NO hereda `BASE`**. BASE genera prosa mezclada con JSON → JSON inválido. El prompt de training es standalone.

Backend usa `beforeDone` callback para extraer JSON tras `---PLAN_JSON---`, guardarlo via `savePlanToDB()` y emitir `{"plan":...}` antes de `[DONE]`.

`buildTrainingContext(goal)` incluye: assessment, actividades 30 días, sport_groups, sleep 14 días, HRV 7 días, stress 7 días, ingesta nutricional promedio.

### Rutas `/api/training`

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/generate` | Genera plan SSE streaming |
| GET | `/plans` | Lista con stats |
| GET/PUT/DELETE | `/plans/:id` | CRUD. PUT archiva con `status:'archived'` |
| PUT | `/exercises/:id` | Editar targets |
| POST | `/exercises/:id/describe` | Descripción AI (claudeChat, no streaming) |
| POST | `/workouts` | Iniciar workout |
| PUT/DELETE | `/workouts/:id` | Finalizar / borrar |
| GET | `/workouts` | Historial `?planId=&sessionId=` |
| POST | `/workouts/:id/sets` | Logear set |
| PUT/DELETE | `/sets/:id` | Editar / borrar set |
| GET | `/exercises/:id/history` | Historial para progressive overload |

### Colores — CRÍTICO
`surface-lowest` **no existe** en Tailwind config. Para texto oscuro sobre `bg-primary` (#f3ffca) usar `text-surface` (#0e0e0e).

## Goals

Usa `claudeChat()` sin streaming (puede tardar 5-10s). Body: `{ objective, targetDate }`.

Schema JSON esperado de Claude:
```json
{ "title":"", "description":"", "milestones":[{"week":1,"title":"","description":"","target":"","workouts":[]}] }
```

`buildGoalContext` calcula semanas hasta `targetDate` e instruye a Claude a generar exactamente ese número de milestones.

`getAssessmentContext()` se inyecta en Training Plans, Goals, y todos los modos de analyze.

### Rutas `/api/goals`
GET/DELETE `/:id`, PUT `/:id` (editar title/description/status), PUT `/:goalId/milestones/:milestoneId` (`{completed:bool}`), POST `/generate`

## Assessment

Formulario de onboarding. Tabla `user_assessment` id=1, campos: name, age, height, weight, fitness_level, goals (JSON), sport_practice, sport_name, available_days (JSON), session_duration, equipment (JSON), injuries_limitations, training_preferences, short_term_goals, long_term_goals, special_considerations.

**Assessment vs user_profile**: distintos propósitos. Assessment → contexto AI. Profile → cálculo de macros.

## TTS/STT

Web Speech API del browser, sin backend. `useSTT` (lang: 'es-AR', continuous, auto-restart 60s) + `useTTS`. STT solo en Chrome/Edge.

## AI Progress Indicator

`useAIProgress` con modo `streaming` (avanza por tokens, tope 90%) o `timed` (curva logarítmica, tope 85%). Llama `complete()` para saltar a 100%.

## Nutrición

Claude API (claude-sonnet-4-6). Análisis de foto con `claudeVisionStream`, planes con `claudeStreamGenerate`.

### Claude provider (`server/src/ai/claude.ts`)
- `isClaudeConfigured()` → todos los endpoints lo llaman, retornan 503 si no está configurado
- `claudeChat()` → no-streaming (usado en describe y goals)
- `claudeStreamGenerate()` → streaming SSE, un user message, `beforeDone(fullContent)` callback
- `claudeStreamChat()` → igual pero multi-turn (AI Coach)
- `claudeVisionStream()` → streaming con imagen, max_tokens: 500

### SSE formats
**Analyze foto**: `{"image_path":"..."}` primero, luego `{"token":"..."}` tokens, luego `[DONE]`
**Plans/generate**: `{"token":"..."}` mientras genera, `{"plan":{...},"done":true}` al final, `[DONE]`
**Training/generate**: `{"token":"..."}`, `{"plan":{...},"recommendations":"..."}`, `[DONE]`

### UPSERT en user_profile (CRÍTICO)
`user_profile` usa `id=1` con `CHECK(id=1)`. Si no existe la fila, `UPDATE WHERE id=1` no hace nada y los datos se pierden silenciosamente. Siempre usar UPSERT:
```sql
INSERT INTO user_profile (id, campo, updated_at) VALUES (1, ?, ?)
ON CONFLICT(id) DO UPDATE SET campo = excluded.campo, updated_at = excluded.updated_at
```

### dietary_preferences
JSON **objeto** (no array) en `user_profile`:
```ts
{ diet_type: string, allergies: string[], excluded_foods: string, preferred_foods: string, meals_per_day: number }
```
Backwards-compat en nutrition-context.ts: si encuentra array (formato viejo), lo joinea.

### Lógica de targets
Si hay `user_profile.daily_calorie_target` → se usa. Si no → defaults: 2000kcal/150g prot/250g carbs/65g grasa.
Al generar un plan, los macro targets se escriben automáticamente en `user_profile` via UPSERT.

### `nutrition_plan_meals` — option_number
Cada slot puede tener filas con `option_number` 1/2/3 (opciones intercambiables). Agregado via migration en db.ts.

### Imágenes
Guardadas en `server/uploads/`. Servidas como estático. Proxy Vite: `'/uploads': 'http://localhost:3001'`. DELETE de log borra el archivo con `fs.unlink()` (non-blocking).

Env vars: `ANTHROPIC_API_KEY=sk-ant-...`, `CLAUDE_MODEL=claude-sonnet-4-6`, `UPLOAD_PATH=/data/uploads`

### Rutas `/api/nutrition`
POST `/analyze` (foto SSE), POST/GET `/logs`, GET `/logs/range`, PUT/DELETE `/logs/:id`, POST/GET `/plans/generate`, GET/DELETE `/plans/:id`

## Motor de Insights

`server/src/insights/`: stats.ts (estadísticas puras), rules.ts (8 reglas, top 3), index.ts.
**Stress trend**: "improving" significa valores suben (= peor) → se invierte en reglas.

## Readiness score (compuesto)
Sin body_battery (403 permanente). Score: Sleep 40% + Stress inverso 30% + HRV 30%.
HRV mapeado: ≤20ms→10, 20-38ms→10-45, 38-99ms→45-100, ≥99ms→100.
Si métrica vale 0, su peso se redistribuye. Calculado en `health.ts` y `activities.ts`.

## Notas importantes

1. **Reiniciar el servidor** después de cambios en `server/src/` — tsx no recarga automáticamente
2. Sync periódico solo corre si hay sesión activa (`garmin.getStatus() === true`)
3. `fetchDailySummary` falla con 403 y cae al fallback (`getSteps` + `getHeartRate`) — ambos tienen `sleep(1000)`
4. Hay ~24 actividades reales: 14 windsurf/kite, 9 tenis, 1 gym

## Comandos dev
```bash
npx tsx server/src/index.ts   # backend :3001
npm run dev                    # frontend :5175
curl -X POST http://localhost:3001/api/sync
```
