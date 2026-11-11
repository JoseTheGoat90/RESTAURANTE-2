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
  Sparkles,
  Calculator,
  Tag,
  AlertCircle,
  Sliders,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  staggerContainerVariants,
  fastStaggerContainerVariants,
  cardItemVariants,
  listItemVariants,
} from '../utils/animations.ts';

export const ReporteTab: React.FC = () => {
  const { reporteHoy, generar_reporte, recetas, ventas, gastos } = useData();
  const { paletteConfig } = useTheme();

  const [filterDate, setFilterDate] = useState<string>('');
  const [filterHasta, setFilterHasta] = useState<string>('');
  const [reportData, setReportData] = useState(reporteHoy);
  const [isConsulting, setIsConsulting] = useState<boolean>(false);

  // Predictive & Simulation State (Recommendation 2)
  const [costIncreasePercent, setCostIncreasePercent] = useState<number>(10); // e.g. 10% annual minimum wage / inflation adjustment
  const [showPredictiveModule, setShowPredictiveModule] = useState<boolean>(true);

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConsulting(true);
    try {
      const res = await generar_reporte(filterDate || null, filterDate && filterHasta && filterHasta !== filterDate ? filterHasta : null);
      setReportData(res);
    } catch {} finally {
      setIsConsulting(false);
    }
  };

  /** Exporta el reporte consultado a CSV (se abre directamente en Excel). */
  const exportarExcel = () => {
    const filas: (string | number)[][] = [
      ['Reporte', reportData.periodo || ''],
      ['Ingresos (ventas cobradas)', reportData.total_ventas],
      ['Gastos pagados', reportData.total_gastos],
      ['Balance de ingresos y gastos registrados', reportData.balance],
      ['Número de ventas', reportData.numero_ventas],
      ['Gastos pendientes', reportData.gastos_pendientes ?? ''],
      ['Compras', reportData.total_compras ?? ''],
      [],
      ['Producto', 'Unidades vendidas'],
      ...Object.entries(reportData.unidades_por_plato || {}),
      [],
      ['Categoría de venta', 'Valor'],
      ...Object.entries(reportData.ventas_por_categoria || {}),
      [],
      ['Modalidad', 'Valor'],
      ...Object.entries(reportData.ventas_por_modalidad || {}),
      [],
      ['Medio de pago', 'Valor'],
      ...Object.entries(reportData.ventas_por_metodo || {}),
      [],
      ['Categoría de gasto', 'Valor'],
      ...Object.entries(reportData.gastos_por_categoria || {}),
      [],
      ['Insumo bajo mínimo', 'Existencia', 'Mínimo', 'Unidad'],
      ...(reportData.ingredientes_bajo_minimo || []).map((i) => [i.ingrediente, i.stock, i.stock_minimo, i.unidad]),
    ];
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${(reportData.periodo || 'hoy').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const balance = reportData.balance;
  const isBalancePositive = balance >= 0;

  // Predictive analysis & Low-rotation dish identification
  const allDishes = React.useMemo(() => {
    const set = new Set<string>();
    recetas.forEach((r) => set.add(r.plato));
    return Array.from(set);
  }, [recetas]);

  const rotationStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    allDishes.forEach((d) => (counts[d] = 0));
    ventas.forEach((v) => {
      counts[v.plato] = (counts[v.plato] || 0) + v.cantidad;
    });
    return Object.entries(counts).sort((a, b) => a[1] - b[1]); // lowest sold first
  }, [allDishes, ventas]);

  const lowRotationDish = rotationStats[0]; // [plato, cantidad]
  const highRotationDish = rotationStats[rotationStats.length - 1]; // [plato, cantidad]

  // Financial projection simulation (30 days with cost variations)
  const baseDailySales = Math.max(reportData.total_ventas, 300000);
  const baseDailyExpenses = Math.max(reportData.total_gastos, 120000);

  const projectedMonthlySales = baseDailySales * 30;
  const projectedMonthlyExpensesBase = baseDailyExpenses * 30;
  const additionalCostInflation = (projectedMonthlyExpensesBase * costIncreasePercent) / 100;
  const projectedMonthlyExpensesAdjusted = projectedMonthlyExpensesBase + additionalCostInflation;
  const projectedMonthlyNet = projectedMonthlySales - projectedMonthlyExpensesAdjusted;
  const isProjectedMarginPositive = projectedMonthlyNet >= 0;

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
                aria-label="Desde"
              />
            </div>
            <div className="relative">
              <input
                type="date"
                value={filterHasta}
                min={filterDate || undefined}
                onChange={(e) => setFilterHasta(e.target.value)}
                className="h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-xs text-stone-900 dark:text-white focus:outline-none"
                aria-label="Hasta (opcional)"
                title="Hasta (opcional, para semana, mes o rango)"
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
            <button
              type="button"
              onClick={exportarExcel}
              className="h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              title="Exportar a Excel (CSV)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-10 px-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              title="Imprimir o guardar como PDF"
            >
              <span>PDF</span>
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
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Balance (ingresos − gastos)</span>
          <div
            className={`text-2xl font-extrabold font-mono mt-2 ${
              isBalancePositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCOP(balance)}
          </div>
          <span className="text-xs text-stone-400 mt-1 block">No equivale a utilidad neta contable</span>
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

      {/* STRATEGIC PREDICTIVE & PROMOTIONS MODULE (Recomendación 2) */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16 }}
        className="bg-white dark:bg-[#121212] rounded-2xl border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl text-white shadow-xs"
              style={{ backgroundColor: paletteConfig.primaryHex }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                  Análisis Predictivo & Recomendaciones Comerciales
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Modelo Estratégico
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Proyecciones a 30 días, simulación de costos anuales (salario mínimo e inflación) y detección de platos de baja rotación.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card A: Cost Variation & 30-Day Financial Projection */}
          <div className="p-4 rounded-xl bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                <h4 className="text-xs font-bold text-stone-900 dark:text-white uppercase tracking-wider">
                  Simulador de Costos y Salario Mínimo
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
                +{costIncreasePercent}% anual
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-stone-500 dark:text-stone-400 mb-1.5">
                Ajuste estimado de costos operativos / salario mínimo:
              </label>
              <div className="flex items-center gap-2">
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCostIncreasePercent(pct)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      costIncreasePercent === pct
                        ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 border-stone-900 dark:border-white shadow-xs'
                        : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                    }`}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-stone-200/70 dark:border-stone-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400">Ventas proyectadas (30 días):</span>
                <span className="font-mono font-bold text-stone-900 dark:text-white">
                  {formatCOP(projectedMonthlySales)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400">
                  Gastos proyectados (con +{costIncreasePercent}%):
                </span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {formatCOP(projectedMonthlyExpensesAdjusted)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-stone-200/50 dark:border-stone-800/80">
                <span className="font-bold text-stone-800 dark:text-stone-200">Margen neto proyectado:</span>
                <span
                  className={`font-mono font-extrabold text-sm ${
                    isProjectedMarginPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCOP(projectedMonthlyNet)}
                </span>
              </div>
            </div>
          </div>

          {/* Card B: Commercial Recommendations for Low Rotation Dishes */}
          <div className="p-4 rounded-xl bg-stone-50/80 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-stone-900 dark:text-white uppercase tracking-wider">
                    Recomendaciones Comerciales Automáticas
                  </h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  Baja Rotación
                </span>
              </div>

              {lowRotationDish ? (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-white dark:bg-stone-800 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                    <div className="flex items-center justify-between font-bold text-stone-900 dark:text-white mb-1">
                      <span>Plato con menor salida:</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        {capitalizeFirst(lowRotationDish[0])}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                      Ha registrado <strong>{lowRotationDish[1]} porciones</strong> vendidas.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-xs space-y-1">
                    <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 shrink-0" />
                      <span>Estrategia de Promoción Sugerida:</span>
                    </div>
                    <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed">
                      Activar promoción especial de <strong>«{capitalizeFirst(lowRotationDish[0])} en Combo con Guarnición o 15% Descuento en Horas Valle»</strong> para dinamizar el inventario de materias primas en bodega antes de su vencimiento.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-stone-400">
                  No se detectaron platos con déficit de rotación.
                </div>
              )}
            </div>

            {highRotationDish && (
              <div className="pt-2 border-t border-stone-200/70 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                <span>Plato estrella (mayor salida):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {capitalizeFirst(highRotationDish[0])} ({highRotationDish[1]} unid.)
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
