# Plan de Migración: Garmin Connect (no oficial) → Terra API

> Fecha: 2026-04-09
> Estado: Pendiente
> Objetivo: Poner DRIFT en producción con soporte multi-usuario (5-10 amigos) usando Terra API como aggregador oficial de datos Garmin.

---

## Por qué migrar

La integración actual usa `@gooin/garmin-connect`, una librería no oficial que scrapea la API interna de Garmin Connect. Problemas para producción:

1. **Login requiere Playwright** — cada usuario tiene que correr un script que abre Chrome. Imposible para usuarios normales.
2. **Garmin ya bloquea endpoints** — body battery y daily heart rate dan 403 permanente.
3. **Puede romperse en cualquier momento** — Garmin ya actualizó Cloudflare WAF en marzo 2026.
4. **Single-user** — hay un solo `client` global, no soporta múltiples usuarios.
5. **Rate limiting agresivo** — ~190 requests por sync inicial con `sleep(1000)` entre cada una.

---

## Qué es Terra API

[tryterra.co](https://tryterra.co) es un aggregador que ya tiene partnership oficial con Garmin (y Fitbit, Apple Watch, Oura, Whoop, etc.). Expone una API unificada:

- **OAuth widget** — el usuario conecta su Garmin en 3 clicks (sin scripts ni Playwright)
- **Webhooks** — Terra pushea datos a tu server cuando hay data nueva (sin polling)
- **Data completa** — incluyendo body battery, que hoy no podemos obtener
- **Free tier** — ~50-100 usuarios conectados gratis, después ~$100-200/mes

---

## Fases de implementación

### Fase 1: User management (sin romper nada existente)

**Nuevas tablas en `server/src/db.ts`:**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  terra_user_id TEXT,          -- se setea cuando conecta Garmin via Terra
  terra_provider TEXT,         -- 'GARMIN', 'FITBIT', etc.
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,
  used_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Agregar `user_id` a tablas existentes:**
- `activities`, `sleep`, `hrv`, `stress`, `daily_summary`, `sync_log`, `weekly_plan`, `training_plans`
- Usar `ALTER TABLE ... ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1` (try/catch, patrón existente)
- Crear índices compuestos `(user_id, date)` para tablas de salud

**Nuevos archivos:**
- `server/src/middleware/auth.ts` — middleware `requireAuth` que lee session cookie, busca en `sessions`, setea `req.userId`
- `server/src/routes/users.ts` — register (username + password + invite code), login, logout

**Dependencias nuevas:** `bcryptjs`, `cookie-parser`

---

### Fase 2: Agregar `user_id` a todas las queries

**Archivos a modificar (agregar `WHERE user_id = ?`):**
| Archivo | Cambio |
|---------|--------|
| `server/src/routes/health.ts` | Queries de sleep, hrv, stress, daily_summary |
| `server/src/routes/activities.ts` | Query de actividades + chartData |
| `server/src/insights/index.ts` | Recibe `userId` param, filtra todas las queries |
| `server/src/ai/context.ts` | Builders de chat y training context reciben `userId` |
| `server/src/routes/training.ts` | Filtrar plans por `user_id` |
| `server/src/routes/plan.ts` | Filtrar weekly_plan por `user_id` |
| `server/src/routes/insights.ts` | Pasar `req.userId` al orquestador |
| `server/src/routes/ai.ts` | Pasar `req.userId` a context builders |

**Sin cambios:**
- `server/src/insights/stats.ts`, `rules.ts` — funciones puras, sin acceso a DB
- `server/src/ai/prompts.ts` — system prompts estáticos
- `server/src/routes/sport-groups.ts` — global para todos (MVP)

---

### Fase 3: Integración Terra API

**Setup Terra:**
1. Registrarse en tryterra.co → obtener Dev ID + API Key
2. Configurar webhook URL: `https://<render-url>/api/terra/webhook`

**Nuevos archivos backend:**

| Archivo | Responsabilidad |
|---------|----------------|
| `server/src/terra.ts` | Wrapper Terra: `generateWidgetSession(userId)`, `deauthUser()`, `backfillData()` |
| `server/src/terra-mapper.ts` | Mapeo de payloads Terra → schema DB existente |
| `server/src/routes/terra-webhook.ts` | POST `/api/terra/webhook`: verifica firma, parsea, inserta en DB |

**Mapeo de datos Terra → DB:**

| Webhook Terra | Tabla DB | Campos mapeados |
|---------------|----------|-----------------|
| `activity` | `activities` | sport_type, duration, distance, calories, avg_hr, max_speed |
| `sleep` | `sleep` | score, duration, deep/light/rem/awake seconds |
| `daily` | `daily_summary` + `stress` | steps, calories, resting_hr, avg/max stress |
| `body` | `hrv` | nightly_avg, status |

**Diferencias clave vs integración actual:**
- **Sin date offset** — Terra no tiene el bug de +1 día. Eliminar `nextDay()`
- **Push vs poll** — webhooks en vez de `node-cron` cada 15min
- **Body battery** — probablemente disponible via Terra
- **Sport types** — Terra usa tipos normalizados diferentes, crear nuevo mapping

**Dependencia nueva:** `terra-api` (npm)

---

### Fase 4: Rewrite del frontend auth

**`src/context/AuthContext.tsx` — rewrite completo:**
- Estado: `user` (username, id, terraConnected), `isAuthenticated`, `loading`
- `login(username, password)` → POST `/api/users/login`
- `register(username, password, inviteCode)` → POST `/api/users/register`
- `connectGarmin()` → GET `/api/terra/widget-session` → abre widget Terra
- Eliminar polling de `/api/auth/status` cada 3s
- Mantener `enterDemoMode()`

**`src/pages/Login.tsx` — rewrite:**
- Form de login (username + password)
- Form de registro (username + password + invite code)
- Post-login: si no tiene Terra conectado → botón "Conectar Garmin" abre widget

**`src/api/client.ts`:**
- `apiFetch()` incluye session token en cookie httpOnly
- En 401, redirect a login

**Sin cambios en:**
- Todas las pages (Dashboard, Sports, Sleep, Wellness, AICoach, TrainingPlans, etc.)
- Todos los hooks — llaman `apiFetch()` que maneja auth transparentemente
- Todos los componentes UI

---

### Fase 5: Cleanup

**Eliminar archivos:**
- `server/src/garmin.ts`
- `server/src/get-tokens.ts`
- `server/src/sync.ts`

**Eliminar dependencias:**
- `@gooin/garmin-connect`, `oauth-1.0a`, `playwright` (~100MB menos), `node-cron`

**Agregar env vars en `render.yaml`:**
- `TERRA_DEV_ID`, `TERRA_API_KEY`, `TERRA_WEBHOOK_SECRET`

**Actualizar `CLAUDE.md` con la nueva arquitectura**

---

### Fase 6: Backfill y testing

- Botón "Sync histórico" que llama a Terra REST API para últimos 30 días
- Testear con 2-3 amigos: register → login → conectar Garmin → data aparece
- Edge cases: retries de webhooks, datos duplicados, desconexión

---

## Verificación end-to-end

1. `npm install` en server y root — sin errores
2. Registrar usuario con invite code → login → dashboard vacío
3. Conectar Garmin via widget Terra → webhook llega → datos aparecen
4. Segundo usuario repite el flujo → ve solo sus datos
5. AI Coach funciona con datos del usuario correcto
6. Insights se calculan por usuario
7. Training plans son por usuario
8. Demo mode sigue funcionando sin auth

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Terra no expone sleep score de Garmin | Calcular score aprox de duración de fases, o usar métrica propia de Terra |
| Sport types de Terra no matchean SPORT_CATEGORY_MAP | Construir mapping iterativamente con datos reales, loguear no mapeados |
| Webhooks fallan por cold starts de Render | Terra retries automáticos. Responder 200 inmediatamente |
| SQLite contención multi-user | WAL mode ya activo. 5-10 users con writes por webhook es trivial |
| Terra cambia pricing | Free tier cubre MVP. Si escala, evaluar Garmin Health API directo |

---

## Acción paralela recomendada

Aplicar al **Garmin Health API** oficial (developer.garmin.com) mientras se usa Terra. Si Garmin aprueba el partnership, se puede cortar el intermediario y reducir costos/latencia a largo plazo.
