import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MarkdownText } from '../components/ui/MarkdownText';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: string;
}

const SUGGESTIONS = [
  '¿Cómo estuvo mi sueño esta semana?',
  '¿Cómo está mi recuperación según el HRV?',
  '¿Cómo van mis macros esta semana?',
  '¿Estoy comiendo suficiente proteína para mis objetivos?',
];

const GREETING_KEY = 'drift_ai_greeted';

const INITIAL_GREETING = `¡Hola! Soy DRIFT AI, tu coach deportivo personal. Tengo acceso a tus datos de entrenamiento, sueño, HRV, estrés y nutrición para darte recomendaciones personalizadas.

Podés preguntarme sobre tu recuperación, rendimiento deportivo, patrones de sueño, análisis nutricional o cualquier aspecto de tu entrenamiento. Usaré tus datos reales para interpretar y darte consejos concretos.

¿Sobre qué querés trabajar hoy?`;

const CHATS_KEY = 'drift_ai_chats';
const CURRENT_KEY = 'drift_ai_current_chat';

function loadChats(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(CHATS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveChats(chats: ChatSession[]) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

function generateTitle(firstUserMessage: string): string {
  return firstUserMessage.length > 45
    ? firstUserMessage.slice(0, 45) + '...'
    : firstUserMessage;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export const AICoach: React.FC = () => {
  const location = useLocation();
  const preseeded = (location.state as any)?.preseeded;
  const preseededContext = (location.state as any)?.context;
  const preseededResponse = (location.state as any)?.aiResponse;

  const [chats, setChats] = useState<ChatSession[]>(() => loadChats());
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    return localStorage.getItem(CURRENT_KEY);
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    if (preseeded && preseededResponse) {
      return [
        { role: 'user' as const, content: preseededContext || 'Análisis previo' },
        { role: 'assistant' as const, content: preseededResponse },
      ];
    }
    const savedId = localStorage.getItem(CURRENT_KEY);
    if (savedId) {
      const saved = loadChats().find(c => c.id === savedId);
      if (saved) return saved.messages;
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentChatIdRef = useRef<string | null>(currentChatId);
  currentChatIdRef.current = currentChatId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Greeting inicial si el usuario nunca ha abierto el coach
  useEffect(() => {
    if (!preseeded && messages.length === 0 && !localStorage.getItem(GREETING_KEY)) {
      setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
      localStorage.setItem(GREETING_KEY, '1');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist current chat after streaming ends
  const persistMessages = useCallback((msgs: Message[], chatId: string | null) => {
    const cleanMsgs = msgs.map(m => ({ role: m.role, content: m.content }));
    setChats(prev => {
      let updated: ChatSession[];
      if (chatId && prev.find(c => c.id === chatId)) {
        updated = prev.map(c =>
          c.id === chatId ? { ...c, messages: cleanMsgs } : c
        );
      } else {
        const firstUser = cleanMsgs.find(m => m.role === 'user');
        const newChat: ChatSession = {
          id: chatId || Date.now().toString(),
          title: firstUser ? generateTitle(firstUser.content) : 'Nueva conversación',
          messages: cleanMsgs,
          model: 'claude',
          createdAt: new Date().toISOString(),
        };
        updated = [newChat, ...prev];
        setCurrentChatId(newChat.id);
        currentChatIdRef.current = newChat.id;
        localStorage.setItem(CURRENT_KEY, newChat.id);
      }
      saveChats(updated);
      return updated;
    });
  }, []);

  const startNewChat = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    setCurrentChatId(null);
    currentChatIdRef.current = null;
    localStorage.removeItem(CURRENT_KEY);
    setError(null);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isStreaming]);

  const loadChat = useCallback((chat: ChatSession) => {
    if (isStreaming) return;
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    currentChatIdRef.current = chat.id;
    localStorage.setItem(CURRENT_KEY, chat.id);
    setError(null);
    setSidebarOpen(false);
  }, [isStreaming]);

  const deleteChat = useCallback((chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => {
      const updated = prev.filter(c => c.id !== chatId);
      saveChats(updated);
      return updated;
    });
    if (currentChatIdRef.current === chatId) {
      setMessages([]);
      setCurrentChatId(null);
      currentChatIdRef.current = null;
      localStorage.removeItem(CURRENT_KEY);
    }
    setDeletingId(null);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim();
    if (!userText || isStreaming) return;

    // Generate a chat ID if this is a new conversation
    if (!currentChatIdRef.current) {
      const newId = Date.now().toString();
      setCurrentChatId(newId);
      currentChatIdRef.current = newId;
      localStorage.setItem(CURRENT_KEY, newId);
    }

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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
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

      const finalMessages: Message[] = [
        ...newMessages,
        { role: 'assistant', content: assistantContent, streaming: false },
      ];
      setMessages(finalMessages);
      persistMessages(finalMessages, currentChatIdRef.current);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
          // Save partial response
          persistMessages(updated, currentChatIdRef.current);
          return updated;
        });
      } else {
        setError(err.message || 'Error al conectar con el coach');
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming, persistMessages]);

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
    <div className="flex h-full w-full overflow-hidden">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat history sidebar */}
      <aside className={`
        fixed lg:static top-0 left-0 h-full z-30 lg:z-auto
        w-64 shrink-0 flex flex-col
        bg-surface-container border-r border-outline-variant/20
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar header */}
        <div className="px-3 py-4 border-b border-outline-variant/20 shrink-0">
          <button
            onClick={startNewChat}
            disabled={isStreaming}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/15 hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed text-primary font-label font-semibold text-sm tracking-wide transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Nueva conversación
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto py-2">
          {chats.length === 0 ? (
            <p className="text-center text-on-surface-variant/40 font-label text-xs tracking-wider uppercase mt-6 px-3">
              Sin conversaciones
            </p>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => loadChat(chat)}
                className={`group relative mx-2 mb-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  currentChatId === chat.id
                    ? 'bg-primary/15 text-primary'
                    : 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <p className="font-body text-xs leading-snug line-clamp-2 pr-5">{chat.title}</p>
                <p className={`font-label text-[0.6rem] tracking-wider uppercase mt-1 ${
                  currentChatId === chat.id ? 'text-primary/60' : 'text-on-surface-variant/40'
                }`}>
                  {formatRelativeDate(chat.createdAt)}
                </p>
                {/* Delete button */}
                {deletingId === chat.id ? (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <button
                      onClick={(e) => deleteChat(chat.id, e)}
                      className="px-1.5 py-0.5 rounded text-[0.6rem] bg-red-500/20 text-red-400 hover:bg-red-500/30 font-label font-semibold"
                    >
                      Sí
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                      className="px-1.5 py-0.5 rounded text-[0.6rem] bg-surface-container-high text-on-surface-variant hover:bg-outline-variant/30 font-label"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(chat.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant/50 hover:text-red-400 text-base leading-none"
                    title="Eliminar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-outline-variant/20 shrink-0">
          <div className="flex items-center gap-2 max-w-3xl mx-auto w-full">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors shrink-0"
              title="Historial"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="3" width="14" height="1.5" rx="0.75"/>
                <rect x="1" y="7.25" width="14" height="1.5" rx="0.75"/>
                <rect x="1" y="11.5" width="14" height="1.5" rx="0.75"/>
              </svg>
            </button>

            {/* Title */}
            <div className="shrink-0">
              <p className="hidden sm:block font-label text-[0.6rem] text-on-surface-variant tracking-widest uppercase leading-none mb-0.5">Asistente</p>
              <h1 className="font-display text-base sm:text-xl font-bold text-on-surface tracking-tight whitespace-nowrap leading-tight">
                DRIFT AI <span className="text-primary">COACH</span>
              </h1>
            </div>

            {/* Claude badge */}
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-primary text-[0.6rem]">◈</span>
              <span className="font-label text-[0.6rem] text-primary tracking-widest uppercase font-semibold">Claude</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="max-w-3xl mx-auto w-full space-y-4">
            {isEmpty && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center pb-8">
                <div>
                  <div className="text-4xl mb-3 opacity-60">◈</div>
                  <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">Coach personalizado</p>
                  <p className="font-body text-sm text-on-surface-variant max-w-xs">
                    Preguntame sobre entrenamientos, sueño, nutrición, HRV o recuperación. Uso tus datos reales.
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
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 border-t border-outline-variant/20 shrink-0">
          <div className="max-w-3xl mx-auto w-full">
            <div className="flex gap-2 items-end bg-surface-container rounded-2xl px-4 py-3 border border-outline-variant/20 focus-within:border-primary/40 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Preguntame sobre tus datos..."
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent resize-none outline-none text-sm font-body text-on-surface placeholder:text-on-surface-variant/50 leading-relaxed overflow-hidden"
                style={{ maxHeight: '128px' }}
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
      </div>
    </div>
  );
};
