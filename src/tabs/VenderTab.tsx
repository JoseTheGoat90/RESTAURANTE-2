/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useData } from '../context/DataContext.tsx';
import {
  formatCOP,
  formatBogotaDateTime,
  capitalizeFirst,
  generateOperationId,
  formatStock,
} from '../utils/formatters.ts';
import { RESTAURANT_IMAGES } from '../assets/images.ts';
import {
  staggerContainerVariants,
  cardItemVariants,
  fastStaggerContainerVariants,
  tableRowVariants,
  listItemVariants,
} from '../utils/animations.ts';
import {
  UtensilsCrossed,
  Plus,
  Minus,
  Loader2,
  Clock,
  Boxes,
  ArrowRight,
  Check,
} from 'lucide-react';

export const VenderTab: React.FC = () => {
  const { recetas, ventas, ingredientes, executeSale, showNotification } = useData();

  // Extract unique dishes with their price
  const uniquePlatos = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of recetas) {
      if (r.plato && !map.has(r.plato)) {
        map.set(r.plato, r.precio ?? 0);
      }
    }
    return Array.from(map.entries())
      .map(([plato, precio]) => ({ plato, precio }))
      .sort((a, b) => a.plato.localeCompare(b.plato));
  }, [recetas]);

  const [selectedPlato, setSelectedPlato] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedPlato && uniquePlatos.length > 0) {
      setSelectedPlato(uniquePlatos[0].plato);
    }
  }, [uniquePlatos, selectedPlato]);

  const currentDish = uniquePlatos.find((p) => p.plato === selectedPlato);
  const unitPrice = currentDish ? currentDish.precio : 0;
  const totalPrice = unitPrice * cantidad;

  // Recipe ingredients for the selected dish & real-time inventory deduction impact
  const recipeImpact = useMemo(() => {
    if (!selectedPlato) return [];
    const dishRecipes = recetas.filter((r) => r.plato === selectedPlato);

    return dishRecipes.map((r) => {
      const ing = ingredientes.find(
        (i) => i.ingrediente.toLowerCase() === r.ingrediente.toLowerCase()
      );
      const neededTotal = r.cantidad * cantidad;
      const currentStock = ing ? ing.stock : 0;
      const stockMinimo = ing ? ing.stock_minimo : 0;
      const unit = ing ? ing.unidad : 'g';
      const remainingStock = currentStock - neededTotal;
      const isCritical = remainingStock <= stockMinimo;
      const isDeficit = remainingStock < 0;

      return {
        ingrediente: r.ingrediente,
        cantidadPorPorcion: r.cantidad,
        cantidadTotal: neededTotal,
        stockActual: currentStock,
        stockMinimo,
        unidad: unit,
        stockRestante: remainingStock,
        isCritical,
        isDeficit,
      };
    });
  }, [selectedPlato, cantidad, recetas, ingredientes]);

  const handleRegisterSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!selectedPlato) {
      setFormError('Por favor selecciona un plato');
      return;
    }
    if (cantidad <= 0) {
      setFormError('La cantidad debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);
    const opId = generateOperationId('V');

    try {
      const result = await executeSale({
        p_id: opId,
        p_plato: selectedPlato,
        p_cantidad: cantidad,
      });

      showNotification(result);

      if (result.ok) {
        setCantidad(1);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la venta';
      showNotification({ ok: false, mensaje: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ultimasVentas = useMemo(() => {
    return ventas.slice(0, 10);
  }, [ventas]);

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Title & Banner Grid */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Title Card */}
        <div className="md:col-span-2 bg-white/95 dark:bg-stone-900/95 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-2">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Despacho y Facturación en Sala</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-white tracking-tight">
              Registrar Venta de Platillos
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              Elige el plato y la cantidad. El stock de cada ingrediente se deduce en tiempo real según la receta culinaria asociada.
            </p>
          </div>

          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center gap-4 text-xs text-stone-600 dark:text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Recetas activas: <strong>{uniquePlatos.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Insumos vinculados: <strong>{ingredientes.length}</strong>
            </span>
          </div>
        </div>

        {/* Featured Dish Visual Card */}
        <div className="relative rounded-2xl overflow-hidden border border-stone-800 min-h-[160px] shadow-sm group">
          <img
            src={RESTAURANT_IMAGES.gourmetDish}
            alt="Plato gourmet destacado"
            className="w-full h-full object-cover object-center filter brightness-95 group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-stone-950/70 px-2 py-0.5 rounded backdrop-blur-xs">
              Especialidad
            </span>
            <div className="text-xs font-bold text-white mt-1 truncate">
              {currentDish ? capitalizeFirst(currentDish.plato) : 'Platillo Gourmet'}
            </div>
            <div className="text-sm font-extrabold text-amber-400 font-mono">
              {formatCOP(unitPrice)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sale Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="bg-white/95 dark:bg-stone-900/95 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 shadow-xs"
      >
        <form onSubmit={handleRegisterSale} className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {formError}
            </div>
          )}

          {/* Dish Selector: STAGGERED ENTRANCE */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
              Plato a despachar
            </label>
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
            >
              {uniquePlatos.map((p) => {
                const isSelected = selectedPlato === p.plato;
                return (
                  <motion.button
                    key={p.plato}
                    variants={cardItemVariants}
                    whileHover={{ scale: 1.015, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setSelectedPlato(p.plato)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500 text-stone-950 dark:text-white shadow-xs'
                        : 'bg-stone-50/70 dark:bg-stone-800/50 border-stone-200/80 dark:border-stone-700/80 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-bold truncate">
                        {capitalizeFirst(p.plato)}
                      </span>
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-2 tabular-nums">
                      {formatCOP(p.precio)}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* Quantity Stepper & Total Preview */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
              Número de porciones
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="inline-flex items-center rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCantidad((prev) => Math.max(1, prev - 1))}
                  disabled={cantidad <= 1 || isSubmitting}
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors cursor-pointer"
                  aria-label="Disminuir cantidad"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isSubmitting}
                  className="w-20 h-11 text-center font-bold text-lg text-stone-900 dark:text-white bg-transparent border-0 focus:outline-none font-mono tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setCantidad((prev) => prev + 1)}
                  disabled={isSubmitting}
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors cursor-pointer"
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Total Summary */}
              <div className="flex-1 p-3 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Total de la orden:
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                  {formatCOP(totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* REAL-TIME INVENTORY IMPACT PREVIEW */}
          {recipeImpact.length > 0 && (
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800 dark:text-stone-200">
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-amber-500" />
                  <span>Deducción en inventario ({cantidad}x {capitalizeFirst(selectedPlato)})</span>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  {recipeImpact.length} ingredientes en receta
                </span>
              </div>

              <motion.div
                variants={fastStaggerContainerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-stone-200/70 dark:divide-stone-700/70 text-xs"
              >
                {recipeImpact.map((item) => (
                  <motion.div
                    key={item.ingrediente}
                    variants={listItemVariants}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-stone-900 dark:text-white truncate">
                        {capitalizeFirst(item.ingrediente)}
                      </span>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">
                        (-{formatStock(item.cantidadTotal, item.unidad)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <span className="text-[11px] text-stone-400">
                        Actual: {formatStock(item.stockActual, item.unidad)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-stone-400" />
                      <span
                        className={`font-mono font-bold text-xs tabular-nums ${
                          item.isDeficit
                            ? 'text-rose-600 dark:text-rose-400'
                            : item.isCritical
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        Quedarán: {formatStock(item.stockRestante, item.unidad)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* HIGH-CONTRAST ACTION BUTTONS (MÁXIMA PRISA / RUSH HOUR UX) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Botón 1: Cobro Rápido (Verde Vivo #10B981 / Emerald) */}
            <button
              type="button"
              disabled={isSubmitting || !selectedPlato}
              onClick={() => handleRegisterSale()}
              className="h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-2 border-emerald-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Procesando cobro...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>Cobro Rápido · {formatCOP(totalPrice)}</span>
                </>
              )}
            </button>

            {/* Botón 2: Enviar a Cocina (Azul Operativo #2563EB / Royal Blue) */}
            <button
              type="button"
              disabled={isSubmitting || !selectedPlato}
              onClick={() => handleRegisterSale()}
              className="h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-2 border-blue-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Enviando a cocina...</span>
                </>
              ) : (
                <>
                  <UtensilsCrossed className="w-5 h-5 stroke-[2.5]" />
                  <span>Enviar a Cocina (Comanda)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Last 10 Sales List: STAGGERED ROW ENTRANCE WITH SEMÁFORO STATUS */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-gray-200 dark:border-zinc-800 p-5 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Últimas 10 comandas y ventas del restaurante
            </h3>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {ultimasVentas.length} registradas
          </span>
        </div>

        {ultimasVentas.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            Aún no se han registrado ventas hoy.
          </div>
        ) : (
          <motion.div
            variants={fastStaggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden"
          >
            {ultimasVentas.map((venta, idx) => {
              // Intuitive status semáforo simulation based on recency
              const status =
                idx === 0
                  ? { label: 'En preparación', bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' }
                  : idx === 1
                  ? { label: 'Listo para servir', bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' }
                  : { label: 'Pagado / Cerrado', bg: 'bg-stone-500/15 text-stone-600 dark:text-stone-400 border-stone-500/30' };

              return (
                <motion.div
                  key={venta.id_operacion}
                  variants={tableRowVariants}
                  className="flex items-center justify-between p-3.5 hover:bg-gray-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-main)] truncate">
                        {capitalizeFirst(venta.plato)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.bg}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      <span>{venta.cantidad} {venta.cantidad === 1 ? 'porción' : 'porciones'}</span>
                      <span>·</span>
                      <span className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
                        {venta.id_operacion}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                      +{formatCOP(venta.total)}
                    </div>
                    <div className="text-[10px] text-stone-400 dark:text-stone-500">
                      {formatBogotaDateTime(venta.created_at || venta.fecha)}
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
