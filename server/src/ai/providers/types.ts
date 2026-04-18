// ai/providers/types.ts — Provider-neutral interface for all AI operations

import type { Response } from 'express';
import type { ProviderName } from '../config.js';

export type { ProviderName };

export type AIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; base64: string };

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | AIContentBlock[];
}

export interface StreamOptions {
  systemPrompt: string;
  messages: AIMessage[];
  res: Response;
  maxTokens?: number;
  beforeDone?: (fullContent: string) => void | Promise<void>;
}

export interface AgentOptions {
  systemPrompt: string;
  messages: AIMessage[];
  res: Response;
  maxTokens?: number;
  maxIterations?: number;
  userId?: string;
}

export interface Provider {
  name: ProviderName;
  /** Returns true if this provider is ready to use (key set / Ollama reachable) */
  isConfigured(): boolean | Promise<boolean>;
  /** Non-streaming single call — returns full text response */
  chat(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string>;
  /** Non-streaming JSON-mode call — forces JSON output (uses format:'json' for Ollama, same as chat for Claude) */
  chatJSON(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string>;
  /** Multi-turn streaming SSE — emits {"token":"..."}, [DONE] */
  streamChat(opts: StreamOptions): Promise<string>;
  /** Single-message streaming SSE — thin wrapper on streamChat */
  streamGenerate(
    systemPrompt: string,
    userMessage: string,
    res: Response,
    opts?: { maxTokens?: number; beforeDone?: (full: string) => void | Promise<void> }
  ): Promise<string>;
  /** Vision streaming SSE — emits {"image_path":"..."}, {"token":"..."}, [DONE] */
  visionStream(
    systemPrompt: string,
    userMessage: string,
    imageBase64: string,
    mediaType: string,
    imagePath: string,
    res: Response
  ): Promise<void>;
  /** Agentic loop with tool use — emits tool_call / tool_result events */
  streamAgent(opts: AgentOptions): Promise<void>;
}
