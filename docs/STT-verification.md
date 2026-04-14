# STT (Dictado por Voz) — Guía de Verificación

Feature: Botón de micrófono para dictar texto en AI Coach, Training Plans y Nutrition.
Implementación: Web Speech API (`SpeechRecognition`) — solo browser, sin backend.

---

## Setup

1. Correr backend: `npx tsx server/src/index.ts` (en `:3001`)
2. Correr frontend: `npm run dev` (en `:5175`)
3. Abrir en Chrome o Edge (son los browsers con mejor soporte para `SpeechRecognition`)
4. Tener micrófono disponible

---

## Compatibilidad por Browser

| Browser | Soporte STT | Botón visible | Notas |
|---------|-------------|---------------|-------|
| Chrome (desktop) | Nativo | Sí | Mejor soporte |
| Edge (desktop) | Nativo | Sí | Idéntico a Chrome |
| Safari (macOS 14+) | Parcial | Sí | Puede requerir permiso explícito en ajustes |
| Safari (iOS 14.5+) | Parcial | Sí | Funciona en HTTPS |
| Firefox | No soportado | No | El botón NO debe aparecer — graceful degradation |
| Chrome (Android) | Nativo | Sí | Requiere HTTPS o localhost |

---

## Test: AI Coach

**Ruta:** `/coach`

### TC-1: Botón aparece correctamente
- [ ] Abrir la página del AI Coach
- [ ] Verificar que el input area del chat muestra: `[textarea] [mic button] [send button]`
- [ ] El botón mic tiene ícono de micrófono (outline, color gris)
- [ ] El hint text dice: "Enter para enviar · Shift+Enter para nueva línea · Micrófono para dictar"

### TC-2: Dictado básico
- [ ] Hacer click en el botón de micrófono
- [ ] El botón debe cambiar a color naranja (`tertiary`) con animación pulse
- [ ] Hablar algo en español (ej: "hola, como estoy durmiendo últimamente")
- [ ] El texto debe aparecer en el textarea en tiempo real (segmento a segmento)
- [ ] Hacer click en el botón nuevamente para detener
- [ ] El botón vuelve al estado idle (gris)

### TC-3: Append (no replace)
- [ ] Escribir "quiero saber sobre" en el textarea
- [ ] Activar el micrófono y decir "mi sueño de la semana"
- [ ] El textarea debe mostrar "quiero saber sobre mi sueño de la semana" (con espacio, sin borrar el texto previo)

### TC-4: STT oculto durante streaming
- [ ] Enviar un mensaje al AI Coach
- [ ] Mientras el asistente está respondiendo (isStreaming = true), verificar que el botón mic NO aparece
- [ ] Solo debe aparecer el botón rojo de stop
- [ ] Cuando el streaming termina, el botón mic vuelve a aparecer

### TC-5: Auto-resize del textarea
- [ ] Dictar un texto largo (3+ oraciones)
- [ ] El textarea debe expandirse automáticamente (hasta 128px de alto) al igual que cuando se escribe manualmente

### TC-6: Permiso denegado
- [ ] Activar el micrófono
- [ ] Cuando el browser pide permiso, hacer click en "Bloquear"
- [ ] El botón debe mostrar un estado rojo brevemente con el mensaje "Permiso de micrófono denegado"
- [ ] Después de 3 segundos, el botón vuelve al estado idle

---

## Test: Training Plans

**Ruta:** `/training`

### TC-7: Botón en goal textarea
- [ ] Navegar a Training Plans
- [ ] El textarea del objetivo debe tener un botón mic en la esquina inferior derecha (dentro del textarea)
- [ ] El texto del textarea no debe quedar tapado por el botón (verifica que tiene padding derecho)

### TC-8: Dictado del goal
- [ ] Hacer click en el mic
- [ ] Dictar "plan de fuerza tres días por semana para complementar surf y tenis"
- [ ] El texto debe aparecer en el textarea

### TC-9: Append sobre preset
- [ ] Hacer click en un preset chip (ej: "Plan de fuerza funcional...") para pre-llenar el textarea
- [ ] Activar micrófono y dictar " con énfasis en core"
- [ ] El texto del preset debe mantenerse y el dictado se agrega al final

---

## Test: Nutrition — Generación de Plan

**Ruta:** `/nutrition` → sección "Nuevo Plan"

### TC-10: Botones en inputs de alimentos
- [ ] Ir a Nutrición y hacer click en "Nuevo Plan"
- [ ] Seleccionar una estrategia y hacer click en "Siguiente"
- [ ] En el paso de preferencias, verificar que los campos "Alimentos a evitar" y "Alimentos preferidos" tienen botón mic al lado derecho del input

### TC-11: Dictado con separador coma
- [ ] Activar mic en "Alimentos a evitar"
- [ ] Dictar "hígado brócoli"
- [ ] El campo debe mostrar "hígado brócoli"
- [ ] Activar mic de nuevo y dictar "atún enlatado"
- [ ] El campo debe mostrar "hígado brócoli, atún enlatado" (separados por ", ")

### TC-12: Dictado en "Alimentos preferidos"
- [ ] Activar mic en "Alimentos preferidos"
- [ ] Dictar "pollo arroz integral banana"
- [ ] El campo debe mostrar "pollo arroz integral banana"

---

## Test: MealLogger (registro de comidas)

**Ruta:** `/nutrition` → click en "+" o en una comida para editar

### TC-13: Botón en campo Nombre
- [ ] Abrir el modal de registro de comida (modo manual)
- [ ] Verificar que el campo "Nombre" tiene un botón mic al lado derecho
- [ ] Activar mic y dictar "pollo a la plancha con ensalada mixta"
- [ ] El nombre debe aparecer en el campo

### TC-14: Botón en campo Descripción
- [ ] Verificar que el campo "Descripción" tiene un botón mic en la esquina inferior derecha
- [ ] Activar mic y dictar "con tomate, lechuga y aceite de oliva"
- [ ] La descripción debe aparecer en el textarea

### TC-15: STT después de análisis de foto
- [ ] En el modal, seleccionar modo foto y subir una imagen de comida
- [ ] Esperar el análisis de Claude
- [ ] Cuando aparecen los campos editables (post-análisis), verificar que los botones mic están presentes
- [ ] Usar el mic para corregir o agregar al nombre/descripción que Claude generó

---

## Test: Graceful Degradation

### TC-16: Firefox
- [ ] Abrir la app en Firefox
- [ ] Navegar a AI Coach → verificar que el botón mic NO aparece en el input area
- [ ] Navegar a Training Plans → verificar que el textarea del goal no tiene botón mic
- [ ] Verificar que la UI se ve normal (sin espacios vacíos extraños)

---

## Test: Sesión prolongada (Chrome ~60s auto-stop)

### TC-17: Auto-restart en Chrome
- [ ] Activar el mic en AI Coach
- [ ] Hablar durante ~70 segundos continuamente (o dictar varios mensajes sin detener)
- [ ] Chrome corta la sesión internamente a los ~60s
- [ ] El hook debe reiniciar automáticamente: el botón sigue en estado "recording" (naranja)
- [ ] El dictado continúa sin interrupciones visibles para el usuario

---

## Checklist final

- [ ] Build sin errores TypeScript: `npm run build`
- [ ] Los 3 nuevos archivos existen:
  - `src/types/speech-recognition.d.ts`
  - `src/hooks/useSTT.ts`
  - `src/components/ui/STTButton.tsx`
- [ ] Los 4 archivos modificados están correctos:
  - `src/pages/AICoach.tsx`
  - `src/pages/TrainingPlans.tsx`
  - `src/pages/Nutrition.tsx`
  - `src/components/MealLogger.tsx`
- [ ] En Firefox: cero botones mic visibles (graceful degradation)
- [ ] En Chrome: todos los botones mic visibles y funcionales
- [ ] Los botones mic son naranja cuando graban, gris cuando están idle
- [ ] El texto se agrega (append), nunca reemplaza
- [ ] Separador `, ` en listas de alimentos (excluded_foods, preferred_foods)
- [ ] Separador ` ` en texto libre (AI Coach, goal, meal name, description)
