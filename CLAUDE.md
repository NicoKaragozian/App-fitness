# DRIFT — Claude Context

## Qué es esto
App de fitness personal. Dashboard de datos biométricos: sueño, HRV, actividades, wellness. Stack: React + TypeScript (Vite) frontend, Express + SQLite backend.

**Estado actual**: en migración de Garmin Connect → Apple HealthKit para publicar en el App Store. El código Garmin sigue funcionando; la migración se hace por fases (ver sección MVP).

## Estructura del proyecto
```
/                       → Frontend React (src/)
/server/                → Backend Express (src/)
/server/drift.db        → SQLite (gitignored)
/server/.env            → API keys locales (gitignored)
/render.yaml            → Deploy config para Render
/legacy/                → Código Garmin+Ollama guardado para referencia
/MVP_PLAN.md            → Plan completo de migración a iOS App Store
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
- `index.ts` → Express server. Carga `.env` con path explícito desde `server/.env`. En producción sirve `/dist/` estático + SPA fallback
- `garmin.ts` → Wrapper sobre la librería Garmin. Gestiona sesión OAuth (**legacy — se eliminará en Fase 3**)
- `sync.ts` → Sync de datos: `syncInitial()` (30 días) y `syncToday()` (periódico cada 15min) (**legacy**)
- `db.ts` → SQLite con tables: `activities`, `sleep`, `hrv`, `stress`, `daily_summary`, `sync_log`, `weekly_plan`, `sport_groups`, `training_plans`, `training_sessions`, `training_exercises`, `workout_logs`, `workout_sets`
- `routes/` → `auth`, `activities`, `health`, `sync`, `plan`, `insights`, `sport-groups`, `ai`, `training`
- `insights/` → Motor de recomendaciones: `stats.ts` (estadísticas), `rules.ts` (8 reglas), `index.ts` (orquestador)
- `ai/` → `prompts.ts` (system prompts), `context.ts` (context builders), `index.ts` (orquestador analyze), **`llm.ts` (abstracción LLM → Groq)**

## Variables de entorno (server/.env)

```
GROQ_API_KEY=gsk_...         # API key de Groq (gratis en console.groq.com)
LLM_MODEL=llama-3.3-70b-versatile   # modelo default
# DB_PATH=/data/drift.db     # solo producción en Render
```

`index.ts` carga el `.env` con path explícito (`dotenvConfig({ path: path.join(_serverDir, '.env') })`) para que funcione independientemente de desde dónde se corra el proceso.

## El offset sistemático de Garmin (CRÍTICO — aplica solo mientras Garmin siga activo)

**Garmin devuelve datos con 1 día de offset**: cuando consultás la API para fecha X, obtenés datos con `calendarDate = X - 1`.

Implementado en `sync.ts` con la función `nextDay()`:
```typescript
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return garmin.formatDate(d);
}
```

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

**Al arrancar el server**, si la tabla está vacía se seedean 3 grupos default (water_sports, tennis, gym).

### Rutas sport-groups

| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/api/sport-groups` | Todos los grupos |
| POST | `/api/sport-groups` | Crear grupo |
| PUT | `/api/sport-groups/:id` | Editar grupo |
| DELETE | `/api/sport-groups/:id` | Borrar grupo |
| PUT | `/api/sport-groups/reorder` | Reordenar (`{order: ["id1","id2"]}`) |

### Endpoint `/api/activities`

```typescript
{
  groups: [{ id, name, subtitle, color, icon, metrics, chartMetrics, data: {sessions, distance, ...} }],
  others: [...],
  chartData: { [groupId]: [{date, distance, maxSpeed, duration, avgHr, calories}] },
  volumeHistory: [...],
  trainingReadiness: number | null,
}
```

## Velocidades

`maxSpeed` de Garmin viene en **m/s**. Convertir a km/h: `× 3.6`. Siempre mostrar en KM/H.

## Sleep — formato de horas

Siempre mostrar como `Xh Xm`, nunca como decimal (6.9h → 6h 54m):
```typescript
`${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`
```

## Auth — estado actual (Garmin, legacy)

Garmin bloqueó el SSO programático con Cloudflare WAF (marzo 2026). El login requiere un browser real via `npx tsx server/src/get-tokens.ts`. Flujo: abre Chrome → login manual → captura ticket OAuth → guarda tokens → server los restaura al reiniciar.

**Esto se eliminará en Fase 3 del MVP.** En la versión final el auth será username/password con invite codes.

## Auth UX (actual)

- Sidebar desktop: indicador estado + botón Logout
- Header: badge clickeable (desktop) + icono logout (mobile)
- `AuthContext.logout()` llama POST `/api/auth/logout` y limpia estado

## Deploy (Render)

- Build: `npm install --legacy-peer-deps && npm run build && cd server && npm install`
- Start: `cd server && npx tsx src/index.ts`
- DB persistida en `/data/drift.db` via Render Disk
- Env vars necesarias: `NODE_ENV=production`, `DB_PATH=/data/drift.db`, `GROQ_API_KEY=...`, `LLM_MODEL=llama-3.3-70b-versatile`
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

## Comandos útiles

```bash
# Correr todo en dev
npx tsx server/src/index.ts   # backend en :3001
npm run dev                    # frontend en :5175

# Ver estado de la DB
cd server && node --input-type=module -e "
import Database from 'better-sqlite3';
const db = new Database('drift.db');
console.log(db.prepare('SELECT date, score, duration_seconds FROM sleep ORDER BY date DESC LIMIT 5').all());
"
```

## AI Coach (chat con Groq)

Chat conversacional usando **Groq API** (Llama 3.3 70B). Gratis, 30 RPM, 14.400 req/día.

### Archivos
- `src/pages/AICoach.tsx` → UI del chat (frontend)
- `server/src/routes/ai.ts` → endpoint POST `/api/ai/chat` (backend)
- `server/src/ai/llm.ts` → abstracción LLM: `chatStream()`, `chatJSON()`, `chatCompletion()`

### Cómo funciona

1. El usuario escribe un mensaje
2. El frontend hace POST `/api/ai/chat` con `{ messages, model }`
3. El backend detecta qué datos biométricos son relevantes para la pregunta (keywords)
4. Inyecta esos datos como contexto en el system prompt
5. Llama a Groq con streaming (formato SSE OpenAI) y reenvía tokens via Server-Sent Events
6. El frontend renderiza el texto en tiempo real con un cursor parpadeante

### Detección de contexto (keyword-based)

`detectNeeds()` en `ai.ts` analiza el último mensaje del usuario y decide qué tablas consultar:

| Flag | Keywords detectadas | Datos que carga |
|------|--------------------|--------------------|
| `activities` | actividad, tenis, surf, kite, gym, running, velocidad... | últimas 40 actividades de 30 días |
| `sleep` | sueño, dormir, rem, profundo, descanso... | últimas 21 noches con score |
| `wellness` | estrés, hrv, pasos, recuperación, readiness... | HRV + stress + daily_summary (14 días) |

Si no se detecta ningún keyword → carga los 3 contextos.

### Abstracción LLM (`server/src/ai/llm.ts`)

```typescript
chatStream(messages, model)     // SSE streaming para AI Coach
chatJSON(messages, model)       // JSON mode para training plans
chatCompletion(messages, model) // texto libre (describe ejercicios)
```

Lee `GROQ_API_KEY` de forma lazy (dentro de las funciones, no a nivel módulo) para evitar problemas de orden de inicialización con dotenv en ESM.

### Selección de modelos

El frontend tiene selector con modelos Groq. El modelo elegido se guarda en `localStorage` con key `drift_ai_model`. Modelos disponibles:
- `llama-3.3-70b-versatile` — recomendado (default)
- `llama-3.1-8b-instant` — rápido
- `mixtral-8x7b-32768` — contexto largo

### Streaming

- Groq devuelve SSE OpenAI: `data: {"choices":[{"delta":{"content":"..."}}]}`
- El backend parsea y reenvía como: `data: {"token":"..."}` + `data: [DONE]`
- El frontend usa `ReadableStream` para leer sin buffering
- Botón de stop llama `AbortController.abort()`

### Historial de chats

Persiste en `localStorage`:
- Key `drift_ai_chats` → array de chats `{ id, title, messages, model, createdAt }`
- Key `drift_ai_current` → ID del chat activo

### Comandos útiles

```bash
# Test directo del endpoint
curl -X POST http://localhost:3001/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hola"}],"model":"llama-3.3-70b-versatile"}'
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
| POST | `/generate` | Generar plan via AI (JSON mode, no streaming) |
| GET | `/plans` | Listar planes con stats (sessionCount, workoutCount, lastWorkout) |
| GET | `/plans/:id` | Plan completo (sessions + exercises anidados) |
| PUT | `/plans/:id` | Editar metadata o archivar (`status: 'archived'`) |
| DELETE | `/plans/:id` | Borrar plan (CASCADE a sessions/exercises/logs/sets) |
| PUT | `/exercises/:id` | Editar targets de un ejercicio |
| POST | `/exercises/:id/describe` | Generar descripción AI de cómo ejecutar el ejercicio |
| POST | `/workouts` | Iniciar workout `{planId, sessionId}` → retorna `workoutId` |
| PUT | `/workouts/:id` | Finalizar workout (setea `completed_at`) |
| DELETE | `/workouts/:id` | Borrar workout log (CASCADE a sets) |
| GET | `/workouts` | Historial `?planId=&sessionId=` |
| GET | `/workouts/:id` | Detalle workout con sus sets |
| POST | `/workouts/:id/sets` | Logear set `{exerciseId, setNumber, reps, weight}` |
| PUT | `/sets/:id` | Actualizar set |
| DELETE | `/sets/:id` | Borrar un set individual |
| GET | `/exercises/:id/history` | Historial de peso/reps para progressive overload |

### Generación AI (JSON mode via Groq)

- Usa `chatJSON()` de `llm.ts` con `response_format: { type: 'json_object' }`
- El prompt `training_plan` en `prompts.ts` define el schema JSON exacto esperado
- `buildTrainingContext(goal)` incluye: objetivo, actividades 30 días, sport_groups, sleep 14 días, HRV 7 días, stress 7 días
- Validación de estructura antes de guardar; si falla → 502 con mensaje claro
- Guarda en DB con `db.transaction()`: plan → sessions → exercises

### UX de workout

- `ActiveWorkout.tsx` es **mobile-first** — se usa en el gym con el celular
- Timer en vivo arriba
- Sets pre-creados según `target_sets` del ejercicio
- **Auto-fill de peso**: carga el peso del último workout completado via `useLastWeights`
- Botón "Finalizar Workout" o "Salir" con confirmación

### Colores en botones — CRÍTICO

`surface-lowest` **no existe** en el tailwind config. Para texto oscuro sobre botón primario (`bg-primary = #f3ffca`) usar `text-surface` (`#0e0e0e`).

### Comandos útiles

```bash
# Generar un plan (test directo)
curl -X POST http://localhost:3001/api/training/generate \
  -H 'Content-Type: application/json' \
  -d '{"goal":"Plan de fuerza funcional para complementar deportes acuáticos","model":"llama-3.3-70b-versatile"}'
```

## Motor de Insights (inferencia local)

Motor de recomendaciones en `server/src/insights/` — puro TypeScript, sin dependencias ML.

- `stats.ts` → funciones estadísticas puras: rolling average, media, stddev, z-score, trend, consecutive training days, training load
- `rules.ts` → 8 reglas evaluadas en orden de prioridad, devuelve top 3 recomendaciones
- `index.ts` → orquestador: consulta 30 días de todas las tablas, computa stats, evalúa reglas

**`GET /api/insights`** devuelve:
```typescript
{ recommendations: [{ type, title, description, priority, dataPoints }], stats }
```

**Nota sobre stress trend**: "improving" en stats de stress significa que los valores suben (= peor), por eso el trend se invierte en las reglas.

## Readiness score (compuesto)

No hay `body_battery` disponible via API (403 permanente). Score compuesto:
- Sleep 40% + Stress inverso 30% + HRV 30%
- HRV mapeado a escala 10-100: ≤20ms→10, 20-38ms→10-45, 38-99ms→45-100, ≥99ms→100
- Calculado en `routes/health.ts` y `routes/activities.ts`
- Si alguna métrica vale 0, su peso se redistribuye entre las disponibles

## MVP — Plan de migración a iOS App Store

Plan completo en `MVP_PLAN.md`. Fases:

| Fase | Estado | Descripción |
|------|--------|-------------|
| 0: AI → Groq | ✅ Completada | `llm.ts` abstrae Groq. AI Coach y Training Plans funcionan con Groq |
| 1: Auth multi-user | 🔄 En curso | username/password + sessions + invite codes |
| 2: Capacitor + HealthKit | Pendiente | Wrap del SPA como app iOS, sync con Apple Health |
| 3: Limpiar Garmin | Pendiente | Borrar garmin.ts, sync.ts, get-tokens.ts y deps |
| 4: Testing en iPhone | Pendiente | Dev signing gratuito, expira cada 7 días |
| 5: App Store | Pendiente | Requiere pagar $99/año Apple Developer |

### Legacy folder

`legacy/` guarda el código Garmin+Ollama para poder restaurarlo:
- `legacy/server-garmin/` → garmin.ts, sync.ts, get-tokens.ts, routes/auth.ts, index.ts
- `legacy/server-ollama/` → routes/ai.ts y training con Ollama
- `legacy/README.md` → instrucciones de restauración

## Notas importantes

1. **Reiniciar el servidor** después de cambios en `server/src/` — tsx no recarga automáticamente
2. El `.env` está en `server/.env` — dotenv se carga con path explícito en `index.ts`
3. La DB de producción en Render usa el disco montado en `/data/`
4. Hay ~24 actividades: 14 windsurfing/kiteboarding, 9 tenis, 1 gym (datos reales del usuario)
5. **Sleep queries**: siempre filtrar `WHERE score IS NOT NULL` — el sync crea la fila del día siguiente con score null
6. **Groq rate limit**: 30 RPM en free tier. Para uso personal es suficiente.
