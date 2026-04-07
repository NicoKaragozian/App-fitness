# DRIFT — Claude Context

## Qué es esto
App de fitness personal conectada a Garmin Connect. Dashboard de datos biométricos: sueño, HRV, actividades, wellness. Stack: React + TypeScript (Vite) frontend, Express + SQLite backend, librería `@gooin/garmin-connect`.

## Estructura del proyecto
```
/                       → Frontend React (src/)
/server/                → Backend Express (src/)
/server/drift.db        → SQLite (gitignored)
/server/oauth*.json     → Tokens Garmin (gitignored)
/render.yaml            → Deploy config para Render
```

## Arquitectura

### Frontend (`src/`)
- `pages/` → Dashboard, Sports, Sleep, Wellness, AICoach, TrainingPlans, PlanDetail, ActiveWorkout
- `components/layout/` → Sidebar, Header (con logout button)
- `components/DynamicChart.tsx` → Chart genérico (bars/lines) configurado por `chartMetrics` del grupo
- `components/SportGroupEditor.tsx` → Modal para crear/editar/reordenar grupos de deportes (con selector de deportes agrupado por categoría)
- `components/InsightsCard.tsx` → Tarjetas de recomendaciones del motor de insights
- `context/AuthContext.tsx` → Auth global con `login`, `logout`, `enterDemoMode`
- `hooks/` → `useDailySummary`, `useSleep`, `useActivities`, `useHrv`, `useStress`, `useInsights`, `useSportGroups`, `useTrainingPlans`, `useTrainingPlan`, `useWorkout`, `useExerciseHistory`
- `api/client.ts` → `apiFetch()` helper

### Backend (`server/src/`)
- `index.ts` → Express server. En producción sirve `/dist/` estático + SPA fallback
- `garmin.ts` → Wrapper sobre la librería Garmin. Gestiona sesión OAuth
- `sync.ts` → Sync de datos: `syncInitial()` (30 días) y `syncToday()` (periódico cada 15min)
- `db.ts` → SQLite con tables: `activities`, `sleep`, `hrv`, `stress`, `daily_summary`, `sync_log`, `weekly_plan`, `sport_groups`, `training_plans`, `training_sessions`, `training_exercises`, `workout_logs`, `workout_sets`
- `routes/` → `auth`, `activities`, `health`, `sync`, `plan`, `insights`, `sport-groups`, `ai`, `training`
- `insights/` → Motor de recomendaciones: `stats.ts` (estadísticas), `rules.ts` (8 reglas), `index.ts` (orquestador)
- `ai/` → `prompts.ts` (system prompts por modo), `context.ts` (context builders), `index.ts` (orquestador analyze)

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
- Env vars necesarias: `NODE_ENV=production`, `DB_PATH=/data/drift.db`
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
| `training_exercises` | id autoincrement | `session_id` FK, `name`, `category` (warmup/main/core/cooldown), `target_sets`, `target_reps` TEXT, `notes`, `sort_order` |
| `workout_logs` | id autoincrement | `plan_id` FK, `session_id` FK, `started_at`, `completed_at`, `notes` |
| `workout_sets` | id autoincrement | `workout_log_id` FK CASCADE, `exercise_id` FK, `set_number`, `reps`, `weight` REAL (kg), `completed` |

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

**Nota**: las tablas de training plans (`training_plans`, `training_sessions`, etc.) y `weekly_plan` **no se purgan en logout** — son datos del usuario de la app, no de Garmin.

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

Si no se detecta ningún keyword → carga los 3 contextos (primera pregunta genérica).

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

### MarkdownText

Renderizador inline sin dependencias externas en `AICoach.tsx`. Soporta:
- `**bold**`, `*italic*`, `` `code` ``
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
- `src/hooks/useTrainingPlans.ts` → CRUD de planes + `generatePlan(goal, model)`
- `src/hooks/useTrainingPlan.ts` → Detalle de plan con sessions/exercises + `updateExercise()`
- `src/hooks/useWorkout.ts` → `startWorkout`, `logSet`, `updateSet`, `finishWorkout`, `useLastWeights`
- `src/hooks/useExerciseHistory.ts` → Historial de peso/reps por ejercicio
- `server/src/routes/training.ts` → Todos los endpoints `/api/training/*`
- `server/src/ai/prompts.ts` → Prompt `training_plan` (JSON mode)
- `server/src/ai/context.ts` → `buildTrainingContext(goal)` — carga actividades + sport_groups + sleep + HRV + stress

### Rutas `/api/training`

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/generate` | Generar plan via AI (no streaming, JSON mode) |
| GET | `/plans` | Listar planes con stats (sessionCount, workoutCount, lastWorkout) |
| GET | `/plans/:id` | Plan completo (sessions + exercises anidados) |
| PUT | `/plans/:id` | Editar metadata o archivar (`status: 'archived'`) |
| DELETE | `/plans/:id` | Borrar plan (CASCADE a sessions/exercises/logs/sets) |
| PUT | `/exercises/:id` | Editar targets de un ejercicio |
| POST | `/workouts` | Iniciar workout `{planId, sessionId}` → retorna `workoutId` |
| PUT | `/workouts/:id` | Finalizar workout (setea `completed_at`) |
| GET | `/workouts` | Historial `?planId=&sessionId=` |
| GET | `/workouts/:id` | Detalle workout con sus sets |
| POST | `/workouts/:id/sets` | Logear set `{exerciseId, setNumber, reps, weight}` |
| PUT | `/sets/:id` | Actualizar set |
| GET | `/exercises/:id/history` | Historial de peso/reps para progressive overload |

### Generación AI (JSON mode)

- Llama a Ollama con `format: "json"` y `stream: false` — respuesta completa, no SSE
- El prompt `training_plan` en `prompts.ts` define el schema JSON exacto esperado
- `buildTrainingContext(goal)` en `context.ts` incluye: objetivo del usuario, actividades 30 días, sport_groups, sleep 14 días, HRV 7 días, stress 7 días
- Validación de estructura antes de guardar; si falla → 502 con mensaje claro
- Guarda en DB con `db.transaction()`: plan → sessions → exercises

### UX de workout

- `ActiveWorkout.tsx` es **mobile-first** — se usa en el gym con el celular
- Timer en vivo arriba
- Sets pre-creados según `target_sets` del ejercicio
- **Auto-fill de peso**: carga el peso del último workout completado para esa sesión via `useLastWeights`
- Cada set tiene inputs de kg y reps + botón de completar (se guarda en backend inmediatamente)
- Botón "Finalizar Workout" o "Salir" con confirmación

### Colores en botones — CRÍTICO

`surface-lowest` **no existe** en el tailwind config. Para texto oscuro sobre botón primario (`bg-primary = #f3ffca`) usar `text-surface` (`#0e0e0e`).

### Comandos útiles

```bash
# Generar un plan (test directo)
curl -X POST http://localhost:3001/api/training/generate \
  -H 'Content-Type: application/json' \
  -d '{"goal":"Plan de fuerza funcional para complementar deportes acuáticos","model":"gemma3:12b"}'

# Ver planes guardados
curl http://localhost:3001/api/training/plans

# Ver historial de un ejercicio
curl http://localhost:3001/api/training/exercises/1/history
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
