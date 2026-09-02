import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bot, Send, Sparkles, Key, Check, RefreshCw, User, BookOpen, FileCheck, Maximize2, Minimize2 } from 'lucide-react';
import { queryMentorAI, getGeminiApiKey, saveGeminiApiKey } from '../services/aiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * COMPONENTE: MentorAiChat.jsx
 * Chat interactivo con el Tutor Académico Mentor en el Dashboard.
 * Renderiza Markdown (bold, italic, lists, code, tables) usando react-markdown + remark-gfm.
 *
 * Modos:
 *  - Colapsado (default): tarjeta compacta en el Dashboard
 *  - Expandido: panel fixed fullscreen (95vw x 95vh) con boton cerrar
 */
export default function MentorAiChat({ mentorState }) {
  const [expanded, setExpanded] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      sender: 'mentor',
      text: '¡Hola! Soy tu **Mentor Académico**. Estoy al tanto de tus materias, tus inasistencias y tus entregas pendientes. ¿En qué trabajaremos hoy?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [learningMode, setLearningMode] = useState('study');

  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input.trim();
    if (!query || loading) return;

    const userMsg = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const responseText = await queryMentorAI(query, mentorState, messages, { mode: learningMode });
      const mentorMsg = {
        id: `msg-mentor-${Date.now()}`,
        sender: 'mentor',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, mentorMsg]);
    } catch (err) {
      const isCredError = err.message && (err.message.includes('CREDENTIALS_ERROR') || err.message.includes('denied') || err.message.includes('disabled'));
      const isRateLimit = err.message && err.message.includes('RATE_LIMIT');
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'mentor',
          text: isCredError
            ? '⚠️ **Error de credenciales**: Tu API Key de Groq no es valida o fue deshabilitada.\n\nPor favor actualiza tu Clave API en la configuracion (ícono 🔑 arriba) o eliminela para usar el asistente local.'
            : isRateLimit
            ? '⚠️ **Limite de velocidad**: Has excedido el numero de solicitudes permitidas. Espera 60 segundos e intenta de nuevo.'
            : 'Ocurrio un pequeño inconveniente al procesar la respuesta. Intentalo de nuevo.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = () => {
    saveGeminiApiKey(apiKeyInput);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
    setShowKeyModal(false);
  };

  const quickPrompts = [
    'Que deberia estudiar hoy?',
    'Estado de mis inasistencias',
    'Estrategia para examen final',
    'Pausa anti-estres',
  ];

  const MentorMessage = useMemo(() => function MentorMessage({ text }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
          em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
          code: ({ children }) => (
            <code className="bg-slate-700/50 text-zinc-200 px-1.5 py-0.5 rounded text-[13px] font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-slate-900/80 border border-slate-700 rounded-lg p-3 my-2 overflow-x-auto">
              {children}
            </pre>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-emerald-500/50 pl-3 italic text-slate-300 my-2">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-600 px-2 py-1 bg-slate-800 font-semibold text-zinc-200">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-600 px-2 py-1">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    );
  }, []);

  /* ── MODO COLAPSADO: tarjeta compacta con click para expandir ── */
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className="glass-card rounded-2xl shadow-glass cursor-pointer hover:border-brand-500/40 transition-all duration-200 group"
      >
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-100 flex items-center gap-1.5">
                Tutor Mentor <Sparkles className="w-4 h-4 text-brand-400 fill-brand-400" />
              </h3>
              <p className="text-xs text-slate-400">
                {getGeminiApiKey() ? 'Conectado a Groq (Llama)' : 'Asistente Académico Activo'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-brand-400 transition-colors">
            Abrir chat <Maximize2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="px-4 pb-3 text-xs text-slate-500 truncate">
          {messages[messages.length - 1]?.text?.slice(0, 100) || 'Haz clic para abrir el chat...'}
        </div>
      </div>
    );
  }

  /* ── MODO EXPANDIDO: panel fullscreen (95vw x 95vh) ── */
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setExpanded(false)} />
      <div
        className="fixed z-50 flex flex-col bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl overflow-hidden"
        style={{
          top: '2.5vh',
          left: '2.5vw',
          width: '95vw',
          height: '95vh',
        }}
      >
        {/* Encabezado del Chat */}
        <div className="px-5 py-4 border-b border-zinc-700 flex items-center justify-between bg-zinc-900 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-slate-100 flex items-center gap-1.5">
                Tutor Mentor <Sparkles className="w-4 h-4 text-brand-400 fill-brand-400" />
              </h3>
              <p className="text-sm text-slate-400">
                {getGeminiApiKey() ? 'Conectado a Groq (Llama)' : 'Asistente Académico Activo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLearningMode('study')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors border ${
                learningMode === 'study'
                  ? 'bg-brand-600/20 border-brand-500/50 text-brand-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}
              title="Modo Estudio: tutor experto que explica a fondo"
            >
              <BookOpen className="w-3.5 h-3.5" /> Estudio
            </button>
            <button
              onClick={() => setLearningMode('exam')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors border ${
                learningMode === 'exam'
                  ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}
              title="Modo Examen: genera test riguroso del material"
            >
              <FileCheck className="w-3.5 h-3.5" /> Examen
            </button>
            <button
              onClick={() => setShowKeyModal(true)}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 border border-zinc-700"
              title="Configurar clave API opcional de Groq"
            >
              <Key className="w-4 h-4 text-zinc-400" /> Clave API
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 border border-zinc-700"
              title="Cerrar chat"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lista de Mensajes — flex-1 takes all remaining height */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 text-[15px] bg-zinc-900">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[75%] rounded-2xl p-4 text-[15px] leading-relaxed transition-all font-medium ${
                  msg.sender === 'user'
                    ? 'bg-zinc-800 text-zinc-100 rounded-tr-none'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-none whitespace-pre-wrap shadow-md'
                }`}
              >
                {msg.sender === 'mentor' ? (
                  <MentorMessage text={msg.text} />
                ) : (
                  <>
                    {msg.text}
                    <div className="text-[11px] mt-1.5 text-right opacity-60 text-white">
                      {msg.timestamp}
                    </div>
                  </>
                )}
                {msg.sender === 'user' && (
                  <div className="text-[11px] mt-1.5 text-right opacity-60 text-white">
                    {msg.timestamp}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs shadow-sm bg-zinc-800 border border-zinc-700 text-zinc-400">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-2xl rounded-tl-none px-5 py-4 shadow-md flex items-center space-x-2 w-fit">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugerencias Rápidas */}
        <div className="px-5 py-3 border-t border-zinc-700 flex items-center space-x-3 overflow-x-auto no-scrollbar bg-zinc-900 shrink-0">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="shrink-0 px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white hover:scale-105 transition-all duration-200 active:scale-95 shadow-sm font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input de Mensaje */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t border-zinc-700 bg-zinc-900 flex items-center gap-3 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe a tu Mentor sobre tareas, inasistencias o repasos..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-5 py-3 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 rounded-full bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40 disabled:hover:bg-brand-600 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        {/* Modal Ajustes API Key */}
        {showKeyModal && (
          <div className="absolute inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Key className="w-4 h-4 text-brand-400" /> Clave API de Groq (Opcional)
                </h3>
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="text-zinc-400 hover:text-zinc-100 text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Puedes ingresar tu clave de Groq (gratuita en console.groq.com) para habilitar el modelo avanzado Llama en la nube. Si dejas este campo vacío, la app usará el **Motor Mentor Local**.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">API Key de Groq</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveKey}
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  {apiKeySaved ? <Check className="w-3.5 h-3.5" /> : null} Guardar Clave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
