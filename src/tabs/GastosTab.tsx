/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  formatCOP,
  formatBogotaDateTime,
  capitalizeFirst,
  generateOperationId,
  normalizeUserInput,
} from '../utils/formatters.ts';
import { CategoriaGasto, MetodoPago, EstadoGasto } from '../types.ts';
import {
  Receipt,
  PlusCircle,
  Clock,
  Sparkles,
  ShoppingBag,
  Zap,
  Shield,
  Layers,
  Loader2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Check,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  fastStaggerContainerVariants,
  tableRowVariants,
} from '../utils/animations.ts';

interface PreConcepto {
  nombre: string;
  categoria: CategoriaGasto;
}

const PRE_CONCEPTOS: PreConcepto[] = [
  // Compras e insumos
  { nombre: 'compra de carne de res', categoria: 'insumos' },
  { nombre: 'compra de pechuga de pollo', categoria: 'insumos' },
  { nombre: 'compra de lomo y chuleta de cerdo', categoria: 'insumos' },
  { nombre: 'costillas de cerdo y res para sopa', categoria: 'insumos' },
  { nombre: 'compra de jarrete grueso', categoria: 'insumos' },
  { nombre: 'acompañamientos (yuca, papa, bollo, plátano)', categoria: 'insumos' },
  { nombre: 'verduras y hortalizas (ensalada)', categoria: 'insumos' },
  { nombre: 'salsas de la casa, condimentos y aceite', categoria: 'insumos' },
  { nombre: 'granos, legumbres y pastas', categoria: 'insumos' },
  { nombre: 'empaques desechables térmicos y secos', categoria: 'insumos' },
  { nombre: 'cubiertos desechables y bolsas de domicilio', categoria: 'insumos' },

  // Servicios públicos y conectividad
  { nombre: 'energía eléctrica (luz)', categoria: 'servicios' },
  { nombre: 'servicio de gas cocina', categoria: 'servicios' },
  { nombre: 'acueducto y agua potable', categoria: 'servicios' },
  { nombre: 'internet y conectividad', categoria: 'servicios' },

  // Seguridad
  { nombre: 'servicio de vigilancia', categoria: 'seguridad' },
  { nombre: 'monitoreo y alarmas', categoria: 'seguridad' },

  // Otros gastos operativos
  { nombre: 'aseo, limpieza y desinfección', categoria: 'otros' },
  { nombre: 'mantenimiento de estufas y equipos', categoria: 'otros' },
  { nombre: 'transporte y fletes de insumos', categoria: 'otros' },
  { nombre: 'gastos operativos varios', categoria: 'otros' },
];

const PRE_MONTOS = [
  { label: '$20.000', valor: 20000 },
  { label: '$45.000', valor: 45000 },
  { label: '$80.000', valor: 80000 },
  { label: '$100.000', valor: 100000 },
  { label: '$150.000', valor: 150000 },
  { label: '$200.000', valor: 200000 },
  { label: '$350.000', valor: 350000 },
  { label: '$500.000', valor: 500000 },
];

const PRE_PERIODOS = [
  'Noviembre 2026',
  'Primera Quincena Noviembre',
  'Segunda Quincena Noviembre',
  'Semana en curso',
];

const CATEGORIAS_CONFIG: { id: CategoriaGasto; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'insumos', label: 'Compras e Insumos', desc: 'Carnes, pollo, verduras, desechables y empaques', icon: ShoppingBag },
  { id: 'servicios', label: 'Servicios y Red', desc: 'Luz, gas cocina, agua e internet', icon: Zap },
  { id: 'seguridad', label: 'Seguridad', desc: 'Servicio de vigilancia', icon: Shield },
  { id: 'otros', label: 'Otros Gastos Operativos', desc: 'Aseo, mantenimiento y transporte', icon: Layers },
];

export const GastosTab: React.FC = () => {
  const { gastos, executeExpense, updateExpenseStatus, showNotification } = useData();
  const { paletteConfig } = useTheme();

  const [categoria, setCategoria] = useState<CategoriaGasto>('insumos');
  const [concepto, setConcepto] = useState<string>('compra de carne de res');
  const [valor, setValor] = useState<string>('120000');
  const [periodo, setPeriodo] = useState<string>('Noviembre 2026');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [responsable, setResponsable] = useState<string>('Administrador');
  const [estadoGasto, setEstadoGasto] = useState<EstadoGasto>('pagado');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter for history: All, Paid, Pending
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pagado' | 'pendiente'>('todos');

  // Pre-listed concepts for current selected category
  const conceptosPrelistados = useMemo(() => {
    return PRE_CONCEPTOS.filter((c) => c.categoria === categoria);
  }, [categoria]);

  const handleSelectCategoria = (catId: CategoriaGasto) => {
    setCategoria(catId);
    const firstConcept = PRE_CONCEPTOS.find((c) => c.categoria === catId);
    if (firstConcept) {
      setConcepto(firstConcept.nombre);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanConcepto = concepto.trim();
    const numValor = parseFloat(valor);

    if (!cleanConcepto) {
      showNotification({ ok: false, mensaje: 'Por favor selecciona o ingresa un concepto de gasto' });
      return;
    }
    if (isNaN(numValor) || numValor <= 0) {
      showNotification({ ok: false, mensaje: 'Ingresa un valor monetario válido mayor a cero' });
      return;
    }

    setIsSubmitting(true);
    const opId = generateOperationId('GST');

    try {
      const res = await executeExpense({
        p_id: opId,
        p_concepto: cleanConcepto,
        p_categoria: categoria,
        p_valor: numValor,
        periodo: periodo.trim() || 'Noviembre 2026',
        metodo_pago: metodoPago,
        responsable: responsable.trim() || 'Administrador',
        estado: estadoGasto,
      });

      showNotification(res);

      if (res.ok) {
        setValor('');
      }
    } catch (err: unknown) {
      showNotification({
        ok: false,
        mensaje: err instanceof Error ? err.message : 'Error al registrar el egreso',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const gastosFiltrados = useMemo(() => {
    if (filtroEstado === 'todos') return gastos.slice(0, 30);
    return gastos.filter((g) => (g.estado || 'pagado') === filtroEstado).slice(0, 30);
  }, [gastos, filtroEstado]);

  const totalPendiente = useMemo(() => {
    return gastos
      .filter((g) => g.estado === 'pendiente')
      .reduce((acc, curr) => acc + (curr.valor || 0), 0);
  }, [gastos]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-6 pb-20 sm:pb-8">
      {/* Top Banner Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 sm:p-6 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] text-[10px] font-bold mb-1">
                <Sparkles className="w-3 h-3" />
                <span>Control de Gastos Operativos</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--text-main)]">
                Registro y Control de Gastos Operativos
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Compras e insumos, servicios públicos, vigilancia, aseo, mantenimiento y transporte según la caracterización oficial.
              </p>
            </div>
          </div>

          {totalPendiente > 0 && (
            <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 shrink-0">
              <AlertCircle className="w-4 h-4" />
              <span>Por pagar: {formatCOP(totalPendiente)}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Categoría de Gasto */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
              1. Categoría de gasto operativo:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {CATEGORIAS_CONFIG.map((cat) => {
                const isSelected = categoria === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategoria(cat.id)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                        : 'bg-[var(--bg-main)] border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--brand-accent)]/40'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">{cat.label}</div>
                      <div className={`text-[10px] font-normal mt-0.5 truncate max-w-[140px] ${isSelected ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                        {cat.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pre-lista de Conceptos Específicos (Sin Emojis) */}
          <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-main)]">
                2. Conceptos identificados ({CATEGORIAS_CONFIG.find((c) => c.id === categoria)?.label}):
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">
                Selección rápida en 1 clic
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {conceptosPrelistados.map((item) => {
                const isSelected = concepto.toLowerCase().trim() === item.nombre.toLowerCase().trim();
                return (
                  <button
                    key={item.nombre}
                    type="button"
                    onClick={() => setConcepto(item.nombre)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[var(--brand-accent)]/15 border-[var(--brand-accent)] text-[var(--brand-accent)] font-bold shadow-xs ring-1 ring-[var(--brand-accent)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-soft)] text-[var(--text-main)] hover:border-[var(--brand-accent)]/50'
                    }`}
                  >
                    <span className="truncate">
                      {capitalizeFirst(item.nombre)}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <span className="text-[11px] text-[var(--text-muted)] block mb-1">
                O escribe un concepto personalizado si no aparece en la lista:
              </span>
              <input
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(normalizeUserInput(e.target.value))}
                placeholder="Escribe el concepto..."
                className="w-full h-10 px-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-main)] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
              />
            </div>
          </div>

          {/* 3. Valor del Gasto */}
          <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-main)]">
                3. Valor monetario del gasto:
              </label>
              {valor && parseFloat(valor) > 0 && (
                <span className="text-sm font-extrabold text-[var(--brand-accent)] font-mono">
                  {formatCOP(parseFloat(valor))}
                </span>
              )}
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {PRE_MONTOS.map((monto) => {
                const isSelected = valor === String(monto.valor);
                return (
                  <button
                    key={monto.valor}
                    type="button"
                    onClick={() => setValor(String(monto.valor))}
                    className={`h-9 px-3 rounded-xl border text-xs font-bold font-mono transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                        : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                    }`}
                  >
                    {monto.label}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-2">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold text-sm">
                $
              </span>
              <input
                type="number"
                min="1"
                step="100"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="O escribe el monto exacto en pesos..."
                className="w-full h-11 pl-8 pr-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-main)] text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
                required
              />
            </div>
          </div>

          {/* 4. Periodo, Responsable, Método de Pago y Estado */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Periodo */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                Periodo aplicable:
              </label>
              <div className="flex flex-wrap gap-1">
                {PRE_PERIODOS.map((per) => (
                  <button
                    key={per}
                    type="button"
                    onClick={() => setPeriodo(per)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      periodo === per
                        ? 'bg-[var(--brand-accent)] text-white border-transparent'
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-soft)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {per}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="Periodo..."
                className="w-full h-8 px-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] text-xs text-[var(--text-main)] focus:outline-none"
              />
            </div>

            {/* Responsable del registro (exigido por el documento) */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                Responsable del registro:
              </label>
              <div className="flex flex-wrap gap-1">
                {['Administrador', 'Cajero', 'Encargado'].map((resp) => (
                  <button
                    key={resp}
                    type="button"
                    onClick={() => setResponsable(resp)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      responsable === resp
                        ? 'bg-[var(--brand-accent)] text-white border-transparent'
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-soft)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {resp}
                  </button>
                ))}
              </div>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                  placeholder="Nombre de quien registra..."
                  className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] text-xs text-[var(--text-main)] focus:outline-none"
                />
              </div>
            </div>

            {/* Método de Pago */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                Método de pago:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'efectivo', label: 'Efectivo' },
                  { id: 'nequi', label: 'Nequi / Transf.' },
                  { id: 'tarjeta', label: 'Tarjeta' },
                  { id: 'credito', label: 'Crédito Prov.' },
                ].map((met) => (
                  <button
                    key={met.id}
                    type="button"
                    onClick={() => setMetodoPago(met.id as MetodoPago)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      metodoPago === met.id
                        ? 'bg-[var(--brand-accent)] text-white border-transparent shadow-xs'
                        : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                    }`}
                  >
                    {met.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estado del Gasto */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-soft)] space-y-2">
              <label className="block text-xs font-bold text-[var(--text-main)]">
                Estado del egreso:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setEstadoGasto('pagado')}
                  className={`py-3 px-2 rounded-xl text-xs font-bold border transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    estadoGasto === 'pagado'
                      ? 'bg-emerald-600 text-white border-transparent shadow-xs'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-soft)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pagado</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoGasto('pendiente')}
                  className={`py-3 px-2 rounded-xl text-xs font-bold border transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    estadoGasto === 'pendiente'
                      ? 'bg-amber-600 text-white border-transparent shadow-xs'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-soft)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Pendiente</span>
                </button>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !concepto.trim() || !valor}
            style={{ backgroundColor: paletteConfig.accent }}
            className="w-full h-13 rounded-xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registrando egreso...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                <span>Registrar Gasto Operativo · {formatCOP(parseFloat(valor) || 0)}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Expenses History List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--brand-accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Historial y Auditoría de Egresos Operativos
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-soft)] text-xs">
            <button
              type="button"
              onClick={() => setFiltroEstado('todos')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filtroEstado === 'todos'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Todos ({gastos.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado('pagado')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filtroEstado === 'pagado'
                  ? 'bg-emerald-600 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Pagados
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado('pendiente')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filtroEstado === 'pendiente'
                  ? 'bg-amber-600 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Pendientes
            </button>
          </div>
        </div>

        {gastosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-xs">
            No hay gastos que coincidan con el filtro seleccionado.
          </div>
        ) : (
          <motion.div
            variants={fastStaggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-[var(--border-soft)] border border-[var(--border-soft)] rounded-xl overflow-hidden"
          >
            {gastosFiltrados.map((gasto) => {
              const isPendiente = gasto.estado === 'pendiente';
              return (
                <motion.div
                  key={gasto.id_operacion}
                  variants={tableRowVariants}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors gap-3"
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-main)] truncate">
                        {capitalizeFirst(gasto.concepto)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isPendiente
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {isPendiente ? 'Pendiente' : 'Pagado'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border-soft)] capitalize">
                        {gasto.categoria}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)] mt-1">
                      <span>Periodo: <strong>{gasto.periodo || 'Mes actual'}</strong></span>
                      <span>·</span>
                      <span className="capitalize">Método: <strong>{gasto.metodo_pago || 'efectivo'}</strong></span>
                      {gasto.responsable && (
                        <>
                          <span>·</span>
                          <span>Resp: <strong>{gasto.responsable}</strong></span>
                        </>
                      )}
                      <span>·</span>
                      <span className="font-mono text-[10px]">{gasto.id_operacion}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {isPendiente && (
                      <button
                        type="button"
                        onClick={() => updateExpenseStatus(gasto.id_operacion, 'pagado')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                        title="Marcar gasto como pagado"
                      >
                        Marcar Pagado
                      </button>
                    )}

                    <div className="text-right">
                      <div className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                        -{formatCOP(gasto.valor)}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {formatBogotaDateTime(gasto.created_at || gasto.fecha)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
