/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  formatStock,
  formatBogotaDateTime,
  capitalizeFirst,
  normalizeUserInput,
} from '../utils/formatters.ts';
import { RESTAURANT_IMAGES } from '../assets/images.ts';
import { Ingrediente, UnidadMedida } from '../types.ts';
import {
  Boxes,
  Plus,
  AlertTriangle,
  CheckCircle2,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  X,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  fastStaggerContainerVariants,
  tableRowVariants,
} from '../utils/animations.ts';

export const InventarioTab: React.FC = () => {
  const {
    ingredientes,
    movimientos,
    executeAdjustStock,
    executeCreateIngredient,
    showNotification,
  } = useData();
  const { paletteConfig } = useTheme();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingrediente | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('Compra o reposición');
  const [adjustType, setAdjustType] = useState<'sumar' | 'restar'>('sumar');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  // New ingredient modal
  const [newIngredientModalOpen, setNewIngredientModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newUnit, setNewUnit] = useState<UnidadMedida>('g');
  const [newStock, setNewStock] = useState<string>('0');
  const [newMinimo, setNewMinimo] = useState<string>('0');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const filteredIngredientes = ingredientes.filter((i) =>
    i.ingrediente.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const handleOpenAdjust = (ing: Ingrediente) => {
    setSelectedIngredient(ing);
    setAdjustAmount('');
    setAdjustType('sumar');
    setAdjustReason('Compra o reposición');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;

    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotification({ ok: false, mensaje: 'Ingresa una cantidad válida mayor a cero' });
      return;
    }

    const delta = adjustType === 'sumar' ? amount : -amount;
    setIsAdjusting(true);

    try {
      const res = await executeAdjustStock({
        p_ingrediente: selectedIngredient.ingrediente,
        p_delta: delta,
        p_motivo: adjustReason,
      });

      showNotification(res);
      if (res.ok) {
        setAdjustModalOpen(false);
      }
    } catch (err: unknown) {
      showNotification({
        ok: false,
        mensaje: err instanceof Error ? err.message : 'Error al ajustar inventario',
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const stockNum = parseFloat(newStock) || 0;
    const minNum = parseFloat(newMinimo) || 0;

    if (!name) {
      showNotification({ ok: false, mensaje: 'El nombre del ingrediente es obligatorio' });
      return;
    }

    setIsCreating(true);

    try {
      const res = await executeCreateIngredient({
        p_nombre: name.toLowerCase(),
        p_unidad: newUnit,
        p_stock: stockNum,
        p_minimo: minNum,
      });

      showNotification(res);
      if (res.ok) {
        setNewIngredientModalOpen(false);
        setNewName('');
        setNewStock('0');
        setNewMinimo('0');
      }
    } catch (err: unknown) {
      showNotification({
        ok: false,
        mensaje: err instanceof Error ? err.message : 'Error al crear ingrediente',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="md:col-span-2 bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mb-2"
              style={{ backgroundColor: `${paletteConfig.primaryHex}15`, color: paletteConfig.primaryHex }}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Gestión de Bodega y Despensa</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-white tracking-tight">
              Control de Inventario e Insumos
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              Monitorea existencias en gramos, kilogramos, libras o unidades. Ajusta mermas, compras o conteos con trazabilidad completa.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {ingredientes.length} materias primas registradas
            </span>
            <button
              onClick={() => setNewIngredientModalOpen(true)}
              style={{ backgroundColor: paletteConfig.primaryHex }}
              className="px-3.5 py-2 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-transform active:scale-[0.99] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Ingrediente</span>
            </button>
          </div>
        </div>

        {/* Pantry Image */}
        <div className="relative rounded-2xl overflow-hidden h-40 md:h-auto border border-stone-200 dark:border-stone-800 shadow-xs">
          <img
            src={RESTAURANT_IMAGES.freshPantry}
            alt="Despensa de Ingredientes"
            className="w-full h-full object-cover object-center filter dark:brightness-90"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4 text-white">
            <span className="text-xs font-bold drop-shadow-xs">Cadena de Frío e Insumos</span>
          </div>
        </div>
      </motion.div>

      {/* Inventory Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Stock de Insumos en Bodega
            </h3>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar ingrediente..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-bold">
                <th className="pb-2.5">Ingrediente</th>
                <th className="pb-2.5">Stock Actual</th>
                <th className="pb-2.5">Stock Mínimo</th>
                <th className="pb-2.5">Estado</th>
                <th className="pb-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <motion.tbody
              variants={fastStaggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-stone-100 dark:divide-stone-800"
            >
              {filteredIngredientes.map((ing) => {
                const isLow = ing.stock <= ing.stock_minimo;
                return (
                  <motion.tr
                    key={ing.ingrediente}
                    variants={tableRowVariants}
                    className="hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors"
                  >
                    <td className="py-3 font-semibold text-stone-900 dark:text-white">
                      {capitalizeFirst(ing.ingrediente)}
                    </td>
                    <td className="py-3 font-mono font-bold text-stone-800 dark:text-stone-200">
                      {formatStock(ing.stock, ing.unidad)}
                    </td>
                    <td className="py-3 text-stone-500 dark:text-stone-400 font-mono">
                      {formatStock(ing.stock_minimo, ing.unidad)}
                    </td>
                    <td className="py-3">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444]/15 text-[#EF4444]">
                          <AlertTriangle className="w-3 h-3" />
                          Bajo mínimo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                          <CheckCircle2 className="w-3 h-3" />
                          Óptimo
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleOpenAdjust(ing)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
                      >
                        Ajustar
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      </motion.div>

      {/* Movement History Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14 }}
        className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Historial de movimientos de bodega
            </h3>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            Últimos {movimientos.length} registros
          </span>
        </div>

        {movimientos.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No se han registrado movimientos de inventario todavía.
          </div>
        ) : (
          <motion.div
            variants={fastStaggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden"
          >
            {movimientos.map((mov) => {
              const isPositive = mov.delta > 0;
              return (
                <motion.div
                  key={mov.id}
                  variants={tableRowVariants}
                  className="flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isPositive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-stone-900 dark:text-white">
                        {capitalizeFirst(mov.ingrediente)}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        {mov.motivo}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono text-sm font-bold tabular-nums ${
                        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? `+${mov.delta}` : mov.delta}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      {formatBogotaDateTime(mov.created_at)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>

      {/* Adjust Modal */}
      <AnimatePresence>
        {adjustModalOpen && selectedIngredient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  Ajustar Inventario: {capitalizeFirst(selectedIngredient.ingrediente)}
                </h3>
                <button
                  onClick={() => setAdjustModalOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAdjustment} className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('sumar')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                      adjustType === 'sumar'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    + Sumar (Entrada / Compra)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('restar')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                      adjustType === 'restar'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    - Restar (Merma / Ajuste)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Cantidad ({selectedIngredient.unidad}):
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm font-mono font-bold text-stone-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Motivo o razón del ajuste:
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ej. Merma de cocina, compra de emergencia..."
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isAdjusting || !adjustAmount}
                    style={{ backgroundColor: paletteConfig.primaryHex }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isAdjusting ? 'Guardando...' : 'Aplicar Ajuste'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Ingredient Modal */}
      <AnimatePresence>
        {newIngredientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  Registrar Nuevo Ingrediente
                </h3>
                <button
                  onClick={() => setNewIngredientModalOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateIngredient} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nombre del insumo:
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(normalizeUserInput(e.target.value))}
                    placeholder="Ej. Crema agria, queso costeño..."
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Unidad de medida:
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as UnidadMedida)}
                    className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-white focus:outline-none"
                  >
                    <option value="g">Gramos (g)</option>
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="lb">Libras (lb)</option>
                    <option value="unidad">Unidades (unidad)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Stock inicial:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm font-mono font-bold text-stone-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Stock mínimo:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newMinimo}
                      onChange={(e) => setNewMinimo(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-sm font-mono font-bold text-stone-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setNewIngredientModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newName.trim()}
                    style={{ backgroundColor: paletteConfig.primaryHex }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isCreating ? 'Creando...' : 'Crear Insumo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
