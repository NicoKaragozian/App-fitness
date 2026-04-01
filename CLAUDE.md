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
- `pages/` → Dashboard, Sports, Sleep, Wellness
- `components/layout/` → Sidebar, Header (con logout button)
- `context/AuthContext.tsx` → Auth global con `login`, `logout`, `enterDemoMode`
- `hooks/` → `useDailySummary`, `useSleep`, `useActivities`, `useHrv`, `useStress`
- `api/client.ts` → `apiFetch()` helper

### Backend (`server/src/`)
- `index.ts` → Express server. En producción sirve `/dist/` estático + SPA fallback
- `garmin.ts` → Wrapper sobre la librería Garmin. Gestiona sesión OAuth
- `sync.ts` → Sync de datos: `syncInitial()` (30 días) y `syncToday()` (periódico cada 15min)
- `db.ts` → SQLite con tables: `activities`, `sleep`, `hrv`, `stress`, `daily_summary`, `sync_log`
- `routes/` → `auth`, `activities`, `health`, `sync`

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

## Sport type mapping

Garmin devuelve tipos con sufijo `_v2`. La función `categorize()` en `sync.ts` los normaliza:
```typescript
// strip _v\d+ antes de buscar en el map
const key = sportType.toLowerCase().replace(/\s+/g, '_').replace(/_v\d+$/, '');
```
Categorías: `water_sports` (windsurfing, kiteboarding, surfing...), `tennis`, `gym`, `others`.

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
| `activities` | `garmin_id` | `category` calculado con `categorize()` |
| `sleep` | `date` = calendarDate de Garmin | offset -1 día vs query date |
| `hrv` | `date` = dateStr (con offset aplicado en sync) | |
| `stress` | `date` = dateStr | |
| `daily_summary` | `date` = dateStr | `body_battery` siempre null (API bloqueada) |

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

## Errores de API — manejo en frontend

`apiFetch()` en `client.ts` lanza un `Error` con `error.status` (el código HTTP) además del mensaje. Usar `error.status === 429` para distinguir ban de Garmin vs `401` credenciales incorrectas.

El backend ya devuelve 429 con mensaje en español cuando detecta rate limiting de Garmin en el login.

## Notas importantes

1. **Reiniciar el servidor** después de cambios en `server/src/` — tsx no recarga automáticamente
2. Los tokens OAuth (`oauth1_token.json`, `oauth2_token.json`) están en `server/` y son gitignored
3. El sync periódico solo corre si hay sesión activa (`garmin.getStatus() === true`)
4. La DB de producción en Render usa el disco montado en `/data/`
5. Hay ~24 actividades: 14 windsurfing/kiteboarding, 9 tenis, 1 gym (datos reales del usuario)
6. `fetchDailySummary` falla con 403 y cae al fallback (`getSteps` + `getHeartRate`) — ambos tienen `sleep(1000)`
