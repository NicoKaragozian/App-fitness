# DRIFT — AI-First Redesign Plan

## Vision

The AI Coach becomes the **primary interface** — not a side feature. Instead of navigating through forms and menus, users talk to the app. The AI understands intent, asks follow-up questions when needed, and takes **real actions** (creates plans, logs meals, updates profile) — not just gives advice.

---

## Core Architecture Change: Agent Mode

The current `/api/ai/chat` is read-only. The key new capability is **Claude tool_use** — the AI can call backend functions mid-conversation.

The agentic loop:
```
User message →
  Claude streams text (thinking out loud) →
    Claude calls a tool (e.g. "generate_training_plan") →
      Backend executes it (DB write / Claude sub-call) →
        Frontend shows inline result card →
          Claude streams follow-up text →
User sees result embedded in conversation
```

---

## Phase 1 — Agentic Tool System (Backend Foundation)

> **Build this first. Everything else depends on it.**

### 1.1 Prerequisite Refactor

Extract `savePlanToDB`, `validatePlan`, `getPlanById` from `server/src/routes/training.ts` into a new `server/src/ai/plan-tools.ts` file so both the HTTP route and the agent tool executor can share them without circular imports.

### 1.2 New file: `server/src/ai/tools.ts`

Defines 5 tools Claude can call, plus synchronous executor functions (better-sqlite3 is synchronous so this is safe inline in the loop).

| Tool | Description | Trigger phrase examples |
|------|-------------|-------------------------|
| `update_profile` | UPSERT fields to `user_profile` | "Tengo 28 años, peso 75kg" |
| `generate_training_plan` | Calls `claudeChat` with JSON-only training prompt, saves plan via `savePlanToDB` | "Creame un plan de fuerza 3 días" |
| `log_meal` | Inserts row in `nutrition_logs` with date = today | "Almorcé pollo con arroz" |
| `get_daily_briefing` | Calls existing `buildDailyContext()` + `computeInsights()` | "¿Cómo estoy hoy?" |
| `navigate_to` | Returns page name for frontend to route to | "Llevame a nutrición" |

**Tool input schemas:**

```typescript
// update_profile
{
  name?: string
  age?: number
  sex?: 'male' | 'female'
  height_cm?: number
  weight_kg?: number
  experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'athlete'
  primary_goal?: 'fat_loss' | 'hypertrophy' | 'strength' | 'endurance' | 'maintain'
  sports?: string[]
  training_days_per_week?: number
  session_duration_min?: number
  equipment?: string[]
  injuries?: string
}

// generate_training_plan
{
  goal: string  // free-text, e.g. "3-day upper/lower strength split"
}

// log_meal
{
  meal_name: string
  description: string           // ingredient list
  meal_slot: string             // breakfast|lunch|dinner|snack|pre_workout|post_workout
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

// get_daily_briefing
{}  // no inputs — reads today's data from DB

// navigate_to
{
  page: 'dashboard' | 'training' | 'nutrition' | 'sports' | 'coach'
}
```

**Executor implementations:**

- **`update_profile`**: same UPSERT pattern as `PUT /api/profile` — INSERT OR REPLACE with COALESCE for null fields. Idempotent. Returns updated fields.
- **`generate_training_plan`**: calls `buildTrainingContext(goal)` from `context.ts`, then `claudeChat(PROMPTS.training_plan_json, ...)` (non-streaming), then `validatePlan` + `savePlanToDB`. Returns `{ planId, plan }`.
- **`log_meal`**: `db.prepare('INSERT INTO nutrition_logs ...').run(...)` with today's date. Returns `{ logId, meal_name, calories, protein_g, carbs_g, fat_g }`.
- **`get_daily_briefing`**: calls `buildDailyContext()` + `computeInsights()`. Returns structured briefing object (see Phase 5).
- **`navigate_to`**: no DB call. Returns `{ page }` — frontend handles routing.

### 1.3 New file: `server/src/ai/agent.ts` — `claudeStreamAgent()`

The agentic streaming loop, max 5 iterations:

```typescript
async function claudeStreamAgent(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  res: Response,
  options?: { maxTokens?: number; maxIterations?: number }
): Promise<void>
```

**Loop:**
1. Call `client.messages.stream({ model, max_tokens, system, messages, tools })`
2. Accumulate events:
   - `text_delta` → forward as `data: {"token":"..."}\n\n`
   - `input_json_delta` → buffer tool input JSON
   - `content_block_stop` on a `tool_use` block → finalize tool_use entry
   - `message_delta` with `stop_reason === 'tool_use'` → end of this Claude turn
3. On `stop_reason === 'tool_use'`:
   - Emit `data: {"type":"tool_start","tool_name":"...","tool_id":"..."}\n\n`
   - Execute tool synchronously via `executeTool(name, input)` → `ToolResult`
   - Emit `data: {"type":"tool_result","tool_name":"...","result":{...}}\n\n`
   - Build next `messages` array: append assistant turn (full content array with text + tool_use blocks) + user turn with `tool_result` content blocks
   - Continue loop
4. On `stop_reason === 'end_turn'` → emit `data: [DONE]\n\n`, break
5. Guard: if `iterations >= maxIterations` → emit `data: {"error":"Demasiadas acciones en cadena"}\n\n` + `[DONE]`

**SSE event schema from `/api/ai/agent`:**
```
{ token: "..." }                                              ← text token (same as /api/ai/chat)
{ type: "tool_start", tool_name: "...", tool_id: "..." }      ← tool executing
{ type: "tool_result", tool_name: "...", result: {...} }       ← tool done
{ error: "...", status?: number }                             ← error
[DONE]
```

### 1.4 New route: `POST /api/ai/agent`

Add to `server/src/routes/ai.ts` (mounted at `/api/ai`):

```typescript
router.post('/agent', async (req, res) => {
  const { messages, mode } = req.body
  // mode: 'chat' | 'onboarding' | 'briefing'
  // Always load full context (no keyword detection — tools handle specificity)
  // Select system prompt based on mode
  // Include all 5 tools
  // Call claudeStreamAgent(systemPrompt, messages, tools, res)
})
```

The existing `/api/ai/chat` stays **completely untouched**.

### 1.5 New prompts in `server/src/ai/prompts.ts`

**`PROMPTS.agent_chat`** — enhanced system prompt for the agent. Explains Claude is empowered to take actions. Defines when to use each tool vs. just respond in text. Does NOT inherit `BASE` (to avoid conversational bloat in a JSON-heavy context).

**`PROMPTS.training_plan_json`** — variant of `training_plan` that outputs **only the JSON object** (no analysis text prefix, no `---PLAN_JSON---` delimiter). The outer agent conversation provides the analysis via Claude's post-tool text.

**`PROMPTS.onboarding`** — see Phase 3.

---

## Phase 2 — Frontend: Rich Message Types and Tool Result Cards

### 2.1 Extended `Message` type in `AICoach.tsx`

```typescript
type ToolResultPayload =
  | { type: 'plan_created'; planId: number; plan: AIPlan }
  | { type: 'meal_logged'; meal: MealLogEntry }
  | { type: 'profile_updated'; fields: string[] }
  | { type: 'daily_briefing'; stats: DailyBriefingResult }
  | { type: 'navigate'; page: string }

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  toolResults?: ToolResultPayload[]    // inline action cards
  isToolThinking?: boolean             // shows spinner while tool runs
  _pendingToolName?: string            // name of in-progress tool
}
```

### 2.2 New directory: `src/components/chat/`

| Component | Content |
|-----------|---------|
| `PlanCard.tsx` | Plan title + objective, sessions as chips, exercise count, "Ir al plan →" button navigating to `/training/:id`. Collapsed by default, expandable. |
| `MealLoggedCard.tsx` | Green confirmation, meal name, macro pills (calories / protein / carbs / fat), "Ver nutrición de hoy →" link. |
| `ProfileUpdatedCard.tsx` | "Perfil actualizado" header, list of changed field names. Minimal. |
| `DailyBriefingCard.tsx` | Readiness score ring (reuse `ActivityRing`), sleep score, HRV status badge, stress level, today's planned session name, top insight recommendation. |
| `ToolThinkingIndicator.tsx` | Three-dot animated spinner with contextual label: "Generando plan..." / "Registrando comida..." / "Actualizando perfil..." / "Cargando datos..." |

### 2.3 Updated SSE consumer in `AICoach.tsx`

```typescript
const parsed = JSON.parse(data);
if (parsed.token) {
  // existing text streaming — unchanged
} else if (parsed.type === 'tool_start') {
  setMessages(prev => {
    const updated = [...prev];
    updated[updated.length - 1] = {
      ...updated[updated.length - 1],
      isToolThinking: true,
      _pendingToolName: parsed.tool_name,
    };
    return updated;
  });
} else if (parsed.type === 'tool_result') {
  setMessages(prev => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    updated[updated.length - 1] = {
      ...last,
      isToolThinking: false,
      _pendingToolName: undefined,
      toolResults: [...(last.toolResults || []), buildToolResultPayload(parsed)],
    };
    return updated;
  });
}
```

`buildToolResultPayload` maps `tool_name` + `result` to the `ToolResultPayload` discriminated union.

### 2.4 Updated message rendering

After `<MarkdownText text={msg.content} />`:
```tsx
{msg.isToolThinking && (
  <ToolThinkingIndicator toolName={msg._pendingToolName} />
)}
{msg.toolResults?.map((tr, i) => (
  <div key={i}>{renderToolResult(tr)}</div>
))}
```

`renderToolResult` switches over `tr.type` → appropriate card component.

### 2.5 `navigate_to` handler

In `renderToolResult`, when `tr.type === 'navigate'`:
```tsx
useEffect(() => {
  if (tr.page) navigate(PAGE_ROUTES[tr.page]);
}, [tr.page]);
```

Where `PAGE_ROUTES = { dashboard: '/dashboard', training: '/training', nutrition: '/nutrition', sports: '/sports', coach: '/' }`.

---

## Phase 3 — Conversational Onboarding

### 3.1 Profile completeness detection

New hook: `src/hooks/useProfileCompleteness.ts`

```typescript
const REQUIRED_FIELDS = ['name', 'age', 'sex', 'weight_kg', 'height_cm', 'primary_goal', 'training_days_per_week'] as const

function useProfileCompleteness() {
  const { profile } = useProfile()
  const missingFields = REQUIRED_FIELDS.filter(f => profile?.[f] == null)
  return {
    isComplete: missingFields.length === 0,
    missingFields,
    completionPct: Math.round(((REQUIRED_FIELDS.length - missingFields.length) / REQUIRED_FIELDS.length) * 100),
  }
}
```

### 3.2 Trigger logic in `AICoach.tsx`

```typescript
const ONBOARDING_DONE_KEY = 'drift_onboarding_complete'

// On mount, after profile fetch:
if (!isProfileComplete && !localStorage.getItem(ONBOARDING_DONE_KEY) && messages.length === 0) {
  setMessages([{ role: 'assistant', content: ONBOARDING_OPENING }]);
  setChatMode('onboarding');
}
```

`ONBOARDING_OPENING` is a static string injected without any API call:
> "¡Hola! Soy DRIFT AI, tu coach personal de fitness. Para darte recomendaciones precisas necesito conocerte un poco. ¿Cómo te llamás?"

### 3.3 `PROMPTS.onboarding` system prompt

Instructs Claude to:
1. Ask for **one piece at a time** — never dump all questions at once
2. Follow this sequence: name → age + sex (can be combined) → weight + height (combined) → primary goal → sports practiced → training days/week → equipment available
3. Accept natural language: "peso 75 kilos, mido 1.80" → extract both fields
4. Call `update_profile` tool after each answer (incremental partial save)
5. Detect escape phrases ("basta", "dale nomás", "ya está", "suficiente", "no quiero dar más datos") → save whatever was collected so far and immediately proceed to the user's original request with defaults for missing fields
6. After all 7 minimum fields collected → say "Perfecto, ya tengo lo esencial. ¿Querés que te genere un plan de entrenamiento ahora?"
7. When `update_profile` fires with all 7 fields present → transition to normal agent mode

### 3.4 Mark onboarding complete

When a `tool_result` for `update_profile` arrives and the frontend detects all 7 required fields are now non-null (by calling `GET /api/profile` after each update):
```typescript
localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
setChatMode('agent');
```

---

## Phase 4 — Chat-Driven Plan Generation

### 4.1 Conversation flow

```
User: "Creame un plan de gimnasio 3 días para fuerza"

Claude: (checks profile context — sees primary_goal and training_days already set)
  → No clarification needed, calls generate_training_plan immediately
  → tool_start: "Generando plan..."
  → tool executes: buildTrainingContext(goal) → claudeChat(PROMPTS.training_plan_json)
                   → validatePlan → savePlanToDB → returns { planId, plan }
  → tool_result: PlanCard renders inline
Claude: "Generé un plan de fuerza de 3 sesiones con split upper/lower/full body..."
```

If key info is missing:
```
User: "Creame un plan"
Claude: "¿Para cuántos días por semana podés entrenar y cuál es tu objetivo principal — fuerza, volumen, o definición?"
User: "3 días, fuerza"
Claude: → calls generate_training_plan { goal: "3-day strength, user confirmed 3 days/week" }
```

### 4.2 `PROMPTS.training_plan_json`

Same expert content as `PROMPTS.training_plan` but:
- Outputs **only the JSON object** (no analysis text, no delimiter)
- Schema identical to the existing training plan JSON schema
- Max tokens: 4096 (same)

### 4.3 `PlanCard` component

```tsx
interface PlanCardProps {
  planId: number
  plan: { title: string; objective: string; sessions: Array<{ name: string; exerciseCount: number }> }
}
```

Shows:
- Plan title (bold)
- Objective (small, muted)
- Session chips: "Sesión A · 6 ejercicios", "Sesión B · 5 ejercicios"
- "Ver plan completo →" button → `navigate('/training/:planId')`

---

## Phase 5 — Daily Briefing

### 5.1 Trigger: Suggestion button on empty state

Add "Briefing de hoy" as a **featured primary suggestion** on the empty chat state (larger than the other 4 chips). When tapped, it sends "Dame el briefing de hoy" as a user message — the agent then calls `get_daily_briefing` automatically.

No auto-trigger on mount (avoids message alternation issues and respects user intent).

### 5.2 `get_daily_briefing` tool result structure

```typescript
interface DailyBriefingResult {
  today: string                        // YYYY-MM-DD
  sleep: {
    score: number | null
    duration_h: number | null
    deep_min: number | null
  }
  hrv: {
    current: number | null
    baseline: number | null
    status: string | null
    trend: string                      // "↑", "↓", "→"
  }
  stress: {
    current: number | null
    trend: string
  }
  readiness: {
    score: number                      // 0-100 composite
    label: string                      // "Óptimo" | "Bueno" | "Moderado" | "Bajo"
  }
  todaysPlan: { session_name: string; plan_title: string } | null
  nutritionToday: { calories: number; protein_g: number } | null
  recommendations: Array<{ title: string; description: string; priority: string }>
}
```

Built by `buildDailyContext()` + `computeInsights()` in the tool executor — both already exist in `server/src/ai/context.ts` and `server/src/insights/index.ts`.

### 5.3 `DailyBriefingCard` component

- **Readiness ring** — reuse `ActivityRing` from `src/components/ui/ActivityRing.tsx`
- **Sleep row** — score + Xh Xm format
- **HRV row** — current value + trend arrow + status badge
- **Today's session** — session name from active training plan (if any)
- **Top insight** — first recommendation from `computeInsights()` result

---

## Phase 6 — Navigation & Default Experience

### 6.1 Route changes in `src/App.tsx`

```tsx
// Before
<Route path="/" element={<Dashboard />} />
<Route path="/coach" element={<AICoach />} />

// After
<Route path="/" element={<AICoach />} />
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/coach" element={<Navigate to="/" replace />} />
```

### 6.2 Sidebar reorder in `src/components/layout/Sidebar.tsx`

```typescript
const navItems = [
  { path: '/',           label: 'AI Coach',   icon: '◎', exact: true },
  { path: '/dashboard',  label: 'Dashboard',  icon: '◉' },
  { path: '/sports',     label: 'Sports',     icon: '⚡' },
  { path: '/training',   label: 'Training',   icon: '▣' },
  { path: '/nutrition',  label: 'Nutrition',  icon: '◈' },
]
```

### 6.3 Empty state redesign

When `messages.length === 0`:

```
┌─────────────────────────────────────────────────────┐
│  [◉ Briefing de hoy]  ← featured, primary button    │
│                                                      │
│  [¿Cómo estuvo mi sueño?]  [¿Cómo está mi HRV?]    │
│  [¿Cómo van mis macros?]   [Creame un plan]          │
│                                                      │
│  If profile incomplete:                              │
│  "Configurá tu perfil hablando conmigo →"            │
└─────────────────────────────────────────────────────┘
```

---

## Phase 7 — Mode Management and Chat Persistence

### 7.1 Chat mode state

```typescript
type ChatMode = 'agent' | 'onboarding' | 'briefing' | 'chat'

const [chatMode, setChatMode] = useState<ChatMode>('agent') // default
```

Endpoint selection in `sendMessage`:
```typescript
const endpoint = chatMode === 'chat' ? '/api/ai/chat' : '/api/ai/agent'
```

### 7.2 Persist `toolResults` in localStorage

The `persistMessages` function already strips `streaming`. Extend it to preserve `toolResults` so cards re-render on page refresh:

```typescript
function persistMessages(msgs: Message[]) {
  return msgs.map(({ streaming, isToolThinking, _pendingToolName, ...rest }) => rest)
  // toolResults IS included in rest — preserved
}
```

When loading from localStorage, `toolResults` deserializes and cards re-render from saved payloads.

---

## Implementation Checklist

### Week 1 — Backend Foundation
- [ ] Extract `savePlanToDB`, `validatePlan`, `getPlanById` → `server/src/ai/plan-tools.ts`
- [ ] Create `server/src/ai/tools.ts` (start with `log_meal` + `update_profile` — pure DB)
- [ ] Add `PROMPTS.agent_chat`, `PROMPTS.training_plan_json`, `PROMPTS.onboarding` to `server/src/ai/prompts.ts`
- [ ] Create `server/src/ai/agent.ts` with `claudeStreamAgent()` agentic loop
- [ ] Add `POST /api/ai/agent` to `server/src/routes/ai.ts`
- [ ] Add `generate_training_plan` tool (depends on plan-tools.ts)
- [ ] Add `get_daily_briefing` tool (calls existing context builders)
- [ ] Add `navigate_to` tool (no DB — pure passthrough)

### Week 2 — Frontend Cards
- [ ] Extend `Message` type + update SSE consumer in `AICoach.tsx`
- [ ] `src/components/chat/ToolThinkingIndicator.tsx`
- [ ] `src/components/chat/MealLoggedCard.tsx`
- [ ] `src/components/chat/ProfileUpdatedCard.tsx`
- [ ] `src/components/chat/PlanCard.tsx`
- [ ] `src/components/chat/DailyBriefingCard.tsx`
- [ ] `renderToolResult()` switch + inline card rendering in `AICoach.tsx`
- [ ] `navigate_to` frontend handler via `useNavigate`

### Week 3 — User Flows
- [ ] `src/hooks/useProfileCompleteness.ts`
- [ ] Onboarding trigger logic in `AICoach.tsx` (static opening message + mode switch)
- [ ] Onboarding complete detection (set localStorage key after all 7 fields)
- [ ] "Briefing de hoy" featured suggestion button
- [ ] Empty state redesign
- [ ] Route change: `/` → AICoach, `/dashboard` → Dashboard, `/coach` redirect
- [ ] Sidebar reorder

### Week 4 — Polish
- [ ] Serialize/deserialize `toolResults` in localStorage persistence
- [ ] Max iteration guard with user-facing error message
- [ ] Tool error handling (show error inline in chat, not crash)
- [ ] Mobile UX for tool cards (ensure cards fit narrow viewport)
- [ ] Test escape phrases in onboarding mode

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Separate `/api/ai/agent` endpoint | Keeps existing `/api/ai/chat` untouched. Agent bugs can't break the current chat. |
| Synchronous tool execution | better-sqlite3 is sync; `claudeChat` (non-streaming) used for inner plan generation. No nested SSE complexity. |
| `training_plan_json` prompt variant | Agent Claude provides analysis as post-tool text; tool only needs the JSON. Avoids delimiter parsing inside the loop. |
| Max 5 tool iterations | Prevents runaway loops. Real-world max is 2-3 per message. |
| Suggestion button for briefing (not auto-trigger) | Avoids message alternation issues; respects user intent. |
| localStorage for chat history | Single-user app. Server-side storage not worth the auth complexity yet. |
| `toolResults` serialized to localStorage | Cards persist across page refreshes — user sees plan card even after closing/reopening. |

---

## Critical Files

| File | Change |
|------|--------|
| `server/src/routes/training.ts` | Extract plan helpers (Week 1 prerequisite) |
| `server/src/ai/plan-tools.ts` | New — shared plan DB helpers |
| `server/src/ai/tools.ts` | New — tool definitions + executors |
| `server/src/ai/agent.ts` | New — `claudeStreamAgent()` agentic loop |
| `server/src/ai/prompts.ts` | Add `agent_chat`, `training_plan_json`, `onboarding` |
| `server/src/routes/ai.ts` | Add `POST /api/ai/agent` route |
| `src/pages/AICoach.tsx` | Extend Message type, SSE consumer, tool rendering |
| `src/hooks/useProfileCompleteness.ts` | New — completeness detection |
| `src/components/chat/` | New directory with 5 card components |
| `src/App.tsx` | Route changes (`/` → AICoach, `/dashboard` → Dashboard) |
| `src/components/layout/Sidebar.tsx` | Reorder navItems |
