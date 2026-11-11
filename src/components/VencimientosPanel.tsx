/**
 * Qué se va a dañar y cuánta plata hay en riesgo. Cada compra entra como lote con su fecha
 * (o con la vida útil del insumo) y las ventas descuentan primero el lote que vence antes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { formatCOP, capitalizeFirst, formatStock } from '../utils/formatters.ts';
import { LoteVencimiento, Vencimientos, useOperacion } from '../services/operacion.ts';

function etiqueta(dias: number): { texto: string; borde: string; chip: string } {
  if (dias < 0) return { texto: `Venció hace ${-dias} d`, borde: 'border-l-rose-700', chip: 'bg-rose-700 text-white' };
  if (dias === 0) return { texto: 'Vence hoy', borde: 'border-l-rose-500', chip: 'bg-rose-500 text-white' };
  if (dias <= 2) return { texto: `En ${dias} día${dias === 1 ? '' : 's'}`, borde: 'border-l-amber-500', chip: 'bg-amber-500 text-black' };
  return { texto: `En ${dias} días`, borde: 'border-l-sky-600', chip: 'bg-sky-600/15 text-sky-700 dark:text-sky-300' };
}

export const VencimientosPanel: React.FC = () => {
  const { rol } = useAuth();
  const { showNotification, reloadVentasEInventario } = useData();
  const { vencimientos, registrarMerma, fijarVidaUtil } = useOperacion();
  const [datos, setDatos] = useState<Vencimientos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vidaUtil, setVidaUtil] = useState<Record<string, string>>({});
  const puedeMerma = rol === 'admin' || rol === 'cocina' || rol === 'parrilla';
  const esAdmin = rol === 'admin';

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await vencimientos(7));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los vencimientos.');
    } finally {
      setCargando(false);
    }
  }, [vencimientos]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const botar = async (l: LoteVencimiento) => {
    const txt = window.prompt(
      `¿Cuánto ${l.unidad} de ${l.ingrediente} se bota? (en el lote quedan ${l.cantidad})`,
      String(l.cantidad)
    );
    if (txt === null) return;
    const cant = Number(txt.replace(',', '.'));
    if (!cant || cant <= 0) return showNotification({ ok: false, mensaje: 'Escribe una cantidad válida.' });
    const res = await registrarMerma(l.ingrediente, cant, l.dias_restantes < 0 ? 'vencido' : 'dañado antes de vencer');
    showNotification(res);
    if (res.ok) await Promise.all([cargar(), reloadVentasEInventario()]);
  };

  const guardarVida = async (ingrediente: string) => {
    const dias = Number(vidaUtil[ingrediente]);
    if (!dias || dias <= 0) return showNotification({ ok: false, mensaje: 'Escribe los días que dura el insumo.' });
    const res = await fijarVidaUtil(ingrediente, dias);
    showNotification(res);
    if (res.ok) await cargar();
  };

  const lotes = datos?.lotes ?? [];
  const sinFecha = datos?.sin_fecha ?? [];

  return (
    <section className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mb-2 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]">
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Vencimientos y frescura</span>
          </div>
          <h3 className="text-lg font-extrabold">Qué se va a dañar esta semana</h3>
          <p className="text-xs text-[var(--text-muted)]">Las ventas gastan primero lo que vence antes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-xl px-4 py-2 text-right ${datos && datos.dinero_en_riesgo > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">En riesgo (≤ 2 días)</p>
            <p className={`text-xl font-extrabold ${datos && datos.dinero_en_riesgo > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatCOP(datos?.dinero_en_riesgo ?? 0)}
            </p>
          </div>
          <button type="button" onClick={() => void cargar()} className="p-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm">{error}</p>}
      {cargando && !datos && (
        <div className="flex justify-center py-6 text-[var(--text-muted)]"><Loader2 className="w-5 h-5 animate-spin" /></div>
      )}

      {datos && !lotes.length && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-semibold">Nada vence en los próximos 7 días.</p>
      )}

      <div className="space-y-2">
        {lotes.map((l) => {
          const e = etiqueta(l.dias_restantes);
          return (
            <div key={l.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] border-l-8 ${e.borde} px-4 py-3`}>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${e.chip}`}>{e.texto}</span>
                <span className="font-bold">{capitalizeFirst(l.ingrediente)}</span>
                <span className="text-sm text-[var(--text-muted)]">{formatStock(l.cantidad, l.unidad)}</span>
              </div>
              <div className="flex items-center gap-3">
                {l.dinero > 0 && <span className="text-sm font-bold">{formatCOP(l.dinero)}</span>}
                {puedeMerma && (
                  <button
                    type="button"
                    onClick={() => void botar(l)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Se dañó
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sinFecha.length > 0 && (
        <details className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
          <summary className="text-sm font-semibold cursor-pointer">
            {sinFecha.length} insumo(s) con existencias sin fecha de vencimiento
          </summary>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {esAdmin
              ? 'Escribe cuántos días dura cada uno (pollo crudo 2, lechuga 4, arroz 180…). Desde ahí, cada compra queda con su fecha.'
              : 'Administración debe indicar cuántos días dura cada uno para poder avisar.'}
          </p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sinFecha.map((s) => (
              <div key={s.ingrediente} className="flex items-center justify-between gap-2 bg-[var(--bg-card)] rounded-lg px-3 py-2">
                <span className="text-sm font-semibold">{capitalizeFirst(s.ingrediente)}</span>
                {esAdmin && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={vidaUtil[s.ingrediente] ?? ''}
                      onChange={(e) => setVidaUtil((v) => ({ ...v, [s.ingrediente]: e.target.value }))}
                      className="w-16 px-2 py-1 rounded-md border border-[var(--border-soft)] bg-transparent text-sm"
                      placeholder="días"
                    />
                    <button type="button" onClick={() => void guardarVida(s.ingrediente)} className="px-2 py-1 rounded-md text-xs font-bold bg-[var(--brand-accent)] text-white cursor-pointer">
                      Guardar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
};
