# FitTrack — Fitness App con Garmin + AI

## Qué es este proyecto
Web app de fitness que muestra datos de entrenamiento multi-deporte con análisis de IA (Claude). Soporta running, gimnasio, deportes de agua (surf/wingfoil/windsurf) y tenis. Tiene integración real con Garmin Connect (Fase 3 ✅). Dashboard interactivo con drill-down por categoría (Fase 5 ✅).

## Cómo correr el proyecto

```bash
cd "C:\Users\nicok\OneDrive\Documents\Pruebas claude\fitness-app"
npm run dev
# → http://localhost:3000 (puede ser 3002/3004 si el puerto está ocupado)
```

> Si es una terminal nueva: usar `PATH="/c/Program Files/nodejs:$PATH" npm run dev`
> Si el dashboard muestra categorías incorrectas: `rm -rf .next && npm run dev` (limpia caché)

## Tech Stack
- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** para estilos (dark theme, colores en `app/globals.css`)
- **Recharts** para gráficos (HR, pace, zonas, tendencias, sleep trend, donut)
- **Anthropic SDK** (`@anthropic-ai/sdk`) para AI Insights con `claude-sonnet-4-6`

## Estructura de archivos clave

```
fitness-app/
├── app/
│   ├── page.tsx                    # Dashboard analytics (Server Component)
│   ├── activities/page.tsx         # Lista de actividades (multi-deporte)
│   ├── activities/[id]/page.tsx    # Detalle de actividad (con gráficos)
│   ├── category/[slug]/page.tsx    # Detalle por categoría deportiva (gym/water_sports/tennis/…)
│   ├── insights/page.tsx           # AI Insights (Claude) — cliente
│   └── api/insights/route.ts       # Endpoint que llama a Claude API
├── components/
│   ├── dashboard/
│   │   ├── AnalyticsHeader.tsx     # Totales del período (30d): sesiones, tiempo, calorías
│   │   ├── SportCategoryPanel.tsx  # Panel por deporte con sparkline de sesiones
│   │   ├── SleepTrendCard.tsx      # Card wrapper sueño 14 días
│   │   ├── ActivitySplitCard.tsx   # Donut: % tiempo por deporte (Client)
│   │   ├── ActivityFeed.tsx        # Feed sport-aware: ícono y métricas por categoría
│   │   ├── StatsCard.tsx           # Card genérica de estadística
│   │   └── AIWidget.tsx            # Widget de Claude AI
│   ├── charts/
│   │   ├── SleepTrendChart.tsx     # BarChart 14 días, coloreado por sleep score (Client)
│   │   ├── WeeklySessionSparkline.tsx  # Mini sparkline 4 semanas (Client)
│   │   ├── HeartRateChart.tsx      # Gráfico HR por actividad
│   │   ├── PaceChart.tsx           # Gráfico pace por km
│   │   ├── ZonesChart.tsx          # Gráfico zonas HR
│   │   └── TrendChart.tsx          # Gráfico tendencias semanales
│   └── ui/Card.tsx                 # Componente Card reutilizable
├── lib/
│   ├── data.ts                     # Capa de datos unificada (mock ↔ Garmin)
│   ├── mock-data.ts                # 32 actividades (20 running + 12 multi-deporte)
│   ├── claude.ts                   # Cliente Anthropic — genera insights
│   ├── utils.ts                    # cn() helper (clsx + tailwind-merge)
│   └── garmin/client.ts            # Cliente HTTP al micro-servicio Python
├── garmin_service/                 # Micro-servicio Python (Flask)
│   ├── app.py                      # Endpoints: /activities, /health, /health/range, /weekly
│   └── data_mapper.py              # Mapeo de tipos Garmin → ActivityType de la app
└── types/fitness.ts                # Tipos: Activity, SportCategory, WeeklyStats, etc.
```

## Configuración de Claude API
Para activar los insights en vivo, agregar en `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Sin la key, la página `/insights` muestra insights pre-generados (fallback estático).

## Configuración de Garmin (opcional)
```
USE_GARMIN=true
GARMIN_SERVICE_URL=http://localhost:5000
```
Sin estas variables, la app usa mock data.

## Estado actual

### Fase 1 ✅ — App base
- Dashboard, lista/detalle de actividades, tendencias, AI Insights

### Fase 2 ✅ — Charts y UX
- HeartRateChart, PaceChart, ZonesChart, TrendChart

### Fase 3 ✅ — Garmin real
- Micro-servicio Python con Flask + garminconnect
- Toggle `USE_GARMIN=true` para usar datos reales

### Fase 4 ✅ — Analytics multi-deporte
- Dashboard rediseñado con paneles por categoría: Gym 🏋️, Water Sports 🌊, Tennis 🎾
- `AnalyticsHeader`: totales del período (30 días)
- `SportCategoryPanel`: sesiones, tiempo, calorías, HR avg + sparkline semanal
- `SleepTrendCard`: 14 barras coloreadas por score (verde/índigo/ámbar/rojo)
- `ActivitySplitCard`: donut con % de tiempo por deporte
- `ActivityFeed` sport-aware: sin distancia/pace para gym/tenis, íconos por categoría
- Bug fix Garmin: tennis/surf/wingfoil caían a "running" → ahora mapeados correctamente
- `ActivityType` expandido: surf, wingfoil, windsurf, kiteboard, tennis, padel, squash, cardio
- `distance` y `avgPace` son opcionales en `Activity`

### Fase 5 ✅ — Dashboard interactivo + fix gráficos
- Eliminada página Trends (no usada); eliminada del nav
- `SportCategoryPanel` clickeable → navega a `/category/[slug]`
- Nueva página `/category/[slug]`: lista de sesiones por categoría (últimos 60 días) con métricas específicas
  - Water sports: emoji por tipo, km si disponible, HR, cal
  - Tennis: km si disponible, HR, cal
  - Gym: nombre actividad (= grupo muscular), duración, HR, cal
  - Cada card es link a `/activities/[id]`
- `lib/data.ts`: nueva función `getActivitiesByCategory(category, days)`
- Fix sleep trend: `.reverse()` → `.sort()` para orden cronológico estable con datos Garmin
- Gráficos con labels en ejes: SleepTrendChart (Y: Score), HeartRateChart (X: Time, Y: BPM), PaceChart (Y izq: Pace, Y der: Elev)

## Mock Data
- 32 actividades: 20 runs + 3 gym strength + 1 HIIT + 2 surf + 2 wingfoil + 1 windsurf + 3 tennis
- 28 días de métricas: Body Battery, Sleep Score, RHR, Stress, VO2 max
- Actividades de gym/tenis/agua no tienen `distance` ni `avgPace`

## Actividades reales del usuario
- Gimnasio (strength training, HIIT)
- Deportes de agua: surf, wingfoil, windsurf
- Tenis (singles y dobles)
- Running
