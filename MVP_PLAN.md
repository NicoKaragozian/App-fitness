# DRIFT MVP — Plan de Migración a App Mobile con Apple Health

## Context

DRIFT es una app de fitness personal con dashboard de datos biométricos, AI coach, y generación de planes de entrenamiento. Actualmente depende de Garmin Connect como fuente de datos, con un flujo de auth complejo (Playwright + tokens OAuth) que hace imposible distribuir la app a otros usuarios.

**Problema**: No se puede shippear un MVP porque (1) Garmin requiere un script manual de login con browser automation, (2) el AI coach usa Ollama local (el usuario necesita instalarlo), y (3) no hay multi-user auth.

**Objetivo**: Shippear un MVP mobile (iOS) enfocado en las features core (training plans, AI coach, sport grouping) usando Apple Health como fuente de datos, publicado en el App Store.

**Hallazgo clave**: La arquitectura está bien aislada — Garmin solo se toca en 4 archivos del server (`garmin.ts`, `sync.ts`, `get-tokens.ts`, `routes/auth.ts`). Todo lo downstream (AI, training, insights, sport groups) lee de SQLite. Las tablas de training plans tienen CERO dependencia de datos de salud.

---

## Suscripciones y Costos

### Fase de desarrollo y testing en tu iPhone ($0)

| Servicio | Costo | Notas |
|----------|-------|-------|
| **Apple ID gratuito** | $0 | Con tu Apple ID normal podés compilar y correr en tu iPhone via Xcode. Sin pagar nada. |
| **Xcode** | $0 | Se baja del Mac App Store. Incluye iOS Simulator. |
| **Groq API** | $0 (free tier) | Llama 3.3 70B. 30 RPM, 14,400 requests/día. |
| **Render hosting** | $0 (free tier) | Cold starts de ~30s pero aceptable para desarrollo. |
| **HealthKit en tu iPhone** | $0 | Funciona con dev signing gratuito. Accedés a tus datos reales de Apple Health. |

**Limitaciones del dev signing gratuito:**
- La app expira cada **7 días** — tenés que re-compilar desde Xcode para renovar
- Máximo **3 apps** simultáneas en tu iPhone
- No podés distribuir a otros (ni TestFlight ni App Store)
- El bundle ID cambia si borrás y re-creás el provisioning → perdés datos de la app

**Este es el punto de validación**: si la app funciona bien en tu iPhone con tus datos reales de Apple Health, ahí decidís si vale la pena pagar los $99.

### Cuando decidas publicar ($99/año + $7/mes)

| Servicio | Costo | Obligatorio | Notas |
|----------|-------|-------------|-------|
| **Apple Developer Program** | $99 USD/año | Sí | TestFlight (beta hasta 10,000 testers) + App Store. La app ya no expira cada 7 días. |
| **Render hosting** | $7 USD/mes (Starter) | Sí | Elimina cold starts — necesario para UX aceptable con usuarios reales. |
| **Dominio** (opcional) | ~$12 USD/año | No | Si querés un dominio custom para la API (ej: `api.drift.app`). Render provee un `.onrender.com` gratis. |

**Total cuando publiques: ~$99/año + $7/mes = ~$183 USD/año**

### Escalamiento de costos (cuando crezca)

| Escenario | Cambio necesario |
|-----------|-----------------|
| >30 RPM en Groq | Pasar a Groq paid ($0.05/1M tokens) o Anthropic Haiku ($0.25/1M tokens) |
| >50 usuarios | Considerar PostgreSQL en lugar de SQLite (Render tiene managed Postgres desde $7/mes) |
| >1000 usuarios | Mover a un VPS con más recursos, o migrar API a un servicio serverless |

---

## Decisiones de Diseño

### Apple Health: Capacitor con HealthKit plugin
- **Web apps NO pueden acceder a Apple Health** — no hay API web/REST
- Capacitor wrappea el SPA existente con mínimos cambios y da acceso a HealthKit via plugin nativo
- La app ya es mobile-first (ActiveWorkout) y tiene PWA configurado
- La app Capacitor se conecta al backend en Render via HTTPS

### AI: Groq (gratis) para MVP, local después
- **Ollama no es distribuible** — requiere que el usuario lo instale y corra un server
- **WebLLM en browser** — calidad muy pobre para generar planes de entrenamiento (modelos de 2-4B params)
- **Para el MVP**: Groq con Llama 3.3 70B (gratis, 30 RPM, API compatible con OpenAI)
- **Cuando sea app nativa madura**: evaluar Core ML / on-device inference con un modelo fine-tuned
- Cambio mínimo: crear una abstracción `server/src/ai/llm.ts` que ambos endpoints usen

### Métricas que se pierden (y qué hacer)

| Métrica Garmin | Acción | Impacto |
|----------------|--------|---------|
| Stress scores | Eliminar | 2 de 8 reglas de insights afectadas — degradación graceful |
| Body battery | Ya no funciona (403) | Sin cambio — ya se usa readiness score compuesto |
| Training effect | Eliminar de session analysis | Info complementaria, no core |
| Sleep score | Computar desde sleep stages de Apple Health | Fórmula basada en duración + eficiencia + % deep/REM |
| HRV status ("BALANCED") | Computar localmente | Comparar vs media 7 días, clasificar como balanced/low/high |

---

## Fases de Implementación

### Fase 0: Desacoplar AI de Ollama (1-2 días)
**El cambio de mayor impacto — desbloquea shippear a cualquier usuario.**

Crear `server/src/ai/llm.ts`:
- Exportar `chatStream(messages, options)` para el AI coach (SSE streaming)
- Exportar `chatJSON(messages, options)` para generación de training plans (JSON mode)
- Implementar con Groq API (Llama 3.3 70B) — OpenAI-compatible
- Env vars: `GROQ_API_KEY`, `LLM_MODEL=llama-3.3-70b-versatile`

Modificar:
- `server/src/routes/ai.ts` — reemplazar fetch a Ollama por `chatStream()` de llm.ts
- `server/src/routes/training.ts` — reemplazar fetch a Ollama por `chatJSON()` de llm.ts
- `render.yaml` — agregar env vars

Sin cambios en: prompts, context builders, frontend.

### Fase 1: Auth Multi-usuario (2-3 días)

Nuevas tablas en `server/src/db.ts`:
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, created_at TEXT);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER, expires_at TEXT);
CREATE TABLE invite_codes (code TEXT PRIMARY KEY, used_by INTEGER, created_at TEXT);
```

Nuevo middleware `server/src/middleware/auth.ts`:
- `requireAuth` — lee session cookie, valida, setea `req.userId`

Nuevas rutas `server/src/routes/users.ts`:
- POST `/api/users/register` (username + password + invite code)
- POST `/api/users/login`
- POST `/api/users/logout`

Agregar `user_id` a tablas existentes:
- `activities`, `sleep`, `hrv`, `stress`, `daily_summary`, `training_plans` — ALTER TABLE con migration idempotente
- Agregar `WHERE user_id = ?` a todas las queries en: `routes/health.ts`, `routes/activities.ts`, `routes/insights.ts`, `routes/training.ts`, `routes/plan.ts`, `routes/ai.ts`
- `ai/context.ts` — builders reciben `userId`
- `insights/index.ts` — `computeInsights(userId)`

Frontend:
- Reescribir `src/context/AuthContext.tsx` — login con username/password
- Reescribir `src/pages/Login.tsx` — form de registro/login
- `src/api/client.ts` — manejar 401 → redirect a login

Deps nuevas: `bcryptjs`, `cookie-parser`

### Fase 2: Capacitor + Apple HealthKit (3-5 días)

Setup Capacitor:
- `npx @capacitor/cli init` + `npx cap add ios`
- `capacitor.config.ts` — server URL apunta a Render backend
- Plugin HealthKit: `@nicok/capacitor-healthkit` o similar

Nuevo `server/src/routes/healthkit.ts`:
- POST `/api/healthkit/sync` — recibe batch de datos HealthKit, inserta en SQLite

Nuevo `server/src/healthkit-mapper.ts`:
- HKWorkout → tabla `activities` (mapear `HKWorkoutActivityType` a sport_type normalizado)
- HKCategorySample (sleep) → tabla `sleep` (agregar stages, computar score)
- HKQuantitySample (HRV) → tabla `hrv` (SDNN como nightly_avg)
- HKQuantitySample (restingHR) → tabla `daily_summary`

Nuevo `src/native/healthkit.ts`:
- Wrapper TypeScript sobre el plugin Capacitor
- Pedir permisos, query por rango de fechas, POST al backend

Modificar `server/src/db.ts`:
- Hacer `garmin_id` nullable en activities (o renombrar a `source_id`)
- Agregar columna `source TEXT DEFAULT 'apple_health'`

Modificar `server/src/ai/context.ts`:
- `buildSessionContext` — hacer opcionales los campos Garmin-specific (HR zones, training effect)

Modificar `server/src/index.ts` y `routes/`:
- Agregar CORS para el origin de Capacitor (`capacitor://localhost`)

### Fase 3: Limpiar Garmin + Ship MVP (1-2 días)

Eliminar:
- `server/src/garmin.ts`
- `server/src/sync.ts`
- `server/src/get-tokens.ts`
- Deps: `@gooin/garmin-connect`, `oauth-1.0a`, `playwright` (~100MB menos)

Modificar:
- `server/src/routes/auth.ts` — solo status endpoint
- `server/src/index.ts` — remover imports de Garmin, tryRestoreSession, sync
- `server/src/routes/sync.ts` — remover o reemplazar por healthkit sync trigger
- UI text en Login.tsx, Header.tsx, AICoach.tsx — remover referencias a Garmin

### Fase 4: Testing en tu iPhone — GRATIS, sin Apple Developer Program (1-2 días)

**Objetivo**: validar que todo funciona con datos reales de Apple Health antes de pagar nada.

#### Setup (una sola vez)
1. **Instalar Xcode** desde el Mac App Store (gratis, ~12GB)
2. En Xcode → Settings → Accounts → agregar tu **Apple ID personal** (no necesitás Developer Program)
3. Conectar tu iPhone por USB, confiar en la Mac
4. Xcode crea automáticamente un **free provisioning profile** para tu Apple ID

#### Compilar y correr en tu iPhone
```bash
npm run build                # build del SPA
npx cap sync                 # copia dist/ al proyecto iOS
npx cap open ios             # abre proyecto en Xcode
```
En Xcode:
1. Seleccionar tu iPhone como target (arriba a la izquierda)
2. En Signing & Capabilities → seleccionar tu Apple ID como Team
3. Xcode va a pedir un **bundle identifier único** (ej: `com.tunombre.drift`)
4. Click en ▶️ Run — se instala en tu iPhone
5. En el iPhone: Settings → General → VPN & Device Management → confiar en tu certificado de developer

#### Qué testear
- [ ] La app abre sin crash
- [ ] Login/registro funciona contra el backend en Render (o localhost via `npx cap run ios --livereload`)
- [ ] Aparece el popup de permisos de Apple Health
- [ ] Después de autorizar, los datos se sincronizan (workouts, sueño, HRV)
- [ ] Dashboard muestra tus datos reales
- [ ] AI Coach responde con contexto de tus datos
- [ ] Generar un plan de entrenamiento funciona
- [ ] Workout tracking funciona (empezar workout, logear sets, finalizar)
- [ ] Sport groups muestran tus actividades agrupadas

#### Desarrollo iterativo (livereload)
Para no tener que re-compilar cada cambio:
```bash
npx cap run ios --livereload --external
```
Esto corre la app en tu iPhone pero carga el frontend desde tu Mac via red local. Cambios en el código se reflejan al instante.

#### Limitaciones del dev signing gratuito
- La app **expira cada 7 días** — hay que re-compilar desde Xcode
- Máximo 3 apps simultáneas
- No se puede distribuir a otros
- Si es solo para validar, esto es suficiente

### Fase 5: App Store Submission — cuando decidas pagar (1-2 semanas para review)

#### Prerequisitos
1. **Enrollarse en Apple Developer Program** ($99 USD/año) en [developer.apple.com/programs/](https://developer.apple.com/programs/)
2. Esperar aprobación (puede tardar hasta 48hs)
3. En Xcode → Settings → Accounts → tu cuenta ahora muestra el Team del Developer Program
4. Crear certificados de distribución y provisioning profiles (Xcode lo hace automáticamente con "Automatically manage signing")

#### Preparación
- Generar app icons para iOS (ya hay base en 192/512, necesitás todos los tamaños: 20, 29, 40, 60, 76, 83.5, 1024)
- Screenshots para App Store (6.7", 6.1", 5.5" — mínimo 3 screenshots)
- Escribir descripción, keywords, categoría (Health & Fitness)
- Privacy policy URL (requerido — puede ser una página simple en GitHub Pages)
- `Info.plist` — descripciones de uso de HealthKit (requerido por Apple):
  - `NSHealthShareUsageDescription` — "DRIFT usa tus datos de salud para personalizar planes de entrenamiento y recomendaciones"
  - `NSHealthUpdateUsageDescription` — si vas a escribir datos

#### Submission
1. En Xcode: Product → Archive → Distribute App → App Store Connect
2. Usar **TestFlight primero** para beta testing (hasta 10,000 testers) — review light de ~1-2 días
3. Cuando estés conforme con el beta → Submit for Review al App Store
4. **Primera review**: típicamente 1-7 días
5. **Requisito Apple**: la app debe tener funcionalidad nativa significativa (HealthKit califica)

#### Posibles motivos de rechazo y cómo evitarlos
| Motivo | Prevención |
|--------|------------|
| "Just a web view" | HealthKit integration = feature nativa genuina |
| Privacy policy ausente | Crear página de privacy policy antes de submit |
| Crash on launch | Testear en dispositivo físico, no solo simulator |
| HealthKit sin justificación | Descriptions claras en Info.plist |
| No funciona offline | Asegurar que workout tracking funcione offline (SQLite local como fallback) |

---

## Arquitectura Final del MVP

```
┌─────────────────────────────┐
│   iOS App (Capacitor)       │
│   ├── React SPA (WebView)   │
│   ├── HealthKit Plugin      │
│   └── Local Storage         │
└──────────┬──────────────────┘
           │ HTTPS
           ▼
┌─────────────────────────────┐
│   Render (Express + SQLite) │
│   ├── /api/users/*          │
│   ├── /api/healthkit/sync   │
│   ├── /api/training/*       │
│   ├── /api/ai/chat          │
│   ├── /api/activities       │
│   ├── /api/health/*         │
│   ├── /api/insights         │
│   └── /api/sport-groups     │
└──────────┬──────────────────┘
           │ HTTPS
           ▼
┌─────────────────────────────┐
│   Groq API                  │
│   └── Llama 3.3 70B        │
└─────────────────────────────┘
```

---

## Features del MVP

### Incluidas
- Generación de planes de entrenamiento con AI (Groq)
- AI Coach (chat con contexto biométrico)
- Workout tracking (sets, reps, peso, progressive overload)
- Sport groups customizables
- Dashboard con datos de Apple Health (actividades, sueño, HRV, FC reposo)
- Motor de insights/recomendaciones
- Readiness score compuesto (sleep + HRV + resting HR)
- Auth con invite codes (beta controlada)

### Excluidas del MVP (futuro)
- Stress scores (no disponible en Apple Health)
- Training effect / training load (Garmin-specific)
- Modelo AI local (Core ML — evaluar post-launch)
- Push notifications
- Offline-first completo (requiere sync bidireccional)
- Android (Capacitor lo soporta, pero priorizar iOS)

---

## Timeline Estimado

| Fase | Duración | Acumulado | Costo |
|------|----------|-----------|-------|
| Fase 0: AI → Groq | 1-2 días | 2 días | $0 |
| Fase 1: Auth multi-user | 2-3 días | 5 días | $0 |
| Fase 2: Capacitor + HealthKit | 3-5 días | 10 días | $0 |
| Fase 3: Cleanup Garmin | 1-2 días | 12 días | $0 |
| **Fase 4: Testing en tu iPhone** | **1-2 días** | **~2 semanas** | **$0** |
| ── Punto de decisión: ¿vale la pena publicar? ── | | | |
| Fase 5: App Store | 1-2 semanas review | ~4 semanas | $99/año + $7/mes |

**Hasta la Fase 4 (app funcionando en tu iPhone con datos reales): ~2 semanas, $0.**

---

## Checklist de Verificación

- [ ] Fase 0: `curl -X POST /api/ai/chat` retorna streaming SSE sin Ollama
- [ ] Fase 0: `curl -X POST /api/training/generate` retorna plan JSON válido via Groq
- [ ] Fase 1: Registrar usuario con invite code, login, queries filtran por user_id
- [ ] Fase 2: App abre en iOS simulator, autoriza HealthKit, datos aparecen en dashboard
- [ ] Fase 2: Sync de workouts, sleep, HRV desde Apple Health funciona
- [ ] Fase 3: No hay imports ni referencias a Garmin en el codebase
- [ ] Fase 3: `playwright` y `@gooin/garmin-connect` removidos de package.json
- [ ] **Fase 4: App corre en tu iPhone físico con dev signing**
- [ ] **Fase 4: Datos reales de Apple Health aparecen en el dashboard**
- [ ] **Fase 4: AI Coach usa tus datos reales para responder**
- [ ] **Fase 4: Workout tracking completo funciona en el gym**
- [ ] Fase 5: Build exitoso en Xcode, upload a App Store Connect
- [ ] Fase 5: TestFlight beta funciona para otros testers
- [ ] Fase 5: App aprobada en App Store
