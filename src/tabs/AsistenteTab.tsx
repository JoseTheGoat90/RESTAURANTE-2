import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Zap,
} from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { sendChatMessage } from '../services/api.ts';
import { getChatUrl, setChatUrl, DEFAULT_CHAT_URL } from '../config.ts';
import { cleanAsterisks, formatCOP } from '../utils/formatters.ts';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

const WELCOME_MESSAGE =
  '¡Hola! Soy tu asistente de gestión para el restaurante. Puedo responder consultas operativas y financieras exclusivamente sobre ventas, gastos, existencias de inventario, recetas y balance diario.\n\n¿En qué te puedo ayudar hoy?';

const QUICK_PROMPTS = [
  '¿Cuál es el balance financiero de hoy?',
  '¿Qué ingredientes tienen stock bajo o crítico?',
  '¿Cuáles son los platos con mayor venta?',
  '¿Cuánto hemos gastado en compras hoy?'
];

export const AsistenteTab: React.FC = () => {
  const { ventas, gastos, ingredientes, recetas, reporteHoy, showNotification } = useData();
  const { paletteConfig } = useTheme();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: WELCOME_MESSAGE,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [webhookUrl, setWebhookUrlState] = useState(getChatUrl());
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pingMessage, setPingMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSaveWebhook = () => {
    const trimmed = webhookUrl.trim();
    if (!trimmed) {
      setChatUrl(DEFAULT_CHAT_URL);
      setWebhookUrlState(DEFAULT_CHAT_URL);
      showNotification({ ok: true, mensaje: 'Restablecido al webhook predeterminado' });
      return;
    }
    setChatUrl(trimmed);
    showNotification({ ok: true, mensaje: 'URL de Webhook n8n actualizada con éxito' });
    setShowSettings(false);
  };

  const handleTestPing = async () => {
    setPingStatus('testing');
    setPingMessage('Probando conexión con el nodo Webhook...');
    try {
      const res = await sendChatMessage({
        token: '',
        message: 'ping-test: verifique conexión operativa de restaurante',
        sessionId: 'sistema-diagnostico'
      });
      if (res && res.output) {
        setPingStatus('success');
        setPingMessage(`Conexión exitosa: ${cleanAsterisks(res.output.slice(0, 100))}`);
      } else {
        setPingStatus('success');
        setPingMessage('Nodo Webhook de n8n respondió con éxito');
      }
    } catch (err: any) {
      setPingStatus('error');
      setPingMessage(err?.message || 'No se pudo conectar con el webhook de n8n');
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      // Prepare local operational restaurant context for n8n webhook payload
      const criticosCount = ingredientes.filter((i) => i.stock <= i.stock_minimo).length;
      const contextPrefix = `[Contexto Restaurante: Ventas=${formatCOP(reporteHoy.total_ventas)}, Gastos=${formatCOP(reporteHoy.total_gastos)}, Balance=${formatCOP(reporteHoy.balance)}, Stock Crítico=${criticosCount} ítems] `;
      const fullPrompt = `${contextPrefix}${query}`;

      const response = await sendChatMessage({
        token: '',
        message: fullPrompt,
        sessionId: 'panel-restaurante'
      });

      const rawText = response.output || 'Sin respuesta del asistente.';
      // Strictly clean any ** markdown bold symbols as instructed by the user
      const sanitizedText = cleanAsterisks(rawText);

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: sanitizedText,
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      // Local fallback contextual answer if n8n webhook is unreachable
      const lower = query.toLowerCase();
      let fallback = '';

      if (lower.includes('balance') || lower.includes('hoy') || lower.includes('ventas')) {
        fallback = `Balance de operaciones:\n- Ventas totales registradas: ${formatCOP(reporteHoy.total_ventas)}\n- Gastos totales: ${formatCOP(reporteHoy.total_gastos)}\n- Utilidad / Balance neto: ${formatCOP(reporteHoy.balance)}\n- Total de comandas atendidas: ${ventas.length}`;
      } else if (lower.includes('stock') || lower.includes('ingrediente') || lower.includes('inventario')) {
        const criticos = ingredientes.filter((i) => i.stock <= i.stock_minimo);
        if (criticos.length === 0) {
          fallback = 'Todos los insumos del restaurante están actualmente con existencias por encima del stock mínimo establecido.';
        } else {
          fallback = `Alerta de insumos en nivel crítico o bajo:\n${criticos.map((i) => `• ${i.ingrediente}: ${i.stock} ${i.unidad} (Mínimo: ${i.stock_minimo})`).join('\n')}`;
        }
      } else if (lower.includes('plato') || lower.includes('rotacion') || lower.includes('mas vendido')) {
        const counts: Record<string, number> = {};
        ventas.forEach((v) => {
          counts[v.plato] = (counts[v.plato] || 0) + v.cantidad;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) {
          fallback = 'No se han registrado ventas suficientes aún para calcular los platos de mayor rotación.';
        } else {
          fallback = `Platos con mayor rotación en el restaurante:\n${sorted.slice(0, 3).map(([name, qty], idx) => `${idx + 1}. ${name}: ${qty} unidades`).join('\n')}`;
        }
      } else if (lower.includes('gasto') || lower.includes('compras')) {
        fallback = `Resumen de gastos:\n- Total gastos del periodo: ${formatCOP(reporteHoy.total_gastos)}\n- Cantidad de comprobantes: ${gastos.length} comprobantes registrados.`;
      } else {
        fallback = `Nota operativa: El webhook de n8n no respondió (${err?.message || 'Tiempo de espera agotado'}). Recuerda que este asistente está programado exclusivamente para responder temas operativos de tu restaurante (ventas, gastos, existencias de inventario, recetas y balance diario).`;
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: cleanAsterisks(fallback),
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: WELCOME_MESSAGE,
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showNotification({ ok: true, mensaje: 'Conversación del asistente reiniciada' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[580px] max-w-5xl mx-auto p-3 sm:p-5">
      {/* Top Bar with Assistant Header and n8n Quick Controls */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md transition-transform hover:scale-105"
            style={{ backgroundColor: paletteConfig.accent }}
          >
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--text-main)]">
                Asistente Operativo de Restaurante
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                n8n Webhook
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Especializado exclusivamente en ventas, recetas, stock y costos del restaurante
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Configurar Webhook n8n"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showSettings ? 'Ocultar Webhook' : 'Conexión n8n'}</span>
          </button>
          <button
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-500 hover:text-red-600 dark:text-gray-400 transition-colors cursor-pointer"
            title="Reiniciar chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible n8n Connection Drawer */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="bg-[var(--bg-card)] rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 shadow-sm text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: paletteConfig.accent }} />
                  <span className="font-bold text-[var(--text-main)]">
                    Configuración de Webhook n8n
                  </span>
                </div>
                <span className="text-[11px] text-gray-400">
                  Responde mediante nodo Webhook (POST)
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrlState(e.target.value)}
                  placeholder="https://su-instancia.app.n8n.cloud/webhook/panel-chat"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[var(--text-main)] text-xs focus:ring-2 focus:ring-[var(--brand-accent)] focus:outline-none font-mono"
                />
                <button
                  onClick={handleSaveWebhook}
                  className="px-4 py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-95 text-xs whitespace-nowrap cursor-pointer"
                  style={{ backgroundColor: paletteConfig.accent }}
                >
                  Guardar URL
                </button>
                <button
                  onClick={handleTestPing}
                  disabled={pingStatus === 'testing'}
                  className="px-3 py-2 rounded-lg font-medium border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-[var(--text-main)] hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5 whitespace-nowrap text-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${pingStatus === 'testing' ? 'animate-spin' : ''}`} />
                  <span>Probar Conexión</span>
                </button>
              </div>

              {pingMessage && (
                <div
                  className={`p-2.5 rounded-lg flex items-center gap-2 text-[11px] ${
                    pingStatus === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : pingStatus === 'error'
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {pingStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : pingStatus === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-blue-500" />
                  )}
                  <span className="break-all">{pingMessage}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Single-Window Chat Area */}
      <div className="flex-1 bg-[var(--bg-card)] rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col overflow-hidden relative">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                    isUser
                      ? 'bg-gray-800 dark:bg-zinc-700 text-white'
                      : 'text-white'
                  }`}
                  style={!isUser ? { backgroundColor: paletteConfig.accent } : undefined}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-sm max-w-[85%] ${
                    isUser
                      ? 'bg-gray-900 dark:bg-zinc-800 text-white'
                      : m.isError
                      ? 'bg-amber-50 dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 text-gray-800 dark:text-zinc-200'
                      : 'bg-gray-100 dark:bg-zinc-900/90 border border-gray-200 dark:border-zinc-800 text-[var(--text-main)]'
                  }`}
                >
                  <p className="font-normal selection:bg-amber-200 dark:selection:bg-amber-900/60">
                    {cleanAsterisks(m.text)}
                  </p>
                  <span
                    className={`block text-[10px] mt-1.5 ${
                      isUser ? 'text-gray-400 text-right' : 'text-gray-400 dark:text-zinc-500'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 max-w-md items-center text-xs text-gray-500 dark:text-gray-400"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: paletteConfig.accent }}
              >
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-gray-100 dark:bg-zinc-900 rounded-2xl px-4 py-3 flex items-center gap-2 border border-gray-200 dark:border-zinc-800">
                <span className="w-2 h-2 rounded-full bg-current animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-1 text-xs">Consultando base operativa...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Sugerencias:
          </span>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 text-[11px] shrink-0 transition-colors whitespace-nowrap cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-zinc-800 bg-[var(--bg-card)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Pregunta sobre ventas, gastos de hoy, insumos críticos o balance..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[var(--text-main)] text-sm focus:ring-2 focus:ring-[var(--brand-accent)] focus:outline-none placeholder-gray-400 dark:placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-5 py-2.5 rounded-xl font-bold text-white shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 active:scale-95 text-sm cursor-pointer"
              style={{ backgroundColor: paletteConfig.accent }}
            >
              <span>Enviar</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400 px-1">
            <span>Solo consultas operativas del restaurante</span>
            <span>Formato limpio sin asteriscos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
