/**
 * Planilla de asados y ejecutivos con el mismo formato de la hoja del restaurante:
 * productos en columnas; EXISTENTE / ENTRADA / VENTAS / TOTAL en filas; un bloque por día.
 * El día en curso es en vivo (las ventas descuentan solas); los anteriores salen de cada cierre.
 * Total = Existente + Entrada − Ventas (lo calcula la base).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Lock, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { CierrePorciones, useComandas } from '../services/comandas.ts';
import { ItemPorciones } from '../types.ts';

// Orden de la hoja física
const ORDEN = ['lomo de cerdo', 'carne de res', 'pechuga', 'costillas', 'chuleta', 'sobrebarriga', 'ejecutivo de cerdo',
  'ejecutivo de chuleta', 'ejecutivo de pechuga', 'ejecutivo de carne de res', 'chinchurria'];

const encabezado = (item: string) => item.replace(/^ejecutivo de /, 'EJ ').toUpperCase();
const FILAS: { id: 'existente' | 'entradas' | 'ventas' | 'total'; label: string }[] = [
  { id: 'existente', label: 'EXISTENTE' },
  { id: 'entradas', label: 'ENTRADA' },
  { id: 'ventas', label: 'VENTAS' },
  { id: 'total', label: 'TOTAL' },
];

const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });

export const PlanillaPorciones: React.FC = () => {
  const { rol, isDemo } = useAuth();
  const { porciones, registrarPorciones, cerrarPeriodoPorciones, showNotification } = useData();
  const api = useComandas();
  const [cierres, setCierres] = useState<CierrePorciones[]>([]);
  const esAdmin = rol === 'admin';

  const cargar = useCallback(async () => {
    if (isDemo) return;
    try {
      setCierres(await api.planillaCierres());
    } catch {
      /* sin historial todavía */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const items = useMemo(() => {
    const activos = porciones.filter((p) => p.activo);
    return [...activos].sort((a, b) => {
      const ia = ORDEN.indexOf(a.item), ib = ORDEN.indexOf(b.item);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.item.localeCompare(b.item);
    });
  }, [porciones]);

  const dias = useMemo(() => {
    const m = new Map<string, Map<string, CierrePorciones>>();
    for (const c of cierres) {
      if (!m.has(c.fecha)) m.set(c.fecha, new Map());
      m.get(c.fecha)!.set(c.item, c);
    }
    return [...m.entries()].slice(0, 6);
  }, [cierres]);

  const editar = async (p: ItemPorciones, fila: 'existente' | 'entradas') => {
    const tipo = fila === 'existente' ? 'existente' : 'entrada';
    const txt = window.prompt(
      fila === 'existente' ? `Porciones EXISTENTES de ${p.item} al iniciar el día:` : `Porciones que ENTRAN de ${p.item}:`,
      fila === 'existente' ? String(p.existente) : ''
    );
    if (txt === null) return;
    const n = Number(txt.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return showNotification({ ok: false, mensaje: 'Escribe un número de porciones válido.' });
    showNotification(await registrarPorciones({ p_item: p.item, p_tipo: tipo, p_cantidad: n, p_motivo: 'Planilla' }));
  };

  const cerrarDia = async () => {
    if (!window.confirm('¿Cerrar la planilla de hoy? Se guarda en el historial y el TOTAL de cada producto pasa a EXISTENTE de mañana.')) return;
    const r = await cerrarPeriodoPorciones();
    showNotification(r);
    if (r.ok) await cargar();
  };

  if (!items.length) return null;

  const Tabla: React.FC<{ titulo: string; valor: (item: string, fila: typeof FILAS[number]['id']) => number | null; vivo?: boolean }> = ({ titulo, valor, vivo }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--bg-card)] text-left px-2 py-2 border border-[var(--border-soft)] text-xs font-extrabold capitalize min-w-[110px]">{titulo}</th>
            {items.map((p) => (
              <th key={p.item} className="px-2 py-2 border border-[var(--border-soft)] text-[11px] font-bold leading-tight min-w-[72px]">{encabezado(p.item)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FILAS.map((f) => (
            <tr key={f.id} className={f.id === 'total' ? 'bg-black/5 dark:bg-white/5' : ''}>
              <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-2 py-2 border border-[var(--border-soft)] text-xs font-extrabold">{f.label}</td>
              {items.map((p) => {
                const v = valor(p.item, f.id);
                const bajo = vivo && f.id === 'total' && p.minimo > 0 && (v ?? 0) <= p.minimo;
                const editable = vivo && esAdmin && (f.id === 'existente' || f.id === 'entradas');
                return (
                  <td key={p.item} className={`border border-[var(--border-soft)] p-0 text-center tabular-nums ${f.id === 'total' ? 'font-extrabold' : ''} ${bajo ? 'text-[#d03b3b]' : ''}`}>
                    {editable ? (
                      <button type="button" onClick={() => void editar(p, f.id as 'existente' | 'entradas')} className="w-full h-full px-2 py-2 hover:bg-[var(--brand-accent)]/10 cursor-pointer" title="Tocar para registrar">
                        {v ?? ''}
                      </button>
                    ) : (
                      <span className="block px-2 py-2">{v ?? ''}{bajo ? ' ⚠' : ''}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const hoy = new Map(items.map((p) => [p.item, p]));

  return (
    <section className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 space-y-4 print:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold mb-2 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Planilla diaria · por porciones</span>
          </div>
          <h3 className="text-lg font-extrabold">Asados y ejecutivos</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Igual que la hoja: TOTAL = EXISTENTE + ENTRADA − VENTAS. Las ventas se descuentan solas.
            {esAdmin && ' Toca EXISTENTE o ENTRADA para registrar.'}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-soft)] text-sm font-bold cursor-pointer">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          {esAdmin && (
            <button type="button" onClick={() => void cerrarDia()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-accent)] text-white text-sm font-bold cursor-pointer">
              <Lock className="w-4 h-4" /> Cerrar el día
            </button>
          )}
        </div>
      </div>

      <Tabla titulo={`Hoy · desde ${items[0]?.periodo_desde ? fechaLarga(items[0].periodo_desde) : 'el último cierre'}`} vivo valor={(item, f) => hoy.get(item)?.[f] ?? null} />

      {dias.map(([fecha, mapa]) => (
        <Tabla key={fecha} titulo={fechaLarga(fecha)} valor={(item, f) => mapa.get(item)?.[f] ?? null} />
      ))}
      {!isDemo && !dias.length && <p className="text-xs text-[var(--text-muted)]">Los días anteriores aparecerán aquí cuando se cierre la planilla.</p>}
    </section>
  );
};
