/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  formatCOP,
  formatBogotaDateTime,
  capitalizeFirst,
  generateOperationId,
  normalizeUserInput,
} from '../utils/formatters.ts';
import { CategoriaGasto } from '../types.ts';
import {
  Receipt,
  PlusCircle,
  Clock,
  Sparkles,
  ShoppingBag,
  Zap,
  Users,
  Layers,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  fastStaggerContainerVariants,
  cardItemVariants,
  tableRowVariants,
} from '../utils/animations.ts';

const CATEGORIAS: { id: CategoriaGasto; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ingredientes', label: 'Ingredientes', icon: ShoppingBag },
  { id: 'servicios', label: 'Servicios', icon: Zap },
  { id: 'nomina', label: 'Nómina', icon: Users },
  { id: 'otros', label: 'Otros Gastos', icon: Layers },
];

export const GastosTab: React.FC = () => {
  const { gastos, conceptosGasto, executeExpense, showNotification } = useData();
  const { paletteConfig } = useTheme();

  const [categoria, setCategoria] = useState<CategoriaGasto>('ingredientes');
  const [concepto, setConcepto] = useState<string>('');
  const [valor, setValor] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const conceptosFiltrados = conceptosGasto
    .filter((c) => c.categoria === categoria)
    .map((c) => c.nombre);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanConcepto = concepto.trim();
    const numValor = parseFloat(valor);

    if (!cleanConcepto) {
      showNotification({ ok: false, mensaje: 'Por favor ingresa un concepto de gasto' });
      return;
    }
    if (isNaN(numValor) || numValor <= 0) {
      showNotification({ ok: false, mensaje: 'Ingresa un valor monetario válido mayor a cero' });
      return;
    }

    setIsSubmitting(true);
    const opId = generateOperationId('G');

    try {
      const res = await executeExpense({
        p_id: opId,
        p_concepto: cleanConcepto,
        p_categoria: categoria,
        p_valor: numValor,
      });

      showNotification(res);

      if (res.ok) {
        setConcepto('');
        setValor('');
      }
    } catch (err: unknown) {
      showNotification({
        ok: false,
        mensaje: err instanceof Error ? err.message : 'Error al registrar gasto',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ultimosGastos = gastos.slice(0, 20);

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-xs"
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="p-2 rounded-xl"
            style={{ backgroundColor: `${paletteConfig.primaryHex}15`, color: paletteConfig.primaryHex }}
          >
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">
              Registrar Gasto Operativo
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Registra compras de materia prima, servicios públicos, nómina o gastos generales.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Chips */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              Categoría del egreso:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIAS.map((cat) => {
                const isSelected = categoria === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoria(cat.id);
                      setConcepto('');
                    }}
                    style={{
                      borderColor: isSelected ? paletteConfig.primaryHex : undefined,
                      backgroundColor: isSelected ? `${paletteConfig.primaryHex}15` : undefined,
                      color: isSelected ? paletteConfig.primaryHex : undefined,
                    }}
                    className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Concept Tags */}
          {conceptosFiltrados.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
                Sugerencias frecuentes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {conceptosFiltrados.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setConcepto(capitalizeFirst(item))}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                  >
                    {capitalizeFirst(item)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Concept Input */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Concepto o descripción:
            </label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(normalizeUserInput(e.target.value))}
              placeholder="Ej. Compra de lomo y cortes de res..."
              className="w-full h-11 px-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              required
            />
          </div>

          {/* Value Input */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Valor del gasto (COP):
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                $
              </span>
              <input
                type="number"
                min="1"
                step="100"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
                className="w-full h-11 pl-8 pr-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !concepto.trim() || !valor}
            style={{ backgroundColor: paletteConfig.primaryHex }}
            className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registrando egreso...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Registrar Gasto</span>
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
        className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Historial de gastos recientes
            </h3>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {ultimosGastos.length} registrados
          </span>
        </div>

        {ultimosGastos.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No hay gastos registrados en el historial.
          </div>
        ) : (
          <motion.div
            variants={fastStaggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden"
          >
            {ultimosGastos.map((gasto) => (
              <motion.div
                key={gasto.id_operacion}
                variants={tableRowVariants}
                className="flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors"
              >
                <div className="flex flex-col min-w-0 pr-3">
                  <span className="text-sm font-bold text-stone-900 dark:text-white truncate">
                    {capitalizeFirst(gasto.concepto)}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    <span className="capitalize font-semibold text-stone-600 dark:text-stone-300">
                      {gasto.categoria}
                    </span>
                    <span>·</span>
                    <span className="font-mono text-[10px] text-stone-400">
                      {gasto.id_operacion}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                    -{formatCOP(gasto.valor)}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {formatBogotaDateTime(gasto.created_at || gasto.fecha)}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
