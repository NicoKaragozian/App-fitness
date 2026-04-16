import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MarkdownText } from './ui/MarkdownText';
import { TTSButton } from './ui/TTSButton';
import { STTButton } from './ui/STTButton';
import type { MacroTotals, MacroTargets, NutritionLog } from '../hooks/useNutrition';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface NutritionChatProps {
  date: string;
  totals: MacroTotals;
  targets: MacroTargets;
  logs: NutritionLog[];
}

const SUGGESTIONS = [
  'What can I eat to hit my macros?',
  'Suggest a high-protein snack',
  'How is my macro distribution today?',
  'What should I have for dinner to complete my goals?',
];

export const NutritionChat: React.FC<NutritionChatProps> = ({ date, totals, targets, logs }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Limpiar mensajes cuando cambia la fecha
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [date]);

  // Scroll al fondo cuando llegan nuevos mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const remCals = Math.max(0, targets.daily_calorie_target - totals.calories);
  const remProt = Math.max(0, targets.daily_protein_g - totals.protein_g);
  const remCarbs = Math.max(0, targets.daily_carbs_g - totals.carbs_g);
  const remFat = Math.max(0, targets.daily_fat_g - totals.fat_g);

  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim();
    if (!userText || isStreaming) return;

    setError(null);
    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages([...newMessages, { role: 'assistant', content: '', streaming: true }]);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const language = (() => { try { return localStorage.getItem('drift_language') || 'en'; } catch { return 'en'; } })();
      const res = await fetch('/api/nutrition/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Language': language },
        body: JSON.stringify({ messages: newMessages, date, language }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const { token } = JSON.parse(data);
            assistantContent += token;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent, streaming: true };
              return updated;
            });
          } catch { /* skip */ }
        }
      }

      setMessages([
        ...newMessages,
        { role: 'assistant', content: assistantContent, streaming: false },
      ]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
          return updated;
        });
      } else {
        setError(err.message || 'Error connecting to coach');
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming, date]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resizeTextarea = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Resumen de macros restantes */}
      <div className="bg-surface-low rounded-2xl p-4">
        <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-3">
          Remaining macros today
        </p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'KCAL', value: remCals, color: 'text-primary' },
            { label: 'PROT', value: remProt, color: 'text-secondary', unit: 'g' },
            { label: 'CARBS', value: remCarbs, color: 'text-tertiary', unit: 'g' },
            { label: 'FAT', value: remFat, color: 'text-[#22d3a5]', unit: 'g' },
          ].map(({ label, value, color, unit }) => (
            <div key={label}>
              <p className={`font-display text-sm font-bold ${color}`}>
                {value}{unit || ''}
              </p>
              <p className="font-label text-[0.6rem] text-on-surface-variant tracking-wider">{label}</p>
            </div>
          ))}
        </div>
        {logs.length === 0 && (
          <p className="font-body text-xs text-on-surface-variant mt-2 text-center">
            Log meals for a more accurate analysis
          </p>
        )}
      </div>

      {/* Area de chat */}
      <div className="bg-surface-low rounded-2xl overflow-hidden flex flex-col min-h-[45vh]">
        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center">
                <p className="font-display text-on-surface font-semibold mb-1">Nutrition Chat</p>
                <p className="font-body text-sm text-on-surface-variant">
                  Ask me about your nutrition today
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-3 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container/70 text-sm font-body text-on-surface-variant hover:text-on-surface transition-all border border-outline-variant/20"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <span className="text-primary text-[10px]">◈</span>
                </div>
              )}
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-body ${
                  msg.role === 'user'
                    ? 'bg-secondary/20 text-on-surface border border-secondary/30 rounded-tr-sm'
                    : 'bg-surface-container text-on-surface rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <>
                    <MarkdownText text={msg.content || ' '} />
                    {msg.streaming ? (
                      <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse rounded-sm" />
                    ) : (
                      <div className="flex justify-end mt-1.5">
                        <TTSButton text={msg.content} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 font-body">{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-outline-variant/20 shrink-0">
          <div className="flex gap-2 items-end bg-surface-container rounded-2xl px-4 py-3 border border-outline-variant/20 focus-within:border-primary/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                resizeTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about your macros..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent resize-none outline-none text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 leading-relaxed overflow-hidden"
              style={{ maxHeight: '128px' }}
            />
            <div className="flex items-center gap-1 shrink-0">
              <STTButton
                onTranscript={text => {
                  setInput(prev => prev ? prev + ' ' + text : text);
                  resizeTextarea();
                }}
                size="sm"
              />
              {isStreaming ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="w-8 h-8 rounded-xl bg-primary text-surface flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
