import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

// Renderizador inline de Markdown básico (sin deps externas)
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = regex.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index));
      if (m[2]) parts.push(<strong key={idx++} className="text-on-surface font-semibold">{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={idx++}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={idx++} className="bg-surface-container px-1 rounded text-xs font-mono text-primary">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      elements.push(<p key={i} className="font-label text-label-sm text-primary tracking-widest uppercase mt-3 mb-1">{line.slice(3)}</p>);
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} className="font-label text-label-sm text-primary tracking-widest uppercase mt-3 mb-1">{line.slice(2)}</p>);
    } else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-primary mt-0.5 shrink-0">·</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="my-0.5 leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }
  return <>{elements}</>;
}

const MODELS = [
  { id: 'gemma3:4b', label: 'Gemma 4B', badge: 'Rápido' },
  { id: 'gemma3:12b', label: 'Gemma 12B', badge: 'Potente' },
];

const SUGGESTIONS = [
  '¿Cómo estuvo mi sueño esta semana?',
  '¿Cuándo fue mi última sesión de tenis?',
  '¿Cómo está mi recuperación según el HRV?',
  '¿El estrés afectó mi rendimiento deportivo?',
];

export const AICoach: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('drift_ai_model') || MODELS[0].id;
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleModelChange = (modelId: string) => {
    if (isStreaming) return;
    setSelectedModel(modelId);
    localStorage.setItem('drift_ai_model', modelId);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim();
    if (!userText || isStreaming) return;

    setError(null);
    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages([...newMessages, { role: 'assistant', content: '', streaming: true }]);
    setInput('');
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, model: selectedModel }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
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

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: assistantContent, streaming: false };
        return updated;
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
          return updated;
        });
      } else {
        setError(err.message || 'Error al conectar con el coach');
        setMessages(prev => prev.slice(0, -1)); // quitar el mensaje vacío del assistant
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming, selectedModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-outline-variant/20 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-0.5">Asistente</p>
            <h1 className="font-display text-xl font-bold text-on-surface tracking-tight">DRIFT AI <span className="text-primary">COACH</span></h1>
          </div>
          <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1 border border-outline-variant/20 shrink-0 mt-1">
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => handleModelChange(m.id)}
                disabled={isStreaming}
                title={m.id}
                className={`flex flex-col items-center px-3 py-1.5 rounded-lg transition-all text-xs disabled:opacity-50 ${
                  selectedModel === m.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="font-label font-semibold tracking-wide leading-none">{m.label}</span>
                <span className={`font-label text-[0.55rem] tracking-widest uppercase mt-0.5 ${selectedModel === m.id ? 'text-primary/70' : 'text-on-surface-variant/50'}`}>{m.badge}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center pb-8">
            <div>
              <div className="text-4xl mb-3 opacity-60">◈</div>
              <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">Coach personalizado</p>
              <p className="font-body text-sm text-on-surface-variant max-w-xs">
                Preguntame sobre tus entrenamientos, sueño, estrés o recuperación. Uso tus datos reales de Garmin.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
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
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
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
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse rounded-sm" />
                  )}
                </>
              ) : (
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="mx-auto max-w-md px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="font-label text-label-sm text-red-400 tracking-wider uppercase mb-1">Error</p>
            <p className="text-sm text-red-300 font-body">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-outline-variant/20 shrink-0">
        <div className="flex gap-2 items-end bg-surface-container rounded-2xl px-4 py-3 border border-outline-variant/20 focus-within:border-primary/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Preguntame sobre tus datos..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent resize-none outline-none text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 max-h-32 leading-relaxed"
            style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="shrink-0 w-8 h-8 rounded-xl bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
              title="Detener"
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-red-400 block" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="shrink-0 w-8 h-8 rounded-xl bg-primary/20 hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Enviar (Enter)"
            >
              <span className="text-primary text-base leading-none">↑</span>
            </button>
          )}
        </div>
        <p className="text-center font-label text-[0.6rem] text-on-surface-variant/40 tracking-wider uppercase mt-2">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
};
