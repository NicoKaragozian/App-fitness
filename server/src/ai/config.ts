// ai/config.ts — Centralized AI provider configuration
// All model/URL constants live here to avoid duplication across routes.

export type ProviderName = 'gemma' | 'claude';

export const AI_CONFIG = {
  defaultProvider: (process.env.AI_PROVIDER as ProviderName) || 'gemma',
  claude: {
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  },
  gemma: {
    model: process.env.GEMMA_MODEL || 'gemma4:e2b',
    visionModel: process.env.GEMMA_VISION_MODEL || process.env.GEMMA_MODEL || 'gemma4:e2b',
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
  },
} as const;

export function modelNameFor(provider: ProviderName): string {
  return provider === 'claude' ? AI_CONFIG.claude.model : AI_CONFIG.gemma.model;
}
