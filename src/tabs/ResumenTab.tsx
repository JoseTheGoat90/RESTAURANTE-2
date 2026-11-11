/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { AdminPanel } from '../components/AdminPanel.tsx';
import { formatCOP, formatBogotaDateTime, capitalizeFirst, formatStock } from '../utils/formatters.ts';
import { RESTAURANT_IMAGES } from '../assets/images.ts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Calendar,
  ChefHat,
  Sparkles,
  ArrowUpRight,
  Wallet,
  Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  staggerContainerVariants,
  fastStaggerContainerVariants,
  cardItemVariants,
  listItemVariants,
} from '../utils/animations.ts';

export interface ResumenTabProps {
  onNavigate?: (tab: string) => void;
}

export const ResumenTab: React.FC<ResumenTabProps> = ({ onNavigate }) => {
  const { reporteHoy, ventas, isLoading, caja, abrirCaja, cerrarCaja, showNotification } = useData();
  const [montoCaja, setMontoCaja] = useState<string>('');
  const [procesandoCaja, setProcesandoCaja] = useState<boolean>(false);

  const handleCaja = async () => {
    const monto = parseFloat(montoCaja.replace(/[.\s]/g, '').replace(',', '.'));
    if (isNaN(monto) || monto < 0) {
      showNotification({ ok: false, mensaje: caja ? 'Escribe el efectivo contado en caja' : 'Escribe la base inicial de la caja' });
      return;
    }
    if (caja && !window.confirm(`¿Cerrar la caja con ${formatCOP(monto)} contados? Esperado: ${formatCOP(caja.esperado)}.`)) return;
    setProcesandoCaja(true);
    try {
      const res = caja ? await cerrarCaja(monto) : await abrirCaja(monto);
      showNotification(res);
      if (res.ok) setMontoCaja('');
    } finally {
      setProcesandoCaja(false);
    }
  };
  const { paletteConfig } = useTheme();

  const balance = reporteHoy.balance;
  const isBalancePositive = balance >= 0;
  const bajoMinimo = reporteHoy.ingredientes_bajo_minimo || [];

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Hero Gourmet Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-2xl overflow-hidden shadow-xs border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121212]"
      >
        <div className="relative h-44 sm:h-52 w-full overflow-hidden">
          <img
            src={RESTAURANT_IMAGES.heroAmbience}
            alt="Ambiente del Restaurante"
            className="w-full h-full object-cover object-center filter dark:brightness-90 transition-transform duration-700 hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col justify-end p-5 sm:p-6 text-white">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full text-white shadow-xs"
                style={{ backgroundColor: paletteConfig.primaryHex }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Panel de Operación en Vivo</span>
              </span>
              <span className="text-xs text-stone-300">· {reporteHoy.periodo}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
              Servicio de Sala y Cocina
            </h2>
            <p className="text-xs sm:text-sm text-stone-200 mt-1 max-w-xl line-clamp-2">
              Control en tiempo real de ingresos por mesas, insumos de bodega y pedidos en cocina.
            </p>
          </div>
        </div>
      </motion.div>

      {/* 3 Metric Summary Cards with Staggered Entrance */}
      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Card 1: Ventas Hoy */}
        <motion.div
          variants={cardItemVariants}
          onClick={() => onNavigate?.('vender')}
          className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs flex flex-col justify-between ${
            onNavigate ? 'cursor-pointer hover:border-emerald-500/50 transition-colors' : ''
          }`}
          title="Ver o registrar ventas"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)]">
              Ventas hoy
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] font-mono tabular-nums">
              {formatCOP(reporteHoy.total_ventas)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-[var(--text-main)]">
                {reporteHoy.numero_ventas} {reporteHoy.numero_ventas === 1 ? 'pedido' : 'pedidos'}
              </span>
              <span>registrados hoy</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Gastos Hoy */}
        <motion.div
          variants={cardItemVariants}
          onClick={() => onNavigate?.('gastos')}
          className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs flex flex-col justify-between ${
            onNavigate ? 'cursor-pointer hover:border-rose-500/50 transition-colors' : ''
          }`}
          title="Ver o registrar gastos"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)]">
              Gastos hoy
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] font-mono tabular-nums">
              {formatCOP(reporteHoy.total_gastos)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Egresos operativos del día
            </div>
          </div>
        </motion.div>

        {/* Card 3: Balance Hoy */}
        <motion.div
          variants={cardItemVariants}
          className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)]">
              Balance (ingresos − gastos)
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isBalancePositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums ${
                isBalancePositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCOP(balance)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              No equivale a utilidad neta
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Caja del turno: base, ingresos por medio de pago, salidas en efectivo y arqueo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-main)]">
                {caja ? 'Caja abierta' : 'Caja cerrada'}
              </div>
              {caja ? (
                <div className="text-xs text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Base: <strong className="text-[var(--text-main)] font-mono">{formatCOP(caja.base)}</strong></span>
                  <span>Efectivo: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">+{formatCOP(caja.ventas_efectivo)}</strong></span>
                  <span>Otros medios: <strong className="text-[var(--text-main)] font-mono">{formatCOP(caja.ventas_otros)}</strong></span>
                  <span>Salidas en efectivo: <strong className="text-rose-600 dark:text-rose-400 font-mono">−{formatCOP(caja.gastos_efectivo)}</strong></span>
                  <span>Esperado en caja: <strong className="text-[var(--text-main)] font-mono">{formatCOP(caja.esperado)}</strong></span>
                  <span>· {caja.numero_ventas} ventas · abierta por {caja.abierta_por} · {formatBogotaDateTime(caja.abierta_en)}</span>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Abre la caja con la base en efectivo para que las ventas y salidas del turno queden registradas en ella.
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              inputMode="decimal"
              value={montoCaja}
              onChange={(e) => setMontoCaja(e.target.value)}
              placeholder={caja ? 'Efectivo contado' : 'Base inicial'}
              className="w-36 h-9 px-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-main)] text-xs font-mono text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
            />
            <button
              type="button"
              disabled={procesandoCaja || !montoCaja}
              onClick={handleCaja}
              style={{ backgroundColor: paletteConfig.accent }}
              className="h-9 px-3.5 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {procesandoCaja && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{caja ? 'Cerrar caja' : 'Abrir caja'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      <AdminPanel />

      {/* Insumos Bajo Mínimo Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Insumos bajo mínimo de seguridad
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            {bajoMinimo.length} alertas
          </span>
        </div>

        {bajoMinimo.length === 0 ? (
          <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <CheckCircle2 className="w-4 h-4" />
            <span>Excelente: Todos los ingredientes están por encima de su stock mínimo.</span>
          </div>
        ) : (
          <motion.div
            variants={fastStaggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden"
          >
            {bajoMinimo.map((item, idx) => (
              <motion.div
                key={`${item.ingrediente}-${idx}`}
                variants={listItemVariants}
                onClick={() => onNavigate?.('inventario')}
                className={`flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors ${
                  onNavigate ? 'cursor-pointer' : ''
                }`}
                title="Ver insumo en Inventario"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
                  <div>
                    <div className="text-sm font-bold text-stone-900 dark:text-white">
                      {capitalizeFirst(item.ingrediente)}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      Mínimo requerido: {formatStock(item.stock_minimo, item.unidad)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
                    {formatStock(item.stock, item.unidad)}
                  </div>
                  <div className="text-[10px] text-stone-400">Existencias actuales</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
