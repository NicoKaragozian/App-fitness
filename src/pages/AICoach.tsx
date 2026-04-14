import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MarkdownText } from '../components/ui/MarkdownText';
import { TTSButton } from '../components/ui/TTSButton';
import { STTButton } from '../components/ui/STTButton';
import AIProgressIndicator from '../components/ui/AIProgressIndicator';
import { useAIProgress } from '../hooks/useAIProgress';
import type { AIProgressConfig } from '../hooks/useAIProgress';

interface ToolEvent {
  type: 'call' | 'result';
  id: string;
  name: string;
  input?: any;
  result?: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  toolEvents?: ToolEvent[];
  pendingTool?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: string;
}

const SUGGESTIONS = [
  'Dame mi briefing del día',
  'Creame un plan de entrenamiento',
  '¿Cómo dormí anoche?',
  'Registrar una comida',
];

const AGENT_PLAN_PROGRESS: AIProgressConfig = {
  mode: 'timed',
  estimatedDurationMs: 15000,
  phases: [
    { at: 0, label: 'Conectando con Claude...' },
    { at: 8, label: 'Analizando tu perfil...' },
    { at: 25, label: 'Diseñando las sesiones...' },
    { at: 50, label: 'Armando tu plan...' },
    { at: 75, label: 'Ajustando ejercicios...' },
    { at: 90, label: 'Guardando plan...' },
  ],
};

const TOOL_LABELS: Record<string, string> = {
  update_profile: 'Actualizando perfil...',
  generate_training_plan: 'Generando plan de entrenamiento...',
  log_meal: 'Registrando comida...',
  get_daily_briefing: 'Cargando briefing del día...',
  navigate_to: 'Navegando...',
};

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

// ── Inline tool result cards ─────────────────────────────────────────

const ToolResultCard: React.FC<{ event: ToolEvent }> = ({ event }) => {
  const r = event.result;
  if (!r || r.error) {
    return r?.error ? (
      <div className="mt-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
        Error: {r.error}
      </div>
    ) : null;
  }

  switch (event.name) {
    case 'generate_training_plan':
      return (
        <div className="mt-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-primary text-sm">▣</span>
            <span className="font-label text-xs font-semibold text-primary tracking-wide uppercase">Plan creado</span>
          </div>
          <p className="font-body text-sm font-semibold text-on-surface">{r.title}</p>
          {r.objective && <p className="font-body text-xs text-on-surface-variant mt-0.5">{r.objective}</p>}
          {r.sessions && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {r.sessions.map((s: any, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-lg bg-surface-container text-xs font-label text-on-surface-variant">
                  {s.name} · {s.exercise_count} ej.
                </span>
              ))}
            </div>
          )}
          <a href={`/training/${r.plan_id}`} className="inline-block mt-2 font-label text-xs text-primary hover:text-primary/80 tracking-wide">
            Ver plan completo →
          </a>
        </div>
      );

    case 'log_meal':
      return (
        <div className="mt-2 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-400 text-sm">✓</span>
            <span className="font-label text-xs font-semibold text-green-400 tracking-wide uppercase">Comida registrada</span>
          </div>
          <p className="font-body text-sm text-on-surface">{r.meal_name}</p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <span className="px-2 py-0.5 rounded-lg bg-surface-container text-xs font-label text-on-surface-variant">{r.calories} kcal</span>
            <span className="px-2 py-0.5 rounded-lg bg-surface-container text-xs font-label text-on-surface-variant">P: {r.protein_g}g</span>
            <span className="px-2 py-0.5 rounded-lg bg-surface-container text-xs font-label text-on-surface-variant">C: {r.carbs_g}g</span>
            <span className="px-2 py-0.5 rounded-lg bg-surface-container text-xs font-label text-on-surface-variant">G: {r.fat_g}g</span>
          </div>
        </div>
      );

    case 'update_profile':
      return (
        <div className="mt-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 text-sm">✓</span>
            <span className="font-label text-xs font-semibold text-blue-400 tracking-wide uppercase">Perfil actualizado</span>
          </div>
          {r.updated_fields?.length > 0 && (
            <p className="font-body text-xs text-on-surface-variant mt-1">
              Campos: {r.updated_fields.join(', ')}
            </p>
          )}
        </div>
      );

    case 'get_daily_briefing':
      return (
        <div className="mt-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-primary text-sm">◉</span>
            <span className="font-label text-xs font-semibold text-primary tracking-wide uppercase">Briefing del día</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-body">
            <div className="px-2 py-1.5 rounded-lg bg-surface-container">
              <span className="text-on-surface-variant">Readiness</span>
              <p className="font-semibold text-on-surface">{r.readiness?.score ?? '-'} — {r.readiness?.label ?? '-'}</p>
            </div>
            <div className="px-2 py-1.5 rounded-lg bg-surface-container">
              <span className="text-on-surface-variant">Sueño</span>
              <p className="font-semibold text-on-surface">{r.sleep?.score ?? 'sin datos'}</p>
            </div>
            <div className="px-2 py-1.5 rounded-lg bg-surface-container">
              <span className="text-on-surface-variant">HRV</span>
              <p className="font-semibold text-on-surface">{r.hrv?.current ? `${r.hrv.current}ms` : 'sin datos'}</p>
            </div>
            <div className="px-2 py-1.5 rounded-lg bg-surface-container">
              <span className="text-on-surface-variant">Estrés</span>
              <p className="font-semibold text-on-surface">{r.stress?.current ?? 'sin datos'}</p>
            </div>
          </div>
          {r.recommendations?.length > 0 && (
            <div className="mt-2 px-2 py-1.5 rounded-lg bg-surface-container">
              <p className="text-xs text-on-surface-variant font-label uppercase tracking-wide mb-0.5">Top recomendación</p>
              <p className="text-xs text-on-surface">{r.recommendations[0].title}: {r.recommendations[0].description}</p>
            </div>
          )}
        </div>
      );

    case 'navigate_to':
      return (
        <div className="mt-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <span className="font-label text-xs text-primary tracking-wide">Navegando a {r.route}...</span>
        </div>
      );

    default:
      return null;
  }
};

export const AICoach: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const preseeded = (location.state as any)?.preseeded;
  const preseededContext = (location.state as any)?.context;
  const preseededResponse = (location.state as any)?.aiResponse;

  const aiProgress = useAIProgress();

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    const cleanMsgs = msgs.map(({ streaming, pendingTool, ...rest }) => rest);
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
    if ((!userText && !imageFile) || isStreaming) return;

    // Generate a chat ID if this is a new conversation
    if (!currentChatIdRef.current) {
      const newId = Date.now().toString();
      setCurrentChatId(newId);
      currentChatIdRef.current = newId;
      localStorage.setItem(CURRENT_KEY, newId);
    }

    setError(null);
    const displayText = userText || (imageFile ? '📷 Imagen de comida' : '');
    const messageText = userText || (imageFile ? 'Analizá esta imagen de comida y registrala con log_meal.' : '');
    const newMessages: Message[] = [...messages, { role: 'user', content: messageText }];
    setMessages([...messages, { role: 'user', content: displayText }, { role: 'assistant', content: '', streaming: true }]);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setIsStreaming(true);

    abortRef.current = new AbortController();

    // Capture and clear image state before async work
    const currentImage = imageFile;
    if (currentImage) {
      setImageFile(null);
      setImagePreview(null);
    }

    try {
      let fetchBody: BodyInit;
      const fetchHeaders: Record<string, string> = {};

      if (currentImage) {
        // Multipart: send image + messages as form data
        const formData = new FormData();
        formData.append('image', currentImage);
        formData.append('messages', JSON.stringify(newMessages));
        fetchBody = formData;
        // Don't set Content-Type — browser sets multipart boundary automatically
      } else {
        fetchHeaders['Content-Type'] = 'application/json';
        fetchBody = JSON.stringify({ messages: newMessages });
      }

      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: fetchHeaders,
        body: fetchBody,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const toolEvents: ToolEvent[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              assistantContent += parsed.token;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant', content: assistantContent, streaming: true,
                  toolEvents: toolEvents.length > 0 ? [...toolEvents] : undefined,
                };
                return updated;
              });
            } else if (parsed.tool_call) {
              toolEvents.push({ type: 'call', id: parsed.tool_call.id, name: parsed.tool_call.name, input: parsed.tool_call.input });
              // Start progress for long-running tools
              if (parsed.tool_call.name === 'generate_training_plan') {
                aiProgress.start(AGENT_PLAN_PROGRESS);
              }
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant', content: assistantContent, streaming: true,
                  toolEvents: [...toolEvents], pendingTool: parsed.tool_call.name,
                };
                return updated;
              });
            } else if (parsed.tool_result) {
              toolEvents.push({ type: 'result', id: parsed.tool_result.id, name: parsed.tool_result.name, result: parsed.tool_result.result });
              // Complete progress for long-running tools
              if (parsed.tool_result.name === 'generate_training_plan') {
                aiProgress.complete();
              }
              // Handle navigate_to
              if (parsed.tool_result.name === 'navigate_to' && parsed.tool_result.result?.route) {
                setTimeout(() => navigate(parsed.tool_result.result.route), 800);
              }
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant', content: assistantContent, streaming: true,
                  toolEvents: [...toolEvents], pendingTool: undefined,
                };
                return updated;
              });
            }
          } catch { /* skip non-JSON lines */ }
        }
      }

      const finalMessages: Message[] = [
        ...newMessages,
        {
          role: 'assistant', content: assistantContent, streaming: false,
          toolEvents: toolEvents.length > 0 ? toolEvents : undefined,
        },
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
      if (aiProgress.isActive) aiProgress.reset();
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isStreaming, persistMessages, aiProgress]);

  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleSTTTranscript = useCallback((text: string) => {
    setInput(prev => prev ? prev + ' ' + text : text);
    setTimeout(resizeTextarea, 0);
  }, [resizeTextarea]);

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
                  <p className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mb-1">DRIFT AI Coach</p>
                  <p className="font-body text-sm text-on-surface-variant max-w-sm">
                    Tu coach deportivo con poder de acción. Puedo generar planes, registrar comidas, actualizar tu perfil y analizar tus datos.
                  </p>
                </div>
                {/* Featured briefing button */}
                <button
                  onClick={() => sendMessage('Dame mi briefing del día')}
                  className="px-5 py-3 rounded-2xl bg-primary/20 hover:bg-primary/30 text-primary font-label text-sm font-semibold tracking-wide transition-all border border-primary/30"
                >
                  ◉ Briefing de hoy
                </button>
                {/* Other suggestions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                  {SUGGESTIONS.slice(1).map((s) => (
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
                      {msg.content && <MarkdownText text={msg.content} />}
                      {/* Tool events */}
                      {msg.toolEvents?.map((ev, i) => {
                        if (ev.type === 'result') {
                          return <ToolResultCard key={i} event={ev} />;
                        }
                        return null;
                      })}
                      {/* Pending tool indicator */}
                      {msg.pendingTool && (
                        msg.pendingTool === 'generate_training_plan' && aiProgress.isActive ? (
                          <div className="mt-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
                            <AIProgressIndicator progress={aiProgress.progress} phase={aiProgress.phase} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="font-label text-xs text-primary tracking-wide">
                              {TOOL_LABELS[msg.pendingTool] || 'Procesando...'}
                            </span>
                          </div>
                        )
                      )}
                      {msg.streaming && !msg.pendingTool ? (
                        <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse rounded-sm" />
                      ) : !msg.streaming ? (
                        <div className="flex justify-end mt-1.5">
                          <TTSButton text={msg.content} />
                        </div>
                      ) : null}
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
            {/* Image preview */}
            {imagePreview && (
              <div className="flex items-center gap-2 mb-2 px-2">
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-xl border border-outline-variant/30" />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface-container border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-red-400 text-xs"
                  >
                    ×
                  </button>
                </div>
                <span className="font-label text-xs text-on-surface-variant tracking-wide">Imagen adjunta</span>
              </div>
            )}
            <div className="flex gap-2 items-end bg-surface-container rounded-2xl px-4 py-3 border border-outline-variant/20 focus-within:border-primary/40 transition-colors">
              {/* Hidden file input */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                  e.target.value = '';
                }}
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  resizeTextarea();
                }}
                onKeyDown={handleKeyDown}
                placeholder={imageFile ? "Describí la comida o enviá directo..." : "Preguntame sobre tus datos..."}
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
                <>
                  {/* Image upload button */}
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      imageFile
                        ? 'bg-primary/20 text-primary'
                        : 'bg-surface-container-high hover:bg-surface-container-high/80 text-on-surface-variant hover:text-on-surface'
                    }`}
                    title="Adjuntar imagen"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </button>
                  <STTButton
                    onTranscript={handleSTTTranscript}
                    size="md"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() && !imageFile}
                    className="shrink-0 w-8 h-8 rounded-xl bg-primary/20 hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Enviar (Enter)"
                  >
                    <span className="text-primary text-base leading-none">↑</span>
                  </button>
                </>
              )}
            </div>
            <p className="text-center font-label text-[0.6rem] text-on-surface-variant/40 tracking-wider uppercase mt-2">
              Enter para enviar · Shift+Enter para nueva línea · Micrófono para dictar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
