/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  formatCOP,
  formatBogotaDateOnly,
  capitalizeFirst,
} from '../utils/formatters.ts';
import {
  FileBarChart2,
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  UtensilsCrossed,
  PieChart,
  Lightbulb,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  staggerContainerVariants,
  fastStaggerContainerVariants,
  cardItemVariants,
  listItemVariants,
} from '../utils/animations.ts';

export const ReporteTab: React.FC = () => {
  const { reporteHoy, generar_reporte } = useData();
  const { paletteConfig } = useTheme();

  const [filterDate, setFilterDate] = useState<string>('');
  const [reportData, setReportData] = useState(reporteHoy);
  const [isConsulting, setIsConsulting] = useState<boolean>(false);

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConsulting(true);
    try {
      const res = await generar_reporte(filterDate || null);
      setReportData(res);
    } catch {} finally {
      setIsConsulting(false);
    }
  };

  const balance = reportData.balance;
  const isBalancePositive = balance >= 0;

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Header Filter Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${paletteConfig.primaryHex}15`, color: paletteConfig.primaryHex }}
            >
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                Reportes y Balance Financiero
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Consolidado de ventas, costos operativos y margen del periodo.
              </p>
            </div>
          </div>

          <form onSubmit={handleConsult} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-xs text-stone-900 dark:text-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isConsulting}
              style={{ backgroundColor: paletteConfig.primaryHex }}
              className="h-10 px-4 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{filterDate ? 'Consultar' : 'Hoy'}</span>
            </button>
          </form>
        </div>
      </motion.div>

      {/* 4 Metric Cards with Staggered Entrance */}
      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div
          variants={cardItemVariants}
          className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
        >
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Total Ventas</span>
          <div className="text-2xl font-extrabold text-stone-900 dark:text-white font-mono mt-2">
            {formatCOP(reportData.total_ventas)}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">
            {reportData.numero_ventas} pedidos cobrados
          </span>
        </motion.div>

        <motion.div
          variants={cardItemVariants}
          className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
        >
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Total Gastos</span>
          <div className="text-2xl font-extrabold text-stone-900 dark:text-white font-mono mt-2">
            {formatCOP(reportData.total_gastos)}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Costos operativos</span>
        </motion.div>

        <motion.div
          variants={cardItemVariants}
          className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
        >
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Balance Neto</span>
          <div
            className={`text-2xl font-extrabold font-mono mt-2 ${
              isBalancePositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCOP(balance)}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Margen de utilidad</span>
        </motion.div>

        <motion.div
          variants={cardItemVariants}
          className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs"
        >
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Alerta de Insumos</span>
          <div className="text-2xl font-extrabold text-amber-500 font-mono mt-2">
            {reportData.ingredientes_bajo_minimo?.length || 0}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">Bajo el mínimo</span>
        </motion.div>
      </motion.div>

      {/* Breakdown grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dishes Sold Breakdown */}
        <div className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <UtensilsCrossed className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Platos Preparados en el Periodo
            </h3>
          </div>
          {Object.keys(reportData.unidades_por_plato || {}).length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-400">
              No se han registrado ventas de platos en este periodo.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(reportData.unidades_por_plato || {}).map(([plato, cant]) => (
                <div
                  key={plato}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 text-xs"
                >
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {capitalizeFirst(plato)}
                  </span>
                  <span className="font-bold text-stone-900 dark:text-white">
                    {cant} {cant === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses by Category Breakdown */}
        <div className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Egresos por Categoría
            </h3>
          </div>
          {Object.keys(reportData.gastos_por_categoria || {}).length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-400">
              No hay egresos registrados en este periodo.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(reportData.gastos_por_categoria || {}).map(([cat, val]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 text-xs"
                >
                  <span className="capitalize font-semibold text-stone-800 dark:text-stone-200">
                    {cat}
                  </span>
                  <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                    {formatCOP(val)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
