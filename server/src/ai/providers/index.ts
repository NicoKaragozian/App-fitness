// ai/providers/index.ts — Provider selector
// Central point for picking Claude vs Gemma based on request or env default.

import type { Request } from 'express';
import { AI_CONFIG } from '../config.js';
import { gemmaProvider } from './gemma.js';
import { claudeProvider } from './claude.js';
import type { Provider, ProviderName } from './types.js';
import type { PromptLang } from '../prompts.js';

export { gemmaProvider, claudeProvider };
export type { Provider, ProviderName };

/** Get a provider by name (defaults to AI_CONFIG.defaultProvider) */
export function getProvider(name?: ProviderName | string): Provider {
  const resolved = (name || AI_CONFIG.defaultProvider) as ProviderName;
  if (resolved === 'claude') return claudeProvider;
  return gemmaProvider;
}

/**
 * Pick a provider from an Express request.
 * Priority: body.provider > query.provider > x-ai-provider header > env default
 */
export function pickProviderFromReq(req: Request): Provider {
  const fromBody = (req.body as any)?.provider;
  const fromQuery = req.query?.provider as string | undefined;
  const fromHeader = req.headers['x-ai-provider'] as string | undefined;
  return getProvider(fromBody || fromQuery || fromHeader);
}

/**
 * Pick the response language from an Express request.
 * Priority: body.language > query.language > x-language header > 'en'
 */
export function pickLanguageFromReq(req: Request): PromptLang {
  const fromBody = (req.body as any)?.language;
  const fromQuery = req.query?.language as string | undefined;
  const fromHeader = req.headers['x-language'] as string | undefined;
  const raw = fromBody || fromQuery || fromHeader || 'en';
  return (raw === 'es' ? 'es' : 'en') as PromptLang;
}

/**
 * Check if ANY configured provider is available.
 * Pass a provider name to check a specific one.
 */
export async function isAIConfigured(name?: ProviderName | string): Promise<boolean> {
  const provider = getProvider(name);
  const result = provider.isConfigured();
  return result instanceof Promise ? result : Boolean(result);
}
