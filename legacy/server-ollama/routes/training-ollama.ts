// Fragmentos de routes/training.ts que usan Ollama directamente (antes de migrar a Groq)
// Para restaurar: reemplazar las secciones correspondientes en server/src/routes/training.ts

// ============================================================
// VARIABLES al inicio del archivo (reemplazar las de Groq):
// ============================================================
//
// const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';
// const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// ============================================================
// POST /api/training/generate — sección de llamada al LLM
// (reemplazar el bloque que llama a chatJSON)
// ============================================================
//
//   let ollamaRes: globalThis.Response;
//   try {
//     ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         model,
//         messages: [
//           { role: 'system', content: systemPrompt },
//           { role: 'user', content: `Generá mi plan de entrenamiento personalizado. Objetivo: ${goal.trim()}` },
//         ],
//         stream: false,
//         format: 'json',
//       }),
//     });
//   } catch (err: any) {
//     console.error('[training] No se pudo conectar a Ollama:', err.message);
//     res.status(503).json({ error: 'Ollama no está corriendo. Inicialo con: ollama serve' });
//     return;
//   }
//
//   if (!ollamaRes.ok) {
//     const errText = await ollamaRes.text();
//     console.error('[training] Ollama error:', errText);
//     if (ollamaRes.status === 404 || errText.includes('not found')) {
//       res.status(502).json({ error: `Modelo "${model}" no encontrado. Descargalo con: ollama pull ${model}` });
//     } else {
//       res.status(502).json({ error: `Error de Ollama: ${errText.slice(0, 200)}` });
//     }
//     return;
//   }
//
//   let rawContent: string;
//   let plan: AIPlan;
//   try {
//     const ollamaData = await ollamaRes.json() as any;
//     rawContent = ollamaData.message?.content ?? '';
//     const parsed = JSON.parse(rawContent);
//     plan = validatePlan(parsed);
//   } catch (err: any) {
//     console.error('[training] Error parseando respuesta de Ollama:', err.message);
//     res.status(502).json({ error: `El modelo no devolvió un JSON válido: ${err.message}` });
//     return;
//   }

// ============================================================
// POST /api/training/exercises/:id/describe — sección LLM
// (reemplazar el bloque que llama a chatCompletion)
// ============================================================
//
//   let ollamaRes: globalThis.Response;
//   try {
//     ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         model,
//         messages: [{ role: 'user', content: prompt }],
//         stream: false,
//       }),
//     });
//   } catch (err: any) {
//     res.status(503).json({ error: 'Ollama no está corriendo. Inicialo con: ollama serve' });
//     return;
//   }
//
//   if (!ollamaRes.ok) {
//     const errText = await ollamaRes.text();
//     if (ollamaRes.status === 404 || errText.includes('not found')) {
//       res.status(502).json({ error: `Modelo "${model}" no encontrado. Descargalo con: ollama pull ${model}` });
//     } else {
//       res.status(502).json({ error: `Error de Ollama: ${errText.slice(0, 200)}` });
//     }
//     return;
//   }
//
//   const data = await ollamaRes.json() as any;
//   const description = (data.message?.content ?? '').trim();
