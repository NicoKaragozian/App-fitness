# DRIFT — Claude Context

## Qué es esto
App de fitness personal conectada a Garmin Connect. Dashboard de datos biométricos: sueño, HRV, actividades, wellness + módulo de nutrición con análisis de fotos via AI. Stack: React + TypeScript (Vite) frontend, Express + SQLite backend, librería `@gooin/garmin-connect`. AI: Ollama (local) para AI Coach; Claude API (Anthropic) para nutrición y **generación de Training Plans**.

## Estructura del proyecto
```
/                       → Frontend React (src/)
/server/                → Backend Express (src/)
/server/drift.db        → SQLite (gitignored)
/server/oauth*.json     → Tokens Garmin (gitignored)
/server/uploads/        → Fotos de comidas subidas (gitignored)
/server/.env            → Variables de entorno (ANTHROPIC_API_KEY, OLLAMA_MODEL, etc.)
/render.yaml            → Deploy config para Render
/docs/                  → Documentación interna: guías de verificación, notas de AI. La IA puede dejar archivos acá cuando haga falta (ej: guías de test manual, decisiones de arquitectura).
```

## Arquitectura

### Frontend (`src/`)
- `pages/` → Dashboard, Sports, Sleep, Wellness, AICoach, TrainingPlans, PlanDetail, ActiveWorkout, **Nutrition**
- `components/layout/` → Sidebar, Header (con logout button)
- `components/DynamicChart.tsx` → Chart genérico (bars/lines) configurado por `chartMetrics` del grupo
- `components/SportGroupEditor.tsx` → Modal para crear/editar/reordenar grupos de deportes (con selector de deportes agrupado por categoría)
- `components/InsightsCard.tsx` → Tarjetas de recomendaciones del motor de insights
- `components/MealLogger.tsx` → Modal de registro de comidas (foto con streaming Claude + manual)
- `components/NutritionTodayCard.tsx` → Widget de macros del día para el Dashboard
- `context/AuthContext.tsx` → Auth global con `login`, `logout`, `enterDemoMode`
- `hooks/` → `useDailySummary`, `useSleep`, `useActivities`, `useHrv`, `useStress`, `useInsights`, `useSportGroups`, `useTrainingPlans`, `useTrainingPlan`, `useWorkout`, `useExerciseHistory`, **`useNutrition`**, **`useNutritionPlan`**, **`useProfile`**
- `api/client.ts` → `apiFetch()` helper

### Backend (`server/src/`)
- `index.ts` → Express server. En producción sirve `/dist/` estático + SPA fallback. Registra `/uploads` como static.
- `garmin.ts` → Wrapper sobre la librería Garmin. Gestiona sesión OAuth
- `sync.ts` → Sync de datos: `syncInitial()` (30 días) y `syncToday()` (periódico cada 15min)
- `db.ts` → SQLite con tables: `activities`, `sleep`, `hrv`, `stress`, `daily_summary`, `sync_log`, `weekly_plan`, `sport_groups`, `training_plans`, `training_sessions`, `training_exercises`, `workout_logs`, `workout_sets`, **`user_profile`**, **`nutrition_logs`**, **`nutrition_plans`**, **`nutrition_plan_meals`**
- `routes/` → `auth`, `activities`, `health`, `sync`, `plan`, `insights`, `sport-groups`, `ai`, `training`, **`nutrition`**, **`profile`**
- `insights/` → Motor de recomendaciones: `stats.ts` (estadísticas), `rules.ts` (8 reglas), `index.ts` (orquestador)
- `ai/` → `prompts.ts` (system prompts por modo), `context.ts` (context builders), `index.ts` (orquestador analyze), **`claude.ts`** (provider Claude API: `claudeChat`, `claudeStreamChat`, `claudeStreamGenerate`, `claudeVisionStream`), **`nutrition-context.ts`** (context builder para planes nutricionales)
- `lib/` → **`macros.ts`** (calculadora Mifflin-St Jeor), **`upload-dir.ts`** (directorio de uploads)

## El offset sistemático de Garmin (CRÍTICO)

**Garmin devuelve datos con 1 día de offset**: cuando consultás la API para fecha X, obtenés datos con `calendarDate = X - 1`.

**Regla**: para obtener datos de "hoy" (ej: 2026-03-20), hay que consultar Garmin para "mañana" (2026-03-21).

Implementado en `sync.ts` con la función `nextDay()`:
```typescript
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return garmin.formatDate(d);
}
// syncDayData(dateStr) → fetchea Garmin con nextDay(dateStr), guarda bajo calendarDate
```

Para sleep, se usa `calendarDate` del response como clave en la DB. Para HRV/stress/summary se usa `dateStr` directamente.

## Endpoints de Garmin que funcionan

✅ **Funcionan via librería nativa**:
- `client.getActivities(0, 100)` → actividades
- `client.getSleepData(date)` → sleep (con offset, ver arriba)
- `client.getHRVData(date)` → HRV (con offset)
- `client.getSteps(date)` → steps (fallback)
- `client.getHeartRate(date)` → FC reposo (fallback)

✅ **Funcionan via `client.get(url)` con base `connectapi.garmin.com`**:
- `/wellness-service/wellness/dailyStress/${date}` → stress data

❌ **No funcionan (403 Forbidden)**:
- `/usersummary-service/usersummary/daily/${date}` → body battery, calories
- `/wellness-service/wellness/dailyHeartRate/${date}`

**Body battery no está disponible via API** → se usa `sleepScore` como proxy en el frontend (rings READY y BATTERY en Dashboard).

## Sport type mapping y grupos customizables

Garmin devuelve tipos con sufijo `_v2`. La función `categorize()` en `sync.ts` los normaliza y escribe la columna `category` en `activities`. Esta columna es **legacy** — la fuente de verdad ahora es la tabla `sport_groups`.

```typescript
// strip _v\d+ antes de buscar en el map
const key = sportType.toLowerCase().replace(/\s+/g, '_').replace(/_v\d+$/, '');
```

### Tabla `sport_groups`

Cada fila define un grupo de deportes customizable:
- `id` — slug (ej: `water_sports`, `mi_cardio`)
- `sport_types` — JSON array de sport_types normalizados (ej: `["surfing","kitesurfing"]`)
- `metrics` — JSON array de métricas a mostrar: `sessions`, `distance`, `duration`, `calories`, `avg_hr`, `max_speed`
- `chart_metrics` — JSON array `[{dataKey, name, type:"bar"|"line"}]`
- `sort_order` — orden de aparición en la UI

**Al arrancar el server**, si la tabla está vacía se seedean 3 grupos default (water_sports, tennis, gym) → el usuario existente no ve cambio.

### Rutas sport-groups

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/sport-groups` | Todos los grupos |
| POST | `/api/sport-groups` | Crear grupo |
| PUT | `/api/sport-groups/:id` | Editar grupo |
| DELETE | `/api/sport-groups/:id` | Borrar grupo |
| PUT | `/api/sport-groups/reorder` | Reordenar (`{order: ["id1","id2"]}`) |

### Endpoint `/api/activities`

La respuesta ya **no** tiene `sports.waterSports/tennis/gym` — ahora devuelve `groups[]`:
```typescript
{
  groups: [{ id, name, subtitle, color, icon, metrics, chartMetrics, data: {sessions, distance, ...} }],
  others: [...],   // sport_types no asignados a ningún grupo
  chartData: { [groupId]: [{date, distance, maxSpeed, duration, avgHr, calories}] },
  volumeHistory: [...],
  trainingReadiness: number | null,
}
```

### Endpoint `/api/activities/sport-types`

`GET /api/activities/sport-types` → devuelve todos los `sport_type` distintos registrados en la DB (normalizado). Usado por el editor de grupos para complementar la lista completa.

### Selector de deportes en SportGroupEditor

El editor de grupos muestra los deportes agrupados en **7 categorías** con accordions colapsables:

| Categoría | Ejemplos |
|-----------|---------|
| Agua | surfing, kitesurfing, windsurfing, kayaking, swimming... |
| Correr & Caminar | running, trail_running, walking, hiking... |
| Ciclismo | cycling, road_cycling, mountain_biking, indoor_cycling... |
| Montaña & Nieve | skiing, snowboarding, mountaineering, rock_climbing... |
| Raqueta | tennis, padel, squash, badminton, pickleball... |
| Gym & Fitness | strength_training, yoga, crossfit, boxing, dance... |
| Otros | golf, triathlon, soccer, basketball, skating... |

**Implementación**: `SPORT_TYPE_GROUPS` en `SportGroupEditor.tsx` tiene la lista completa (~70 tipos). `ALL_GARMIN_SPORT_TYPES` se deriva de ahí. `getAvailableSportTypes()` combina esa lista + los de la DB + los de grupos existentes, filtrando los ya reclamados por otros grupos.

- Las categorías con tipos ya seleccionados se **abren automáticamente** al editar
- Cada categoría muestra un **badge** con el conteo de seleccionados aunque esté colapsada
- Permite agregar deportes aunque no haya actividades registradas (ej: quiero agrupar "hiking" antes de empezar a usarlo)

## Velocidades

`maxSpeed` de Garmin viene en **m/s**. Convertir a km/h: `× 3.6`. Siempre mostrar en KM/H (no KT/nudos).

## Sleep — formato de horas

Siempre mostrar como `Xh Xm`, nunca como decimal (6.9h → 6h 54m):
```typescript
`${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`
```

## Auth — cómo loguearse (Playwright)

Garmin bloqueó el SSO programático con Cloudflare WAF (marzo 2026). El login ahora requiere un browser real.

**Flujo de login:**
1. Correr `npx tsx server/src/get-tokens.ts` desde la raíz del proyecto
2. Se abre Chrome — loguearse con credenciales de Garmin
3. El script captura el ticket del redirect, hace el exchange OAuth1→OAuth2, guarda los tokens en `server/oauth1_token.json` y `server/oauth2_token.json`, y cierra el browser
4. En el frontend, el polling de `AuthContext` detecta los tokens automáticamente (cada 3s), o usar el botón "YA CORRÍ EL SCRIPT"

**Duración de los tokens**: ~90 días (`refresh_token_expires_in = 7.776.000s`). Al reiniciar el server, `tryRestoreSession()` los carga automáticamente — no hace falta volver a loguearse hasta que expiren.

**Detalles técnicos del script:**
- Usa `chromium.launch({ channel: 'chrome' })` con `--disable-blink-features=AutomationControlled` para evitar detección de bot
- Oculta `navigator.webdriver` con `addInitScript`
- Intercepta el redirect con `page.route()` y lo **aborta** antes de que `connect.garmin.com/app` consuma el ticket (si no se aborta, el ticket queda inválido)
- `login-url` en el PREAUTH_URL debe ser `https://connect.garmin.com/app` (el service al que Garmin redirige tras login)
- `GarminConnect` requiere username/password no vacíos en el constructor aunque no se usen — se pasa `'token'` como placeholder

## Auth UX

- Sidebar desktop: indicador estado + botón Logout
- Header: badge clickeable (desktop) + icono logout (mobile)
- `AuthContext.logout()` llama POST `/api/auth/logout` y limpia estado

## Deploy (Render)

- Build: `npm install --legacy-peer-deps && npm run build && cd server && npm install`
- Start: `cd server && npx tsx src/index.ts`
- DB persistida en `/data/drift.db` via Render Disk
- Env vars necesarias: `NODE_ENV=production`, `DB_PATH=/data/drift.db`, `ANTHROPIC_API_KEY=...`, `UPLOAD_PATH=/data/uploads`
- GitHub repo: privado, nombre `drift`

## DB — resumen de tablas

| Tabla | Clave | Notas |
|-------|-------|-------|
| `activities` | `garmin_id` | `category` es legacy — la agrupación real viene de `sport_groups` |
| `sleep` | `date` = calendarDate de Garmin | offset -1 día vs query date; siempre filtrar `WHERE score IS NOT NULL` |
| `hrv` | `date` = dateStr (con offset aplicado en sync) | |
| `stress` | `date` = dateStr | |
| `daily_summary` | `date` = dateStr | `body_battery` siempre null (API bloqueada) |
| `weekly_plan` | id autoincrement | `day`, `sport`, `detail`, `completed` |
| `sport_groups` | `id` TEXT (slug) | `sport_types`, `metrics`, `chart_metrics` son JSON arrays |
| `training_plans` | id autoincrement | `title`, `objective`, `frequency`, `status` (active/archived), `ai_model`, `raw_ai_response` |
| `training_sessions` | id autoincrement | `plan_id` FK, `name`, `sort_order`, `notes` |
| `training_exercises` | id autoincrement | `session_id` FK, `name`, `category` (warmup/main/core/cooldown), `target_sets`, `target_reps` TEXT, `notes`, `sort_order`, `description` TEXT (generado por AI, nullable) |
| `workout_logs` | id autoincrement | `plan_id` FK, `session_id` FK, `started_at`, `completed_at`, `notes` |
| `workout_sets` | id autoincrement | `workout_log_id` FK CASCADE, `exercise_id` FK, `set_number`, `reps`, `weight` REAL (kg), `completed` |
| `user_profile` | `id=1` (single-user) | Perfil: datos físicos, objetivo, deportes, targets de macros (auto-calculados con Mifflin-St Jeor si no se setean manualmente). JSON arrays: `sports`, `equipment`, `dietary_preferences`, `secondary_goals` |
| `nutrition_logs` | id autoincrement | Log diario de comidas: `date`, `meal_slot`, `meal_name`, `calories`, macros, `image_path` (basename en `server/uploads/`), `ai_model`, `ai_confidence`. Indexado por `date`. |
| `nutrition_plans` | id autoincrement | Planes nutricionales generados por Claude: targets diarios, `strategy` (cut/bulk/recomp/maintain/endurance), `rationale`. `training_plan_id` FK opcional. |
| `nutrition_plan_meals` | id autoincrement | Comidas de un plan: `slot`, `name`, `description`, macros. `plan_id` FK CASCADE. |

## Comandos útiles

```bash
# Correr todo en dev
npx tsx server/src/index.ts   # backend en :3001
npm run dev                    # frontend en :5175

# Sync manual
curl -X POST http://localhost:3001/api/sync

# Ver estado de la DB
cd server && node --input-type=module -e "
import Database from 'better-sqlite3';
const db = new Database('drift.db');
console.log(db.prepare('SELECT date, score, duration_seconds FROM sleep ORDER BY date DESC LIMIT 5').all());
"

# Fetch datos de hoy manualmente (necesario después de reiniciar server por primera vez)
# Consultar Garmin con fecha de mañana para obtener datos de hoy
```

## Rate limiting de Garmin (CRÍTICO — lección aprendida)

Garmin usa Cloudflare WAF. Hacer demasiadas requests seguidas activa el ban de IP (error 429).

**Números concretos**: `syncInitial()` hace hasta ~190 requests (31 días × 4 métricas + fallbacks + actividades).

**Protecciones implementadas**:
- `sleep(1000)` después de **cada** request en `garmin.ts` (incluyendo el fallback de `fetchDailySummary`)
- El sync inicial tarda ~3 min — es esperado y seguro
- Si el 429 persiste, subir a `sleep(2000)` en `garmin.ts`

**Si ves error 429**: esperar 30 min antes de volver a intentar. El server devuelve 429 explícito con mensaje claro.

## Cambio de cuenta — arquitectura de seguridad

El logout es una **purga total**. POST `/api/auth/logout` hace:
1. `signalAbortSync()` → corta el `syncInitial()` si está corriendo (flag `abortSync` en `sync.ts`)
2. `garmin.logout()` → destruye sesión en memoria + borra `oauth1_token.json` y `oauth2_token.json`
3. `DELETE FROM` en las 6 tablas: `activities`, `sleep`, `stress`, `hrv`, `daily_summary`, `sync_log`

Sin esto, cambiar de cuenta mezcla datos de dos usuarios en la misma DB (el sync nuevo inyecta filas sobre los datos del usuario anterior).

**Nota**: las tablas de training plans (`training_plans`, `training_sessions`, etc.), `weekly_plan`, y las de **nutrición** (`nutrition_logs`, `nutrition_plans`, `nutrition_plan_meals`, `user_profile`) **no se purgan en logout** — son datos del usuario de la app, no de Garmin.

## Errores de API — manejo en frontend

`apiFetch()` en `client.ts` lanza un `Error` con `error.status` (el código HTTP) además del mensaje. Usar `error.status === 429` para distinguir ban de Garmin vs `401` credenciales incorrectas.

El backend ya devuelve 429 con mensaje en español cuando detecta rate limiting de Garmin en el login.

## AI Coach (chat con LLM local)

Chat conversacional con un modelo de lenguaje corriendo localmente via **Ollama**. Sin llamadas a APIs externas — todo corre en la máquina del usuario.

### Archivos
- `src/pages/AICoach.tsx` → UI del chat (frontend)
- `server/src/routes/ai.ts` → endpoint POST `/api/ai/chat` (backend)

### Cómo funciona

1. El usuario escribe un mensaje
2. El frontend hace POST `/api/ai/chat` con `{ messages, model }`
3. El backend detecta qué datos biométricos son relevantes para la pregunta (keywords)
4. Inyecta esos datos como contexto en el system prompt
5. Llama a Ollama con streaming y reenvía tokens via Server-Sent Events
6. El frontend renderiza el texto en tiempo real con un cursor parpadeante

### Detección de contexto (keyword-based)

`detectNeeds()` en `ai.ts` analiza el último mensaje del usuario y decide qué tablas consultar:

| Flag | Keywords detectadas | Datos que carga |
|------|--------------------|--------------------|
| `activities` | actividad, tenis, surf, kite, gym, running, velocidad... | últimas 40 actividades de 30 días |
| `sleep` | sueño, dormir, rem, profundo, descanso... | últimas 21 noches con score |
| `wellness` | estrés, hrv, pasos, recuperación, readiness... | HRV + stress + daily_summary (14 días) |
| `nutrition` | comida, almuerzo, cena, dieta, proteína, calorías, macros... | nutrition_logs últimos 7 días + targets del profile |

Si no se detecta ningún keyword → carga los 4 contextos (primera pregunta genérica).

### Selección de modelos

El backend acepta el campo `model` en el body del POST. Se valida con regex `/^[a-zA-Z0-9._:\-/]+$/` antes de usarlo.

Variable de entorno `OLLAMA_MODEL` define el default (actualmente `gemma3:4b`).

**Modelos disponibles localmente:**
- `gemma3:4b` — rápido, respuestas en ~5-10s
- `gemma3:12b` — más potente/preciso, respuestas más lentas

El frontend guarda el modelo elegido en `localStorage` con key `drift_ai_model`. El selector aparece en el header del chat y se deshabilita mientras hay streaming en curso.

### Variables de entorno (backend)

```
OLLAMA_MODEL=gemma3:4b     # modelo default
OLLAMA_URL=http://localhost:11434   # URL de Ollama
```

### Streaming

- Ollama devuelve NDJSON con `{ message: { content } }` por línea
- El backend reenvía como SSE: `data: {"token":"..."}` + `data: [DONE]`
- El frontend usa `ReadableStream` para leer sin buffering
- Botón de stop llama `AbortController.abort()` y Ollama corta el stream

### Historial de chats

El historial de conversaciones se persiste en `localStorage`:
- Key `drift_ai_chats` → array de chats `{ id, title, messages, model, createdAt }`
- Key `drift_ai_current` → ID del chat activo
- Sidebar izquierda muestra los chats guardados, permite crear uno nuevo o borrar
- Al enviar el primer mensaje de un chat nuevo, se genera el título automáticamente del contenido del mensaje

### MarkdownText

Componente separado en `src/components/ui/MarkdownText.tsx` (no inline en `AICoach.tsx`). Soporta:
- `***bold italic***`, `**bold**`, `*italic*`, `` `code` ``
- `# H1`, `## H2` (renderizados como labels uppercase estilo design system)
- `- item` / `* item` listas
- Líneas vacías como espaciado

### Comandos útiles

```bash
# Ver modelos descargados
ollama list

# Descargar modelo
ollama pull gemma3:12b

# Iniciar Ollama (si no está corriendo)
ollama serve

# Test directo del endpoint
curl -X POST http://localhost:3001/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hola"}],"model":"gemma3:4b"}'
```

## Training Plans (planes de entrenamiento personalizados)

Sección de planes de gym generados por AI, con tracking de ejercicios (sets/reps/peso) y seguimiento de progressive overload.

### Archivos
- `src/pages/TrainingPlans.tsx` → Hub: lista de planes + formulario de generación
- `src/pages/PlanDetail.tsx` → Vista de un plan: sesiones, ejercicios, botón "Empezar"
- `src/pages/ActiveWorkout.tsx` → Tracker de workout en vivo (mobile-first)
- `src/hooks/useTrainingPlans.ts` → CRUD de planes + `generatePlanStream(goal, onThinking)` (SSE streaming)
- `src/hooks/useTrainingPlan.ts` → Detalle de plan con sessions/exercises + `updateExercise()`
- `src/hooks/useWorkout.ts` → `startWorkout`, `logSet`, `updateSet`, `finishWorkout`, `useLastWeights`
- `src/hooks/useExerciseHistory.ts` → Historial de peso/reps por ejercicio
- `server/src/routes/training.ts` → Todos los endpoints `/api/training/*`
- `server/src/ai/prompts.ts` → Prompt `training_plan` (JSON mode)
- `server/src/ai/context.ts` → `buildTrainingContext(goal)` — carga actividades + sport_groups + sleep + HRV + stress

### Rutas `/api/training`

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/generate` | Generar plan via Claude con **streaming SSE** (igual que nutrición) |
| GET | `/plans` | Listar planes con stats (sessionCount, workoutCount, lastWorkout) |
| GET | `/plans/:id` | Plan completo (sessions + exercises anidados) |
| PUT | `/plans/:id` | Editar metadata o archivar (`status: 'archived'`) |
| DELETE | `/plans/:id` | Borrar plan (CASCADE a sessions/exercises/logs/sets) |
| PUT | `/exercises/:id` | Editar targets de un ejercicio |
| POST | `/exercises/:id/describe` | Generar descripción AI de cómo ejecutar el ejercicio (guarda en `description`) |
| POST | `/workouts` | Iniciar workout `{planId, sessionId}` → retorna `workoutId` |
| PUT | `/workouts/:id` | Finalizar workout (setea `completed_at`) |
| DELETE | `/workouts/:id` | Borrar workout log (CASCADE a sets) |
| GET | `/workouts` | Historial `?planId=&sessionId=` |
| GET | `/workouts/:id` | Detalle workout con sus sets (incluye `exercise_name` y `exercise_sort_order`) |
| POST | `/workouts/:id/sets` | Logear set `{exerciseId, setNumber, reps, weight}` |
| PUT | `/sets/:id` | Actualizar set (solo actualiza los campos presentes en el body) |
| DELETE | `/sets/:id` | Borrar un set individual |
| GET | `/exercises/:id/history` | Historial de peso/reps para progressive overload |

### Generación AI (streaming SSE con Claude)

Usa **Claude API** (no Ollama). La generación es streaming SSE igual que nutrición.

**Protocolo SSE del `/generate`:**
```
data: {"token":"..."}                          — texto de análisis visible al usuario
data: {"plan":{...},"recommendations":"..."}   — plan guardado en DB (antes de [DONE])
data: {"error":"..."}                          — si falla el parseo del JSON
data: [DONE]
```

**Prompt de dos fases** (`PROMPTS.training_plan` en `prompts.ts`):
1. Claude escribe 3-5 oraciones de análisis del usuario (actividad reciente, sueño/HRV, enfoque)
2. Línea exacta: `---PLAN_JSON---`
3. El JSON del plan sin markdown ni texto extra

El backend extrae el JSON usando el delimitador, lo parsea, lo guarda via `savePlanToDB()`, y emite el evento `{"plan":...}` en el `beforeDone` callback de `claudeStreamGenerate()`.

**CRÍTICO**: El prompt `training_plan` **NO hereda `BASE`**. El BASE prompt está diseñado para respuestas conversacionales y contradice la instrucción de generar JSON limpio — mezcla prosa con JSON y produce JSON inválido. El prompt de training es standalone.

`buildTrainingContext(goal)` en `context.ts` incluye: objetivo, actividades 30 días, sport_groups, sleep 14 días, HRV 7 días, stress 7 días.

Validación de estructura en `validatePlan()` antes de guardar. Guarda en DB con `db.transaction()`: plan → sessions → exercises via `savePlanToDB(plan, rawContent)`.

### UX de workout

- `ActiveWorkout.tsx` es **mobile-first** — se usa en el gym con el celular
- Timer en vivo arriba
- Sets pre-creados según `target_sets` del ejercicio
- **Auto-fill de peso**: carga el peso del último workout completado para esa sesión via `useLastWeights`
- Cada set tiene inputs de kg y reps + botón de completar (se guarda en backend inmediatamente)
- Botón "Finalizar Workout" o "Salir" con confirmación

### Descripción de ejercicios (AI)

`POST /api/training/exercises/:id/describe` genera con Claude (via `claudeChat`, no streaming) una descripción de 2-3 oraciones sobre cómo ejecutar el ejercicio (posición inicial, movimiento, músculo trabajado). Se guarda en la columna `description` de `training_exercises`. El botón aparece en `PlanDetail.tsx` y solo llama al endpoint si el ejercicio no tiene descripción aún.

La columna `description TEXT` se agregó via migration en `db.ts` (ALTER TABLE con try/catch para idempotencia).

### Historial de sesiones en PlanDetail

`PlanDetail.tsx` muestra el historial de workouts por sesión con `SessionHistoryPanel` (componente interno). Al hacer click en "N× completada" de una sesión:
- Se expande/colapsa el panel con todos los workouts de esa sesión
- Cada workout es expandible para ver los sets (carga detalle bajo demanda)
- Permite editar sets inline y borrar workouts o sets individuales
- Usa `DELETE /workouts/:id` y `DELETE /sets/:id`

### Colores en botones — CRÍTICO

`surface-lowest` **no existe** en el tailwind config. Para texto oscuro sobre botón primario (`bg-primary = #f3ffca`) usar `text-surface` (`#0e0e0e`).

### Comandos útiles

```bash
# Generar un plan (test directo — responde SSE, no JSON)
curl -X POST http://localhost:3001/api/training/generate \
  -H 'Content-Type: application/json' \
  -d '{"goal":"Plan de fuerza funcional para complementar deportes acuáticos"}'

# Ver planes guardados
curl http://localhost:3001/api/training/plans

# Ver historial de un ejercicio
curl http://localhost:3001/api/training/exercises/1/history
```

## Nutrición (tracking de comidas + planes AI)

Módulo de tracking diario de macros con análisis de fotos via Claude Vision y generación de planes nutricionales. Usa **Claude API** (no Ollama) — modelo `claude-sonnet-4-6`.

### Archivos
- `src/pages/Nutrition.tsx` → Página principal: rings de macros, lista de comidas, plan nutricional
- `src/components/MealLogger.tsx` → Modal de registro: modo foto (streaming) + modo manual
- `src/components/NutritionTodayCard.tsx` → Widget compacto en el Dashboard con mini progress bars
- `src/hooks/useNutrition.ts` → Fetch de logs, análisis de foto con SSE streaming, CRUD
- `src/hooks/useNutritionPlan.ts` → CRUD de planes nutricionales
- `src/hooks/useProfile.ts` → GET/PUT del perfil de usuario
- `server/src/routes/nutrition.ts` → Todos los endpoints `/api/nutrition/*`
- `server/src/routes/profile.ts` → GET/PUT `/api/profile`
- `server/src/ai/claude.ts` → Provider Claude API: `claudeChat()` y `claudeVisionStream()`
- `server/src/ai/nutrition-context.ts` → Context builder para generación de planes
- `server/src/lib/macros.ts` → Calculadora Mifflin-St Jeor BMR + TDEE + macros por objetivo
- `server/src/lib/upload-dir.ts` → `UPLOAD_DIR` — evita dependencia circular entre index.ts y nutrition.ts

### Rutas `/api/nutrition`

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/analyze` | Análisis de foto con Claude Vision **streaming SSE**. Multer recibe la imagen (max 10MB), la convierte a base64, llama `claudeVisionStream()`. Emite `{"image_path":"..."}` primero, luego tokens del análisis. |
| POST | `/logs` | Guardar log de comida |
| GET | `/logs` | Logs de un día + totales + targets. Query: `?date=YYYY-MM-DD`. Retorna `{ logs, totals, targets, hasProfile }` |
| GET | `/logs/range` | Logs por rango `?from=&to=`. Retorna `{ days: [{date, calories, protein_g, carbs_g, fat_g, log_count}] }` |
| PUT | `/logs/:id` | Editar log (usuario corrige estimación AI) |
| DELETE | `/logs/:id` | Borrar log + `fs.unlink()` de la imagen asociada |
| POST | `/plans/generate` | Genera plan con Claude **streaming SSE**. Body: `{ strategy?, linkedTrainingPlanId?, dietaryPreferences? }`. Emite tokens mientras Claude genera, termina con `{"plan":{...},"done":true}`. Antes de llamar a Claude guarda `dietaryPreferences` en `user_profile` (UPSERT). Al finalizar, actualiza macro targets en `user_profile` con los del plan. |
| GET | `/plans` | Listar planes |
| GET | `/plans/:id` | Plan completo con meals |
| DELETE | `/plans/:id` | Borrar plan (CASCADE a meals) |

### Rutas `/api/profile`

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/` | Retorna row de `user_profile` o null |
| PUT | `/` | Upsert. Si no hay targets manuales y hay datos físicos, calcula macros automáticamente con Mifflin-St Jeor |

### Claude provider (`server/src/ai/claude.ts`)

- `isClaudeConfigured()` → chequea `ANTHROPIC_API_KEY` en env. Todos los endpoints de nutrición lo llaman primero y retornan 503 si no está configurado.
- `claudeChat(systemPrompt, userMessage, maxTokens?)` → no-streaming, retorna texto. Usado por `training.ts` para generar descripción de ejercicios.
- `claudeStreamGenerate(systemPrompt, userMessage, res, { maxTokens?, beforeDone? })` → streaming SSE de un único user message. Thin wrapper sobre `claudeStreamChat`. `beforeDone(fullContent)` se llama con el texto completo antes de emitir `[DONE]` — usado en `/training/generate` para extraer el JSON (después del delimitador `---PLAN_JSON---`), guardar en DB y emitir `{"plan":{...},"recommendations":"..."}` como último evento.
- `claudeStreamChat(systemPrompt, messages[], res, opts)` → igual pero multi-turn (AI Coach).
- `claudeVisionStream(systemPrompt, userMessage, imageBase64, mediaType, imagePath, res)` → streaming SSE con imagen. Para análisis de fotos (`max_tokens: 500`).

**Formato SSE del analyze (foto):**
```
data: {"image_path":"1234567890-foto.jpg"}   ← primer evento, siempre
data: {"token":"..."}                         ← tokens del JSON
data: [DONE]                                  ← el frontend parsea el JSON acumulado
```

**Formato SSE del plans/generate:**
```
data: {"token":"..."}                                   ← tokens del JSON mientras Claude genera
data: {"plan":{id,title,meals,...},"done":true}         ← plan guardado (emitido en beforeDone)
data: [DONE]                                            ← cierre del stream
```
Si hay error de parseo o DB: `data: {"error":"mensaje"}` seguido de `[DONE]`.

### Prompts de nutrición (`server/src/ai/prompts.ts`)

- `PROMPTS.food_vision` → instrucciones para análisis de foto, responde SOLO JSON con `meal_name`, `description`, `items[]`, `calories`, macros, `confidence` (low/medium/high), `notes`
- `PROMPTS.nutrition_plan` → generación de plan FLEXIBLE. Pide 2-3 opciones intercambiables por slot (`option_number`). Cada opción tiene ingredientes con gramos exactos en `description`. Schema JSON: `{title, daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g, strategy, rationale, meals:[{slot, option_number, name, description, calories, protein_g, carbs_g, fat_g}]}`. `max_tokens: 8192`.

### Lógica de targets

Si hay `user_profile` con `daily_calorie_target` → se usan esos valores.
Si no hay perfil → defaults en `nutrition.ts`: 2000kcal / 150g prot / 250g carbs / 65g grasa.

`computeMacroTargets()` en `macros.ts`: BMR Mifflin-St Jeor × activity factor (1.2 + days×0.075) ± ajuste por objetivo. Proteína = peso×2g/kg, grasa = 25% TDEE, carbs = resto.

**Al generar un plan**, los macro targets del plan se escriben automáticamente en `user_profile` via UPSERT, por lo que los rings del día reflejan el plan actual.

### UPSERT en user_profile (CRÍTICO)

`user_profile` usa `id=1` con `CHECK(id=1)`. Si el usuario nunca configuró el perfil, **no existe la fila**. Por eso todos los writes a `user_profile` desde el flujo de nutrición usan UPSERT:

```sql
INSERT INTO user_profile (id, campo, updated_at) VALUES (1, ?, ?)
ON CONFLICT(id) DO UPDATE SET campo = excluded.campo, updated_at = excluded.updated_at
```

Usar `UPDATE WHERE id = 1` sin la fila creada no hace nada y los datos se pierden silenciosamente.

### Preferencias dietarias (`dietary_preferences`)

Columna `TEXT` en `user_profile`. Se guarda como JSON **objeto** (no array):

```ts
interface DietaryPreferences {
  diet_type: string;       // 'omnivore'|'vegetarian'|'vegan'|'pescatarian'|'keto'|'paleo'
  allergies: string[];     // ['lactose','gluten','nuts','shellfish','eggs','soy']
  excluded_foods: string;  // texto libre: "higado, brocoli"
  preferred_foods: string; // texto libre: "pollo, arroz, banana"
  meals_per_day: number;   // 3|4|5|6
}
```

El context builder (`nutrition-context.ts`) parsea el objeto y formatea cada campo para el prompt de Claude. Tiene backwards-compat: si encuentra un array (formato viejo), lo joinea como string.

Las preferencias se cargan en `Nutrition.tsx` via `useProfile` y pre-populan el formulario al generar un nuevo plan.

### Formulario de generación — 2 pasos

El flujo de generación de plan tiene 2 pasos controlados por `generationStep: 'strategy' | 'preferences'`:
1. **Estrategia**: 5 botones (Mantenimiento/Definicion/Volumen/Recomposicion/Resistencia) + "Siguiente →"
2. **Preferencias**: tipo de dieta (button group), alergias (chips multi-select), alimentos a evitar/preferir (text inputs), comidas por día (button group 3/4/5/6) + "Generar Plan con AI"

`generationStream` en `useNutritionPlan` expone los tokens en tiempo real. La UI muestra el JSON de Claude generándose en un box monoespaciado mientras espera.

### `nutrition_plan_meals` — columna `option_number`

Agregada via migration en `db.ts`. Cada slot puede tener múltiples filas con `option_number` 1/2/3 (opciones intercambiables). La UI (`PlanSlotOptions` en `Nutrition.tsx`) muestra tabs "Op. 1 / 2 / 3" para switchear. Planes viejos tienen `option_number = 1` por defecto y no muestran tabs.

### Imágenes

- Guardadas en `server/uploads/` (gitignored). En producción: `UPLOAD_PATH=/data/uploads`.
- Servidas como estático: `app.use('/uploads', express.static(UPLOAD_DIR))`
- Proxy en `vite.config.ts`: `'/uploads': 'http://localhost:3001'`
- En frontend: `<img src={`/uploads/${log.image_path}`} />`
- En DELETE de log: `fs.unlink()` borra el archivo (non-blocking, ignora errores)

### Variables de entorno

```
ANTHROPIC_API_KEY=sk-ant-...   # requerido para nutrición
CLAUDE_MODEL=claude-sonnet-4-6  # opcional, este es el default
UPLOAD_PATH=/data/uploads       # solo producción en Render
```

### Comandos útiles

```bash
# Test análisis de foto
curl -X POST http://localhost:3001/api/nutrition/analyze \
  -F "image=@/path/to/foto.jpg"

# Guardar log manual
curl -X POST http://localhost:3001/api/nutrition/logs \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-04-14","meal_slot":"lunch","meal_name":"Ensalada","calories":450,"protein_g":30,"carbs_g":25,"fat_g":20}'

# Ver logs del día
curl "http://localhost:3001/api/nutrition/logs?date=2026-04-14"

# Generar plan nutricional
curl -X POST http://localhost:3001/api/nutrition/plans/generate \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"maintain"}'

# Guardar/ver perfil
curl -X PUT http://localhost:3001/api/profile \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nico","age":28,"sex":"male","weight_kg":75,"height_cm":178,"training_days_per_week":4,"primary_goal":"maintain"}'
curl http://localhost:3001/api/profile
```

## Motor de Insights (inferencia local)

Motor de recomendaciones en `server/src/insights/` — puro TypeScript, sin dependencias ML.

- `stats.ts` → funciones estadísticas puras: rolling average, media, stddev, z-score, trend (regresión lineal), consecutive training days, training load
- `rules.ts` → 8 reglas evaluadas en orden de prioridad, devuelve top 3 recomendaciones. Cada regla recibe `InsightStats` y devuelve `Recommendation | null`
- `index.ts` → orquestador: consulta 30 días de todas las tablas, computa stats, evalúa reglas

**`GET /api/insights`** devuelve:
```typescript
{ recommendations: [{ type, title, description, priority, dataPoints }], stats }
```

**Tipos de recomendación**: `recovery`, `training`, `sleep`, `plan`

**Nota sobre stress trend**: "improving" en stats de stress significa que los valores suben (= peor), por eso el trend se invierte en las reglas.

## Readiness score (compuesto)

No hay `body_battery` disponible via API (403 permanente). Se usa un score compuesto:
- Sleep 40% + Stress inverso 30% + HRV 30%
- HRV mapeado a escala 10-100: ≤20ms→10, 20-38ms→10-45, 38-99ms→45-100, ≥99ms→100
- Calculado en `routes/health.ts` (endpoint `/summary`) y también en `routes/activities.ts`
- Si alguna métrica vale 0, su peso se redistribuye entre las disponibles

## Notas importantes

1. **Reiniciar el servidor** después de cambios en `server/src/` — tsx no recarga automáticamente
2. Los tokens OAuth (`oauth1_token.json`, `oauth2_token.json`) están en `server/` y son gitignored
3. El sync periódico solo corre si hay sesión activa (`garmin.getStatus() === true`)
4. La DB de producción en Render usa el disco montado en `/data/`
5. Hay ~24 actividades: 14 windsurfing/kiteboarding, 9 tenis, 1 gym (datos reales del usuario)
6. `fetchDailySummary` falla con 403 y cae al fallback (`getSteps` + `getHeartRate`) — ambos tienen `sleep(1000)`
7. **Sleep queries**: siempre filtrar `WHERE score IS NOT NULL` — el sync crea la fila del día siguiente con score null (por el offset de Garmin)
