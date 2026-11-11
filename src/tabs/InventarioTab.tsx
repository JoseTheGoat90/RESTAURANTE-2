/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  formatStock,
  formatBogotaDateTime,
  capitalizeFirst,
  normalizeUserInput,
} from '../utils/formatters.ts';
import { RESTAURANT_IMAGES } from '../assets/images.ts';
import { Ingrediente, UnidadMedida, TipoInsumo } from '../types.ts';
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
  PackageX,
  Layers,
  Utensils,
  Sparkles,
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
    porciones,
    movimientosPorciones,
    registrarPorciones,
    registrarCompra,
    reportarFaltante,
    cerrarPeriodoPorciones,
  } = useData();
  const { puede } = useAuth();
  const esAdmin = puede('editar_inventario');
  // Compra (solo al sumar): si se indica el valor, se registra como compra con su gasto
  const [compraValor, setCompraValor] = useState<string>('');
  const [compraProveedor, setCompraProveedor] = useState<string>('');
  const { paletteConfig } = useTheme();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos');

  // Adjust stock modal
  const [selectedIngredient, setSelectedIngredient] = useState<Ingrediente | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('Compra o reposición');
  const [adjustType, setAdjustType] = useState<'sumar' | 'restar'>('sumar');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  // Quick Damage/Loss Modal ("Reportar faltantes, daños o productos agotados")
  const [damageModalOpen, setDamageModalOpen] = useState<boolean>(false);
  const [damageIngredient, setDamageIngredient] = useState<string>('');
  const [damageAmount, setDamageAmount] = useState<string>('');
  const [damageReason, setDamageReason] = useState<string>('Alimento averiado o dañado');
  const [isReportingDamage, setIsReportingDamage] = useState<boolean>(false);

  // New ingredient modal
  const [newIngredientModalOpen, setNewIngredientModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newUnit, setNewUnit] = useState<UnidadMedida>('lb');
  const [newCategory, setNewCategory] = useState<TipoInsumo>('carnes_proteinas');
  const [newStock, setNewStock] = useState<string>('0');
  const [newMinimo, setNewMinimo] = useState<string>('0');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const filteredIngredientes = useMemo(() => {
    return ingredientes.filter((i) => {
      const matchSearch = i.ingrediente.toLowerCase().includes(searchTerm.toLowerCase().trim());
      if (!matchSearch) return false;

      if (categoriaFiltro === 'todos') return true;
      if (categoriaFiltro === 'carnes_proteinas') return i.tipo_insumo === 'carnes_proteinas' || i.tipo_insumo === ('carne' as any);
      if (categoriaFiltro === 'tuberculos_vegetales') return i.tipo_insumo === 'tuberculos_vegetales' || i.tipo_insumo === ('acompanamiento' as any);
      if (categoriaFiltro === 'verduras_hortalizas') return i.tipo_insumo === 'verduras_hortalizas';
      if (categoriaFiltro === 'granos_legumbres') return i.tipo_insumo === 'granos_legumbres';
      if (categoriaFiltro === 'salsas_condimentos') return i.tipo_insumo === 'salsas_condimentos';
      if (categoriaFiltro === 'desechables') return i.tipo_insumo === 'desechables' || i.tipo_insumo === ('desechable' as any);
      if (categoriaFiltro === 'bebidas') return i.tipo_insumo === 'bebidas';
      return true;
    });
  }, [ingredientes, searchTerm, categoriaFiltro]);

  const itemsAgotados = ingredientes.filter((i) => i.stock <= 0).length;
  const itemsBajoMinimo = ingredientes.filter((i) => i.stock > 0 && i.stock <= i.stock_minimo).length;

  const handleOpenAdjust = (ing: Ingrediente) => {
    setSelectedIngredient(ing);
    setAdjustAmount('');
    setAdjustType('sumar');
    setAdjustReason('Compra o reposición');
    setCompraValor('');
    setCompraProveedor('');
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
    const valorCompra = parseFloat(compraValor);
    if (!adjustReason.trim()) {
      showNotification({ ok: false, mensaje: 'El motivo es obligatorio' });
      return;
    }
    setIsAdjusting(true);

    try {
      // Entrada con valor = compra (suma inventario + crea UN gasto enlazado). Sin valor = ajuste.
      const res =
        adjustType === 'sumar' && valorCompra > 0
          ? await registrarCompra({
              p_ingrediente: selectedIngredient.ingrediente,
              p_cantidad: amount,
              p_valor: valorCompra,
              p_proveedor: compraProveedor.trim() || undefined,
            })
          : await executeAdjustStock({
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

  const handleReportDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageIngredient) {
      showNotification({ ok: false, mensaje: 'Selecciona el insumo afectado' });
      return;
    }
    const amount = parseFloat(damageAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotification({ ok: false, mensaje: 'Ingresa la cantidad dañada o faltante mayor a cero' });
      return;
    }

    setIsReportingDamage(true);
    try {
      // Administración descuenta la merma; cocina, parrilla y meseras reportan el faltante a administración
      const res = esAdmin
        ? await executeAdjustStock({
            p_ingrediente: damageIngredient,
            p_delta: -amount,
            p_motivo: `Avería/Daño: ${damageReason}`,
          })
        : await reportarFaltante({
            p_item: damageIngredient,
            p_tipo: damageReason.toLowerCase().includes('faltante') ? 'faltante' : 'dañado',
            p_cantidad: amount,
            p_nota: damageReason,
          });

      showNotification(res);
      if (res.ok) {
        setDamageModalOpen(false);
        setDamageIngredient('');
        setDamageAmount('');
      }
    } catch (err: unknown) {
      showNotification({
        ok: false,
        mensaje: err instanceof Error ? err.message : 'Error al registrar el daño',
      });
    } finally {
      setIsReportingDamage(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const stockNum = parseFloat(newStock) || 0;
    const minNum = parseFloat(newMinimo) || 0;

    if (!name) {
      showNotification({ ok: false, mensaje: 'El nombre del insumo es obligatorio' });
      return;
    }

    setIsCreating(true);

    try {
      const res = await executeCreateIngredient({
        p_nombre: name.toLowerCase(),
        p_unidad: newUnit,
        p_stock: stockNum,
        p_minimo: minNum,
        tipo_insumo: newCategory,
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
        mensaje: err instanceof Error ? err.message : 'Error al crear insumo',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePorciones = async (item: string, tipo: 'existente' | 'entrada' | 'ajuste') => {
    const etiqueta = tipo === 'existente' ? 'Porciones EXISTENTES al iniciar el periodo' : tipo === 'entrada' ? 'Porciones que ENTRAN' : 'Ajuste (+/-) de porciones';
    const valor = window.prompt(`${capitalizeFirst(item)} · ${etiqueta}:`);
    if (valor === null) return;
    const cantidad = parseFloat(valor.replace(',', '.'));
    if (isNaN(cantidad) || (tipo !== 'ajuste' && cantidad < 0) || (tipo === 'entrada' && cantidad === 0)) {
      showNotification({ ok: false, mensaje: 'Cantidad de porciones no válida' });
      return;
    }
    let motivo: string | undefined;
    if (tipo === 'ajuste') {
      motivo = window.prompt('Motivo del ajuste (obligatorio):') || '';
      if (!motivo.trim()) {
        showNotification({ ok: false, mensaje: 'El ajuste necesita un motivo' });
        return;
      }
    }
    showNotification(await registrarPorciones({ p_item: item, p_tipo: tipo, p_cantidad: cantidad, p_motivo: motivo }));
  };

  const handleCerrarPeriodo = async () => {
    if (!window.confirm('¿Cerrar el periodo? El TOTAL de cada producto pasa a ser su EXISTENTE y entradas/ventas vuelven a 0.')) return;
    showNotification(await cerrarPeriodoPorciones());
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
        <div className="md:col-span-2 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mb-2 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]">
              <Boxes className="w-3.5 h-3.5" />
              <span>Inventario, Carnes, Acompañamientos y Desechables</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-main)] tracking-tight">
              Control de Inventario y Suministros
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              Supervisión de carnes principales (lomo, pechuga, res, costillas, jarrete), acompañamientos (bollo, yuca, patacón, papa) y elementos desechables de atención y empaque.
            </p>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[var(--text-muted)]">
                {ingredientes.length} insumos registrados
              </span>
              {itemsAgotados > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                  {itemsAgotados} agotados
                </span>
              )}
              {itemsBajoMinimo > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                  {itemsBajoMinimo} bajo mínimo
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDamageModalOpen(true)}
                className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reportar faltantes, averías o mermas"
              >
                <PackageX className="w-4 h-4" />
                <span>Reportar Daño / Avería</span>
              </button>

              {esAdmin && (
              <button
                type="button"
                onClick={() => setNewIngredientModalOpen(true)}
                style={{ backgroundColor: paletteConfig.accent }}
                className="px-3.5 py-2 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-transform active:scale-[0.99] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Insumo</span>
              </button>
              )}
            </div>
          </div>
        </div>

        {/* Pantry Image */}
        <div className="relative rounded-2xl overflow-hidden h-40 md:h-auto border border-[var(--border-soft)] shadow-xs">
          <img
            src={RESTAURANT_IMAGES.freshPantry}
            alt="Despensa de Ingredientes"
            className="w-full h-full object-cover object-center filter dark:brightness-90"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4 text-white">
            <span className="text-xs font-bold drop-shadow-xs">Cadena de Frío, Acompañamientos y Empaques</span>
          </div>
        </div>
      </motion.div>

      {/* Inventory Table with Category Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-soft)] text-xs">
            <button
              type="button"
              onClick={() => setCategoriaFiltro('todos')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'todos'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Todos ({ingredientes.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoriaFiltro('carnes_proteinas')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'carnes_proteinas'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Carnes y Proteínas
            </button>
            <button
              type="button"
              onClick={() => setCategoriaFiltro('tuberculos_vegetales')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'tuberculos_vegetales'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Tubérculos y Plátanos
            </button>
            <button
              type="button"
              onClick={() => setCategoriaFiltro('verduras_hortalizas')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'verduras_hortalizas'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Verduras y Hortalizas
            </button>
            <button
              type="button"
              onClick={() => setCategoriaFiltro('granos_legumbres')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'granos_legumbres'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Granos y Legumbres
            </button>
            <button
              type="button"
              onClick={() => setCategoriaFiltro('salsas_condimentos')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'salsas_condimentos'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Salsas y Condimentos
            </button>
            <button
              type="button"
              onClick={() => setCategoriaFiltro('desechables')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'desechables'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Desechables y Cubiertos
            </button>
            <button
              type="button"
              onClick={() => setCategoriaFiltro('bebidas')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                categoriaFiltro === 'bebidas'
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Bebidas
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-main)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[var(--text-muted)] font-bold">
                <th className="pb-2.5">Insumo / Materia Prima</th>
                <th className="pb-2.5">Categoría</th>
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
              className="divide-y divide-[var(--border-soft)]"
            >
              {filteredIngredientes.map((ing) => {
                const isAgotado = ing.stock <= 0;
                const isLow = !isAgotado && ing.stock <= ing.stock_minimo;
                return (
                  <motion.tr
                    key={ing.ingrediente}
                    variants={tableRowVariants}
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 font-semibold text-[var(--text-main)]">
                      {capitalizeFirst(ing.ingrediente)}
                    </td>
                    <td className="py-3 text-[var(--text-muted)] capitalize">
                      {ing.tipo_insumo || 'Insumo'}
                    </td>
                    <td className="py-3 font-mono font-bold text-[var(--text-main)]">
                      {formatStock(ing.stock, ing.unidad)}
                    </td>
                    <td className="py-3 text-[var(--text-muted)] font-mono">
                      {formatStock(ing.stock_minimo, ing.unidad)}
                    </td>
                    <td className="py-3">
                      {isAgotado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-3 h-3" />
                          Agotado
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          Bajo mínimo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Óptimo
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {esAdmin && (
                      <button
                        onClick={() => handleOpenAdjust(ing)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--bg-main)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-main)] border border-[var(--border-soft)] transition-colors cursor-pointer"
                      >
                        Ajustar
                      </button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      </motion.div>

      {/* Inventario de porciones: asados y ejecutivos (Total = Existente + Entradas − Ventas) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.11 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[var(--brand-accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Inventario de Asados y Ejecutivos (por porciones)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Total = Existente + Entrada − Ventas</span>
            {esAdmin && (
              <button type="button" onClick={handleCerrarPeriodo} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[var(--bg-main)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-main)] border border-[var(--border-soft)] transition-colors cursor-pointer">
                Cerrar periodo
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[var(--text-muted)] font-bold">
                <th className="pb-2.5">Producto</th>
                <th className="pb-2.5 text-right">Existente</th>
                <th className="pb-2.5 text-right">Entrada</th>
                <th className="pb-2.5 text-right">Ventas</th>
                <th className="pb-2.5 text-right">Total</th>
                <th className="pb-2.5 pl-4">Estado</th>
                {esAdmin && <th className="pb-2.5 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {porciones.map((p) => {
                const agotado = p.total <= 0;
                const bajo = !agotado && p.total <= p.minimo;
                return (
                  <tr key={p.item} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 font-semibold text-[var(--text-main)]">
                      {capitalizeFirst(p.item)}
                      <span className="ml-1.5 text-[10px] text-[var(--text-muted)] font-medium">{p.grupo === 'ejecutivo' ? 'EJ' : ''}</span>
                    </td>
                    <td className="py-3 text-right font-mono text-[var(--text-muted)]">{p.existente}</td>
                    <td className="py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">+{p.entradas}</td>
                    <td className="py-3 text-right font-mono text-rose-600 dark:text-rose-400">−{p.ventas}</td>
                    <td className="py-3 text-right font-mono font-bold text-[var(--text-main)]">{p.total}</td>
                    <td className="py-3 pl-4">
                      {agotado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-3 h-3" />
                          Agotado
                        </span>
                      ) : bajo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          Bajo mínimo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Disponible
                        </span>
                      )}
                    </td>
                    {esAdmin && (
                      <td className="py-3 text-right whitespace-nowrap space-x-1">
                        <button type="button" onClick={() => handlePorciones(p.item, 'existente')} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[var(--bg-main)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-main)] border border-[var(--border-soft)] transition-colors cursor-pointer">Existente</button>
                        <button type="button" onClick={() => handlePorciones(p.item, 'entrada')} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[var(--bg-main)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-main)] border border-[var(--border-soft)] transition-colors cursor-pointer">Entrada</button>
                        <button type="button" onClick={() => handlePorciones(p.item, 'ajuste')} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[var(--bg-main)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-main)] border border-[var(--border-soft)] transition-colors cursor-pointer">Ajuste</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {movimientosPorciones.length > 0 && (
          <div className="mt-4 border-t border-[var(--border-soft)] pt-3 space-y-1.5">
            <div className="text-[11px] font-bold text-[var(--text-muted)]">Últimos movimientos de porciones</div>
            {movimientosPorciones.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>
                  <strong className="text-[var(--text-main)]">{capitalizeFirst(m.item)}</strong> · {m.tipo} {m.cantidad} · {m.motivo} · {m.usuario}
                </span>
                <span className="font-mono">
                  {m.total_anterior} → {m.total_nuevo} · {formatBogotaDateTime(m.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Movement History Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--brand-accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Kardex: Historial de Entradas, Salidas y Mermas
            </h3>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            Últimos {movimientos.length} registros
          </span>
        </div>

        {movimientos.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-xs">
            No se han registrado movimientos de inventario todavía.
          </div>
        ) : (
          <motion.div
            variants={fastStaggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-[var(--border-soft)] border border-[var(--border-soft)] rounded-xl overflow-hidden"
          >
            {movimientos.map((mov) => {
              const isPositive = mov.delta > 0;
              return (
                <motion.div
                  key={mov.id}
                  variants={tableRowVariants}
                  className="flex items-center justify-between p-3.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
                      <div className="text-sm font-bold text-[var(--text-main)]">
                        {capitalizeFirst(mov.ingrediente)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {mov.motivo} {mov.referencia ? `(${mov.referencia})` : ''}
                      </div>
                      {(mov.usuario || mov.stock_nuevo != null) && (
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {mov.usuario ? `Por ${mov.usuario}` : ''}
                          {mov.stock_anterior != null && mov.stock_nuevo != null ? ` · ${mov.stock_anterior} → ${mov.stock_nuevo}` : ''}
                        </div>
                      )}
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
                    <div className="text-[10px] text-[var(--text-muted)]">
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
              className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Ajustar Inventario: {capitalizeFirst(selectedIngredient.ingrediente)}
                </h3>
                <button
                  onClick={() => setAdjustModalOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
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
                        ? 'bg-emerald-600 text-white border-transparent'
                        : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border-soft)]'
                    }`}
                  >
                    + Sumar (Entrada / Compra)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('restar')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                      adjustType === 'restar'
                        ? 'bg-rose-600 text-white border-transparent'
                        : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border-soft)]'
                    }`}
                  >
                    - Restar (Merma / Ajuste)
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[var(--text-main)]">
                      Cantidad a modificar ({selectedIngredient.unidad}):
                    </label>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Pre-selección rápida:
                    </span>
                  </div>
                  {/* Quick amount chips */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {[1, 5, 10, 20, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAdjustAmount(String(num))}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${
                          adjustAmount === String(num)
                            ? 'bg-[var(--brand-accent)] text-white border-transparent'
                            : 'bg-[var(--bg-main)] text-[var(--text-main)] border-[var(--border-soft)] hover:border-[var(--brand-accent)]/50'
                        }`}
                      >
                        {adjustType === 'sumar' ? `+${num}` : `-${num}`}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm font-mono font-bold text-[var(--text-main)] focus:outline-none"
                    required
                  />
                </div>

                {adjustType === 'sumar' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                        Valor total de la compra ($):
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={compraValor}
                        onChange={(e) => setCompraValor(e.target.value)}
                        placeholder="Vacío = solo entrada"
                        className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm font-mono text-[var(--text-main)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                        Proveedor:
                      </label>
                      <input
                        type="text"
                        value={compraProveedor}
                        onChange={(e) => setCompraProveedor(e.target.value)}
                        placeholder="Opcional"
                        className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm text-[var(--text-main)] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Motivo o razón del movimiento:
                  </label>
                  {/* Quick reason chips */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {['Compra directa', 'Reposición semanal', 'Porcionamiento de carne', 'Cuadre físico'].map((motivo) => (
                      <button
                        key={motivo}
                        type="button"
                        onClick={() => setAdjustReason(motivo)}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
                          adjustReason === motivo
                            ? 'bg-[var(--brand-accent)] text-white border-transparent'
                            : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border-soft)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {motivo}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ej. Compra directa, porcionamiento, merma..."
                    className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm text-[var(--text-main)] focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isAdjusting || !adjustAmount}
                    style={{ backgroundColor: paletteConfig.accent }}
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

      {/* Modal: Reportar Daño / Avería / Faltante */}
      <AnimatePresence>
        {damageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-rose-500/30 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-500">
                  <PackageX className="w-5 h-5" />
                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    Reportar Daño, Avería o Faltante
                  </h3>
                </div>
                <button
                  onClick={() => setDamageModalOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                Registra mermas por vencimiento, roturas de cubiertos/empaques, caída de alimentos o faltantes en conteo físico.
              </p>

              <form onSubmit={handleReportDamage} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Insumo afectado:
                  </label>
                  <select
                    value={damageIngredient}
                    onChange={(e) => setDamageIngredient(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-xs font-medium text-[var(--text-main)] focus:outline-none"
                  >
                    <option value="">Selecciona el insumo...</option>
                    {ingredientes.map((i) => (
                      <option key={i.ingrediente} value={i.ingrediente}>
                        {capitalizeFirst(i.ingrediente)} (Stock: {formatStock(i.stock, i.unidad)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Cantidad dañada o faltante:
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={damageAmount}
                    onChange={(e) => setDamageAmount(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm font-mono font-bold text-[var(--text-main)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Motivo del daño o avería:
                  </label>
                  <select
                    value={damageReason}
                    onChange={(e) => setDamageReason(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-xs text-[var(--text-main)] focus:outline-none mb-1.5"
                  >
                    <option value="Alimento averiado o descompuesto">Alimento averiado o descompuesto</option>
                    <option value="Desechables o empaques rotos/quebrados">Desechables o empaques rotos/quebrados</option>
                    <option value="Producto quemado o dañado en cocción">Producto quemado o dañado en cocción</option>
                    <option value="Faltante no explicado en conteo">Faltante no explicado en conteo</option>
                    <option value="Fecha de vencimiento alcanzada">Fecha de vencimiento alcanzada</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDamageModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isReportingDamage || !damageIngredient || !damageAmount}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isReportingDamage ? 'Registrando...' : 'Descontar por Avería'}
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
              className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  Registrar Nuevo Insumo
                </h3>
                <button
                  onClick={() => setNewIngredientModalOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateIngredient} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Nombre del insumo:
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(normalizeUserInput(e.target.value))}
                    placeholder="Ej. Pechuga de pavo, toallas desechables..."
                    className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm text-[var(--text-main)] focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Categoría:
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as TipoInsumo)}
                      className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-xs text-[var(--text-main)] focus:outline-none"
                    >
                      <option value="carnes_proteinas">Carnes y Proteínas</option>
                      <option value="tuberculos_vegetales">Tubérculos, Plátanos y Vegetales</option>
                      <option value="verduras_hortalizas">Verduras y Hortalizas</option>
                      <option value="granos_legumbres">Granos, Legumbres y Pastas</option>
                      <option value="salsas_condimentos">Salsas, Condimentos y Aceites</option>
                      <option value="desechables">Desechables y Cubiertos</option>
                      <option value="bebidas">Bebidas</option>
                      <option value="otros_ingredientes">Otros Ingredientes</option>
                      <option value="limpieza">Aseo y Limpieza</option>
                      <option value="otro">Otros Suministros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Unidad de medida:
                    </label>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value as UnidadMedida)}
                      className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-xs text-[var(--text-main)] focus:outline-none"
                    >
                      <option value="lb">Libras (lb)</option>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="g">Gramos (g)</option>
                      <option value="unidad">Unidades (unidad)</option>
                      <option value="l">Litros (l)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="paquete">Paquetes</option>
                      <option value="bolsa">Bolsas</option>
                      <option value="botella">Botellas</option>
                      <option value="porcion">Porciones</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Stock inicial:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm font-mono font-bold text-[var(--text-main)] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Stock mínimo de alerta:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newMinimo}
                      onChange={(e) => setNewMinimo(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] text-sm font-mono font-bold text-[var(--text-main)] focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setNewIngredientModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newName.trim()}
                    style={{ backgroundColor: paletteConfig.accent }}
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
