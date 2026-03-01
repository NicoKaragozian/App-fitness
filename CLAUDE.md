# FitTrack — Fitness App con Garmin + AI

## Qué es este proyecto
Web app de fitness que muestra datos de entrenamiento con análisis de IA (Claude). Actualmente funciona con **datos simulados (mock)**. La integración real con Garmin Connect es Fase 3.

## Cómo correr el proyecto

```bash
cd "C:\Users\nicok\OneDrive\Documents\Pruebas claude\fitness-app"
npm run dev
# → http://localhost:3000
```

> Si es una terminal nueva después de instalar Node.js, npm ya debería estar en el PATH.
> Si no: usar la ruta completa `"C:\Program Files\nodejs\npm.cmd" run dev`

## Tech Stack
- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** para estilos (dark theme, colores en `app/globals.css`)
- **Recharts** para gráficos (HR, pace, zonas, tendencias)
- **Anthropic SDK** (`@anthropic-ai/sdk`) para AI Insights con `claude-sonnet-4-6`

## Estructura de archivos clave

```
fitness-app/
├── app/
│   ├── page.tsx                    # Dashboard principal
│   ├── activities/page.tsx         # Lista de actividades
│   ├── activities/[id]/page.tsx    # Detalle de actividad (con gráficos)
│   ├── trends/page.tsx             # Gráficos históricos (4 semanas)
│   ├── insights/page.tsx           # AI Insights (Claude) — cliente
│   └── api/insights/route.ts       # Endpoint que llama a Claude API
├── components/
│   ├── dashboard/                  # StatsCard, ActivityFeed, AIWidget
│   ├── charts/                     # HeartRateChart, PaceChart, ZonesChart, TrendChart
│   └── ui/Card.tsx                 # Componente Card reutilizable
├── lib/
│   ├── mock-data.ts                # 20 actividades + 28 días de métricas de salud
│   ├── claude.ts                   # Cliente Anthropic — genera insights desde los datos
│   ├── utils.ts                    # cn() helper (clsx + tailwind-merge)
│   └── garmin/client.ts            # Stub para Fase 3 (Garmin real)
└── types/fitness.ts                # Tipos: Activity, HealthMetrics, WeeklyStats, etc.
```

## Configuración de Claude API
Para activar los insights en vivo, agregar en `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Sin la key, la página `/insights` muestra insights pre-generados (fallback estático).

## Estado actual (Fase 1 ✅ + Fase 2 ✅)
- Dashboard con stats semanales, Body Battery, Sleep Score, VO2 Max
- Lista y detalle de actividades con gráficos de HR, zonas y pace
- Página de Tendencias con 4 charts históricos
- Página de AI Insights: insights estáticos + botón para llamar a Claude en vivo
- API route `/api/insights` implementada y funcional

## Próximos pasos (Fase 3 — Garmin real)
1. Crear micro-servicio Python con la librería `garminconnect`
2. Endpoints: `/activities?days=30` y `/health?date=YYYY-MM-DD`
3. Reemplazar imports de `mock-data` por llamadas al servicio Python
4. Agregar variables de entorno: `GARMIN_EMAIL`, `GARMIN_PASSWORD`, `GARMIN_SERVICE_URL`
5. Ver stub en `lib/garmin/client.ts`

## Mock Data
- 20 runs (4 semanas: Feb 1 – Mar 1, 2026)
- 28 días de métricas: Body Battery, Sleep Score, RHR, Stress, VO2 max
- Datos generados con funciones helper en `lib/mock-data.ts` (HR samples, pace samples, zonas)
