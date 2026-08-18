import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, Key, Check, RefreshCw, User } from 'lucide-react';
import { queryMentorAI, getGeminiApiKey, saveGeminiApiKey } from '../services/aiService';

/**
 * COMPONENTE: MentorAiChat.jsx
 * Chat interactivo con el Tutor Académico Mentor en el Dashboard.
 */
export default function MentorAiChat({ mentorState }) {
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

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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
      const responseText = await queryMentorAI(query, mentorState, messages);
      const mentorMsg = {
        id: `msg-mentor-${Date.now()}`,
        sender: 'mentor',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, mentorMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'mentor',
          text: 'Ocurrio un pequeno inconveniente al procesar la respuesta. Intentalo de nuevo.',
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-pm-lg shadow-2xl overflow-hidden flex flex-col h-[430px] transition-all duration-200">
      {/* Encabezado del Chat */}
      <div className="px-4 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-medium text-slate-100 flex items-center gap-1.5">
              Tutor Mentor <Sparkles className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            </h3>
            <p className="text-xs text-slate-400">
              {getGeminiApiKey() ? 'Conectado a Google Gemini Cloud' : 'Asistente Académico Activo'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowKeyModal(true)}
          className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 border border-slate-700 shadow-sm"
          title="Configurar clave API opcional de Gemini"
        >
          <Key className="w-3.5 h-3.5 text-emerald-400" /> Clave API
        </button>
      </div>

      {/* Lista de Mensajes */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-sm">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-slate-800 border border-slate-700 text-emerald-400'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[82%] rounded-2xl p-3.5 text-[13px] leading-relaxed transition-all font-medium ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-tr-none shadow-md'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none whitespace-pre-wrap shadow-md'
              }`}
            >
              {msg.text}
              <div
                className={`text-[10px] mt-1.5 text-right opacity-60 ${
                  msg.sender === 'user' ? 'text-white' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs shadow-sm bg-slate-800 border border-slate-700 text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-tl-none px-4 py-3.5 shadow-md flex items-center space-x-1.5 w-fit">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias Rápidas */}
      <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800 flex items-center space-x-2 overflow-x-auto no-scrollbar">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white hover:scale-105 transition-all duration-200 active:scale-95 shadow-sm font-medium"
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
        className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe a tu Mentor sobre tareas, inasistencias o repasos..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-2.5 text-[13px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90 disabled:opacity-40 text-white rounded-full transition-transform active:scale-95 shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Modal Ajustes API Key */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-pm-surface border border-pm-border rounded-pm-lg p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-pm-text flex items-center gap-2">
                <Key className="w-4 h-4 text-pm-accent" /> Clave API de Google Gemini (Opcional)
              </h3>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-pm-subtle hover:text-pm-text text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-pm-muted leading-relaxed">
              Puedes ingresar tu clave personal gratuita de Google Gemini para habilitar el modelo avanzado en la nube. Si dejas este campo vacío, la app usará el **Motor Mentor Local**.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-pm-muted">API Key de Google Gemini</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-pm-card border border-pm-border rounded-pm px-3 py-2 text-xs text-pm-text placeholder:text-pm-subtle focus:outline-none focus:border-pm-accent"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 rounded-pm text-xs text-pm-muted hover:text-pm-text"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-1.5 rounded-pm bg-pm-accent hover:bg-pm-accent/90 text-white text-xs font-medium flex items-center gap-1.5"
              >
                {apiKeySaved ? <Check className="w-3.5 h-3.5" /> : null} Guardar Clave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
