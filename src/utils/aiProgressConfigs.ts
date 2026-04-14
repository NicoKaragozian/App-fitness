import type { AIProgressConfig } from '../hooks/useAIProgress';

export const TRAINING_PLAN_PROGRESS: AIProgressConfig = {
  mode: 'streaming',
  expectedTokens: 2500,
  phases: [
    { at: 0,  label: 'Conectando con Claude...' },
    { at: 5,  label: 'Analizando tus datos...' },
    { at: 25, label: 'Diseñando las sesiones...' },
    { at: 50, label: 'Armando tu plan...' },
    { at: 75, label: 'Ajustando detalles...' },
    { at: 90, label: 'Guardando plan...' },
  ],
};

export const NUTRITION_PLAN_PROGRESS: AIProgressConfig = {
  mode: 'streaming',
  expectedTokens: 4000,
  phases: [
    { at: 0,  label: 'Conectando con Claude...' },
    { at: 5,  label: 'Calculando tus macros...' },
    { at: 20, label: 'Seleccionando alimentos...' },
    { at: 45, label: 'Armando opciones por comida...' },
    { at: 70, label: 'Equilibrando nutrientes...' },
    { at: 90, label: 'Guardando plan...' },
  ],
};

export const GOAL_PROGRESS: AIProgressConfig = {
  mode: 'timed',
  estimatedDurationMs: 12000,
  phases: [
    { at: 0,  label: 'Conectando con Claude...' },
    { at: 10, label: 'Analizando tu objetivo...' },
    { at: 30, label: 'Diseñando hitos semanales...' },
    { at: 55, label: 'Armando la progresión...' },
    { at: 80, label: 'Finalizando plan...' },
  ],
};

export const FOOD_ANALYSIS_PROGRESS: AIProgressConfig = {
  mode: 'streaming',
  expectedTokens: 300,
  phases: [
    { at: 0,  label: 'Enviando imagen...' },
    { at: 10, label: 'Analizando la foto...' },
    { at: 40, label: 'Estimando porciones...' },
    { at: 70, label: 'Calculando macros...' },
    { at: 90, label: 'Finalizando...' },
  ],
};
