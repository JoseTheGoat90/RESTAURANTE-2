/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
  Boxes,
  TrendingUp,
  Receipt,
  Bike,
} from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { sendChatMessage } from '../services/api.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { cleanAsterisks, formatCOP, capitalizeFirst } from '../utils/formatters.ts';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const WELCOME_MESSAGE =
  '¡Hola! Soy el asistente del restaurante. Consulto la base de datos en tiempo real: ventas, pedidos abiertos, inventario, gastos y la proyección del mes. No registro nada sin que lo confirmes.\n\n¿En qué te puedo ayudar hoy?';

const QUICK_PROMPTS = [
  '¿Cómo va el negocio hoy comparado con la semana pasada?',
  '¿Cómo cerraría el mes a este ritmo?',
  '¿Qué mesas o pedidos faltan por cobrar?',
  '¿Qué insumos están más cerca de agotarse?',
  '¿Qué me recomiendas hacer esta semana?',
];

export const AsistenteTab: React.FC = () => {
  const { ventas, gastos, ingredientes, recetas, reporteHoy } = useData();
  const { paletteConfig } = useTheme();
  const { isDemo, getValidAccessToken } = useAuth();
  // Un id por conversación: n8n guarda la memoria del chat con este id
  const sessionIdRef = useRef(`panel-${Date.now()}`);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: WELCOME_MESSAGE,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const generateAutonomousResponse = (query: string): string => {
    const q = query.toLowerCase();

    // 1. Balance y Ventas
    if (q.includes('balance') || q.includes('ventas') || q.includes('cuanto hemos vendido') || q.includes('hoy')) {
      const domicilios = ventas.filter((v) => v.tipo_pedido === 'domicilio').length;
      const mesas = ventas.filter((v) => v.tipo_pedido === 'mesa').length;
      const paraLlevar = ventas.filter((v) => v.tipo_pedido === 'para_llevar').length;

      return `Resumen Operativo y Financiero de Hoy (${reporteHoy.periodo || 'Jornada Actual'}):
• Ventas Totales: ${formatCOP(reporteHoy.total_ventas)} (${reporteHoy.numero_ventas} pedidos registrados).
  - En Mesa: ${mesas} pedidos
  - A Domicilio: ${domicilios} pedidos
  - Para Llevar: ${paraLlevar} pedidos
• Gastos Totales: ${formatCOP(reporteHoy.total_gastos)}
• Balance (ingresos − gastos): ${formatCOP(reporteHoy.balance)} (${reporteHoy.balance >= 0 ? 'Margen positivo favorable' : 'Balance negativo en este turno'}).`;
    }

    // 2. Inventario, Carnes y Desechables
    if (q.includes('stock') || q.includes('ingrediente') || q.includes('inventario') || q.includes('carne') || q.includes('falta') || q.includes('comprar')) {
      const criticos = ingredientes.filter((i) => i.stock <= i.stock_minimo);
      const carnes = ingredientes.filter((i) => i.tipo_insumo === 'carnes_proteinas');
      const desechables = ingredientes.filter((i) => i.tipo_insumo === 'desechables');

      if (criticos.length === 0) {
        return `Excelente noticia: Todos los insumos principales de carnes, acompañamientos y empaques desechables cuentan con existencias superiores al stock mínimo de seguridad.
Actualmente disponemos de ${carnes.length} variedades de carnes y ${desechables.length} tipos de suministros de empaque listos.`;
      }

      const lista = criticos
        .map((i) => `• ${capitalizeFirst(i.ingrediente)}: ${i.stock} ${i.unidad} (Mínimo: ${i.stock_minimo} ${i.unidad}) - ${i.stock <= 0 ? 'AGOTADO' : 'BAJO MÍNIMO'}`)
        .join('\n');

      return `Alerta de Insumos para Reposición Inmediata:
${lista}

Recomendación: Se sugiere priorizar la compra de estos insumos para evitar desabastecimiento en la preparación de sopas y platos fuertes.`;
    }

    // 3. Domicilios y Comandas Activas
    if (q.includes('domicilio') || q.includes('pedido') || q.includes('comanda') || q.includes('cocina')) {
      const enCocina = ventas.filter((v) => v.estado === 'en_cocina' || v.estado === 'nuevo');
      const enCamino = ventas.filter((v) => v.estado === 'en_camino');

      return `Estado Actual del Flujo de Pedidos:
• En Preparación (Cocina): ${enCocina.length} comanda(s) pendiente(s).
• En Camino (Domiciliario): ${enCamino.length} pedido(s) despachado(s) hacia el cliente.
• Total Pedidos del Turno: ${ventas.length} registrados.

Recuerda que en los pedidos a domicilio y para llevar, el sistema descuenta automáticamente los contenedores térmicos/secos y los cubiertos desechables correspondientes.`;
    }

    // 4. Gastos y Cuentas por Pagar
    if (q.includes('gasto') || q.includes('pendiente') || q.includes('pagar') || q.includes('factura') || q.includes('servicio')) {
      const pendientes = gastos.filter((g) => g.estado === 'pendiente');
      const totalPend = pendientes.reduce((acc, curr) => acc + (curr.valor || 0), 0);

      if (pendientes.length === 0) {
        return `Control de Egresos:
• No tienes gastos pendientes por pagar en este periodo.
• Gastos ya cancelados hoy: ${formatCOP(reporteHoy.total_gastos)} distribuidos en compras de insumos, servicios y operaciones.`;
      }

      const detalle = pendientes
        .map((p) => `• ${capitalizeFirst(p.concepto)}: ${formatCOP(p.valor)} (Periodo: ${p.periodo || 'Mes actual'})`)
        .join('\n');

      return `Resumen de Cuentas Pendientes por Pagar:
${detalle}

Total acumulado por pagar: ${formatCOP(totalPend)}. Puedes marcarlos como pagados desde la pestaña de Gastos una vez realizada la transferencia o desembolso.`;
    }

    // 5. Recetas y Preparación
    if (q.includes('receta') || q.includes('plato') || q.includes('sopa') || q.includes('pollo') || q.includes('lomo')) {
      const platosUnicos = Array.from(new Set(recetas.map((r) => r.plato)));
      return `Menú y Fichas de Preparación Configuradas (${platosUnicos.length} platos):
${platosUnicos.map((p) => `• ${capitalizeFirst(p)}: Vinculado con sus carnes, acompañamientos (bollo, yuca, patacón, papa, ensaladas) y empaques.`).join('\n')}

Al registrar cualquier comanda, el inventario se descuenta automáticamente por porción servida.`;
    }

    // Respuesta general
    return `Puedo orientarte con las operaciones del restaurante:
1. "Balance": Conoce ventas, egresos y margen neto.
2. "Inventario / Carnes": Consulta stock de lomo, pechuga, chuleta, costillas, jarrete, acompañamientos y desechables.
3. "Domicilios": Monitorea pedidos en cocina o en camino.
4. "Gastos pendientes": Revisa cuentas y facturas de servicios o proveedores por pagar.`;
  };

  const agregarRespuesta = (text: string) =>
    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: cleanAsterisks(text),
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      if (isDemo) {
        // Modo demo: sin sesión real no se puede consultar n8n; respuesta local con los datos de ejemplo
        agregarRespuesta(`(Modo demo, sin IA) ${generateAutonomousResponse(query)}`);
        return;
      }
      // Modo real: el asistente de n8n (Gemini) consulta la base con la sesión del usuario
      const token = await getValidAccessToken();
      if (!token) {
        agregarRespuesta('Tu sesión expiró. Inicia sesión de nuevo para usar el asistente.');
        return;
      }
      const res = await sendChatMessage({ token, message: query, sessionId: sessionIdRef.current });
      agregarRespuesta(res.output || 'El asistente no devolvió respuesta. Intenta de nuevo.');
    } catch (err) {
      agregarRespuesta(`No pude conectar con el asistente (n8n): ${err instanceof Error ? err.message : 'error desconocido'}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    sessionIdRef.current = `panel-${Date.now()}`;
    setMessages([
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: WELCOME_MESSAGE,
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="flex flex-col flex-1 h-[calc(100dvh-125px)] sm:h-[calc(100dvh-135px)] max-w-5xl w-full mx-auto p-2 sm:p-4 overflow-hidden">
      {/* Top Bar with Assistant Header */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] shadow-xs p-4 mb-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: paletteConfig.accent }}
          >
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--text-main)]">
                Asistente Operativo del Restaurante
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {isDemo ? 'Modo demo' : 'IA · n8n'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Responde con datos reales de la base: ventas, pedidos, inventario, gastos y proyecciones
            </p>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          className="p-2 text-xs font-medium rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
          title="Reiniciar chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar shrink-0">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-[var(--brand-accent)]" />
          Consultas rápidas:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            className="px-3 py-1 text-xs rounded-full bg-[var(--bg-card)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-main)] border border-[var(--border-soft)] hover:border-[var(--brand-accent)]/40 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
                  isUser
                    ? 'bg-[var(--brand-accent)] text-white rounded-tr-none'
                    : 'bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-soft)] rounded-tl-none whitespace-pre-line'
                }`}
              >
                <div>{msg.text}</div>
                <div
                  className={`text-[10px] mt-1.5 ${
                    isUser ? 'text-white/70 text-right' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </motion.div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] p-2">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-accent)] animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-[var(--brand-accent)] animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-[var(--brand-accent)] animate-bounce [animation-delay:0.4s]" />
            <span>Consultando datos del restaurante...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="mt-3 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Escribe tu consulta sobre carnes, acompañamientos, comandas, domicilios o gastos..."
          disabled={isLoading}
          className="flex-1 h-12 px-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] shadow-xs"
        />

        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          style={{ backgroundColor: paletteConfig.accent }}
          className="h-12 px-5 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
};
