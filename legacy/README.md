# Legacy — Código Garmin + Ollama

Esta carpeta contiene el código de la versión original de DRIFT que usa:
- **Garmin Connect** como fuente de datos (via OAuth + browser automation)
- **Ollama** como LLM local para el AI Coach y generación de planes

## Estructura

```
legacy/
  server-garmin/
    garmin.ts        → Wrapper sobre @gooin/garmin-connect
    sync.ts          → Sync de datos: syncInitial(), syncToday(), startPeriodicSync()
    get-tokens.ts    → Script de login via Playwright (browser real)
    routes/
      auth.ts        → Rutas /api/auth: token-login, status, logout (con purga de DB)
    index.ts         → server/src/index.ts original (con imports de Garmin)
  server-ollama/
    routes/
      ai.ts          → /api/ai/chat con streaming Ollama (NDJSON)
      training-ollama.ts → Partes de training.ts que usan Ollama (generate, describe)
```

## Cómo restaurar la versión Garmin+Ollama

1. Copiar `legacy/server-garmin/garmin.ts` → `server/src/garmin.ts`
2. Copiar `legacy/server-garmin/sync.ts` → `server/src/sync.ts`
3. Copiar `legacy/server-garmin/get-tokens.ts` → `server/src/get-tokens.ts`
4. Copiar `legacy/server-garmin/routes/auth.ts` → `server/src/routes/auth.ts`
5. Copiar `legacy/server-garmin/index.ts` → `server/src/index.ts`
6. Restaurar deps en `server/package.json`: `@gooin/garmin-connect`, `oauth-1.0a`, `playwright`
7. Para restaurar Ollama: copiar `legacy/server-ollama/routes/ai.ts` → `server/src/routes/ai.ts`
   y aplicar las partes de `training-ollama.ts` al route `/generate` y `/exercises/:id/describe`
8. `cd server && npm install`
9. Configurar env vars: `OLLAMA_MODEL=gemma3:4b`, `OLLAMA_URL=http://localhost:11434`

## Dependencias para restaurar

```json
"@gooin/garmin-connect": "^1.x",
"oauth-1.0a": "^2.x",
"playwright": "^1.x"
```

## Estado al momento del backup

- Datos reales del usuario: ~24 actividades (14 windsurf/kite, 9 tenis, 1 gym)
- Auth: single-user via tokens OAuth guardados en `server/oauth1_token.json` y `server/oauth2_token.json`
- AI: Ollama local con modelo `gemma3:4b` o `gemma3:12b`
- Login requiere correr `npx tsx server/src/get-tokens.ts` (abre Chrome)
- Garmin bloqueó SSO programático con Cloudflare WAF (desde marzo 2026)
