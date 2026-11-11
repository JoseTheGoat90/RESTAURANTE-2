/**
 * Tablero del dueño: cómo va el negocio hoy y en el mes, proyección, gastos y alertas.
 * Todo sale de una sola función de la base (tablero, migración 008) y se refresca cada 30 s.
 * Colores: ingresos = azul (serie 1), gastos = naranja (serie 2), paleta validada para daltonismo;
 * los estados (bien / revisar / alerta) siempre llevan texto, nunca solo color.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Settings2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { formatCOP, capitalizeFirst } from '../utils/formatters.ts';
import { DEMO_TABLERO, Tablero, useComandas } from '../services/comandas.ts';

const ING = 'fill-[#2a78d6] dark:fill-[#3987e5]';
const GAS = 'fill-[#eb6834] dark:fill-[#d95926]';
const ING_BG = 'bg-[#2a78d6] dark:bg-[#3987e5]';
const GAS_BG = 'bg-[#eb6834] dark:bg-[#d95926]';

const corto = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : n >= 1000 ? `$${Math.round(n / 1000)} mil` : formatCOP(n));
const diaCorto = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()]} ${d.getDate()}`;
};
const MEDIO: Record<string, string> = { efectivo: 'Efectivo', nequi: 'Nequi', tarjeta: 'Tarjeta', transferencia: 'Transferencia', credito: 'Crédito' };
const MODALIDAD: Record<string, string> = { mesa: 'En mesa', para_llevar: 'Para llevar', domicilio: 'Domicilio' };

export const TableroPanel: React.FC = () => {
  const { isDemo } = useAuth();
  const { showNotification } = useData();
  const api = useComandas();
  const [t, setT] = useState<Tablero | null>(isDemo ? DEMO_TABLERO : null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verConfig, setVerConfig] = useState(false);

  const cargar = useCallback(async () => {
    if (isDemo) return setT(DEMO_TABLERO);
    setCargando(true);
    try {
      setT(await api.tablero());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el tablero.');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  useEffect(() => {
    void cargar();
    const i = setInterval(() => void cargar(), 30_000);
    return () => clearInterval(i);
  }, [cargar]);

  if (error && !t) return <p className="p-3 rounded-xl bg-rose-500/10 text-rose-600 text-sm">{error}</p>;
  if (!t)
    return (
      <div className="flex justify-center py-10 text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
    );

  const { hoy, mes, alertas, operacion } = t;
  const sube = (hoy.variacion_pct ?? 0) >= 0;
  const cobertura = mes.cobertura_gastos_pct;
  const alertasLista: { nivel: 'alerta' | 'revisar'; texto: string }[] = [
    ...alertas.insumos_bajos.map((a) => ({ nivel: 'alerta' as const, texto: `${capitalizeFirst(a.item)} bajo el mínimo (${a.stock} de ${a.minimo} ${a.unidad})` })),
    ...alertas.porciones_bajas.map((a) => ({ nivel: 'alerta' as const, texto: `${capitalizeFirst(a.item)}: quedan ${a.total} porciones (mínimo ${a.minimo})` })),
    ...(alertas.dinero_en_riesgo > 0 ? [{ nivel: 'alerta' as const, texto: `${formatCOP(alertas.dinero_en_riesgo)} en productos que vencen en 2 días` }] : []),
    ...(alertas.faltantes > 0 ? [{ nivel: 'revisar' as const, texto: `${alertas.faltantes} faltante(s) reportado(s) por cocina` }] : []),
    ...(alertas.agotados_menu.length ? [{ nivel: 'revisar' as const, texto: `Agotado hoy: ${alertas.agotados_menu.map(capitalizeFirst).join(', ')}` }] : []),
    ...(operacion.checklists.vencidos > 0 ? [{ nivel: 'revisar' as const, texto: `${operacion.checklists.vencidos} checklist(s) pasaron su hora límite` }] : []),
    ...(operacion.checklists.alertas > 0 ? [{ nivel: 'alerta' as const, texto: `${operacion.checklists.alertas} alerta(s) en checklists de hoy` }] : []),
    ...(mes.gastos_pendientes.n > 0 ? [{ nivel: 'revisar' as const, texto: `${mes.gastos_pendientes.n} gasto(s) pendiente(s) de pago: ${formatCOP(mes.gastos_pendientes.valor)}` }] : []),
    ...(!operacion.caja ? [{ nivel: 'revisar' as const, texto: 'La caja está cerrada' }] : []),
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Cómo va el negocio</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {isDemo ? 'Datos de ejemplo' : `Actualizado ${t.generado} · se refresca cada 30 s`}
            {error && <span className="text-rose-600"> · {error}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setVerConfig((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-soft)] text-sm font-bold cursor-pointer">
            <Settings2 className="w-4 h-4" /> Restaurante
          </button>
          <button type="button" onClick={() => void cargar()} className="p-2.5 rounded-xl border border-[var(--border-soft)] cursor-pointer" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {verConfig && <ConfigCard onGuardado={(r) => showNotification(r)} />}

      {/* Cifras del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile titulo="Ingresos de hoy" valor={formatCOP(hoy.ingresos)}>
          {hoy.variacion_pct === null ? (
            <span className="text-[var(--text-muted)]">Sin datos del mismo día la semana pasada</span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold">
              {sube ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-600" />}
              {sube ? '+' : ''}{hoy.variacion_pct} % vs. hace una semana a esta hora
            </span>
          )}
        </Tile>
        <Tile titulo="Por cobrar ahora" valor={formatCOP(hoy.por_cobrar)}>
          <span className="text-[var(--text-muted)]">Pedidos entregados o en curso sin pagar</span>
        </Tile>
        <Tile titulo="Ticket promedio" valor={hoy.ticket_promedio ? formatCOP(hoy.ticket_promedio) : '—'}>
          <span className="text-[var(--text-muted)]">{hoy.pedidos} pedido(s) hoy</span>
        </Tile>
        <Tile titulo="Gastos de hoy" valor={formatCOP(hoy.gastos)}>
          <span className="text-[var(--text-muted)]">Incluye compras registradas</span>
        </Tile>
      </div>

      {/* Mes y proyección */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-extrabold">Últimos 14 días</h3>
            <Leyenda />
          </div>
          <BarrasDobles serie={t.serie_14_dias} />
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
          <h3 className="font-extrabold">Este mes (día {mes.dias_transcurridos} de {mes.dias_del_mes})</h3>
          <Fila etiqueta="Ingresos" valor={formatCOP(mes.ingresos)} />
          <Fila etiqueta="Gastos" valor={formatCOP(mes.gastos)} sub={mes.gastos_fijos ? `fijos ${formatCOP(mes.gastos_fijos)}` : undefined} />
          <Fila etiqueta="Ingresos − gastos" valor={formatCOP(mes.balance)} fuerte />
          <div className="pt-2 border-t border-[var(--border-soft)] space-y-1.5">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Si sigue a este ritmo, el mes cierra en</p>
            <Fila etiqueta="Ingresos" valor={formatCOP(mes.proyeccion_ingresos)} />
            <Fila etiqueta="Gastos" valor={formatCOP(mes.proyeccion_gastos)} />
            {mes.dias_con_ventas < 14 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">Solo hay {mes.dias_con_ventas} día(s) con ventas: la proyección es orientativa.</p>
            )}
          </div>
          {cobertura !== null && (
            <div className="space-y-1">
              <p className="text-xs font-semibold">
                Los ingresos cubren el {cobertura} % de los gastos del mes {cobertura >= 100 ? '· punto de equilibrio superado' : ''}
              </p>
              <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${ING_BG}`} style={{ width: `${Math.min(100, cobertura)}%` }} />
              </div>
            </div>
          )}
          <p className="text-[11px] text-[var(--text-muted)]">Ingresos − gastos registrados; no es utilidad neta contable.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
          <h3 className="font-extrabold">Ingresos de hoy por hora</h3>
          <BarrasHora datos={hoy.por_hora} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(hoy.por_medio).map(([k, v]) => <Fila key={k} etiqueta={MEDIO[k] ?? k} valor={corto(v)} />)}
            {Object.entries(hoy.por_modalidad).map(([k, v]) => <Fila key={k} etiqueta={MODALIDAD[k] ?? k} valor={corto(v)} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
          <h3 className="font-extrabold">Lo más vendido (7 días)</h3>
          <Ranking filas={t.top_productos_7_dias.map((p) => ({ etiqueta: capitalizeFirst(p.plato), valor: p.unidades, texto: `${p.unidades} · ${corto(p.ingresos)}` }))} clase={ING_BG} />
          <h3 className="font-extrabold pt-2">Gastos del mes por categoría</h3>
          <Ranking filas={mes.gastos_por_categoria.map((g) => ({ etiqueta: capitalizeFirst(g.categoria), valor: g.valor, texto: corto(g.valor) }))} clase={GAS_BG} />
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
          <h3 className="font-extrabold">Operación y alertas</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Mini etiqueta="Pendientes" valor={operacion.pedidos_activos.nuevo ?? 0} />
            <Mini etiqueta="En cocina" valor={operacion.pedidos_activos.en_cocina ?? 0} />
            <Mini etiqueta="Listos sin entregar" valor={operacion.pedidos_activos.listo ?? 0} />
            <Mini etiqueta="Checklists" valor={`${operacion.checklists.hechos}/${operacion.checklists.total}`} />
          </div>
          {alertasLista.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Todo en orden: no hay nada que hacer.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {alertasLista.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${a.nivel === 'alerta' ? 'text-[#d03b3b]' : 'text-[#c98500]'}`} />
                  <span>
                    <b className="text-[11px] uppercase tracking-wide">{a.nivel === 'alerta' ? 'Alerta' : 'Revisar'}</b> · {a.texto}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

// ---------- Piezas ----------
const Tile: React.FC<{ titulo: string; valor: string; children?: React.ReactNode }> = ({ titulo, valor, children }) => (
  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
    <p className="text-xs font-semibold text-[var(--text-muted)]">{titulo}</p>
    <p className="text-2xl sm:text-3xl font-black tracking-tight mt-1 tabular-nums">{valor}</p>
    <p className="text-[11px] mt-1">{children}</p>
  </div>
);

const Fila: React.FC<{ etiqueta: string; valor: string; sub?: string; fuerte?: boolean }> = ({ etiqueta, valor, sub, fuerte }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[var(--text-muted)] text-sm">{etiqueta}{sub && <span className="text-[11px]"> ({sub})</span>}</span>
    <span className={`tabular-nums ${fuerte ? 'font-black text-lg' : 'font-bold'}`}>{valor}</span>
  </div>
);

const Mini: React.FC<{ etiqueta: string; valor: number | string }> = ({ etiqueta, valor }) => (
  <div className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2">
    <p className="text-[11px] text-[var(--text-muted)]">{etiqueta}</p>
    <p className="text-lg font-extrabold tabular-nums">{valor}</p>
  </div>
);

const Leyenda: React.FC = () => (
  <div className="flex items-center gap-4 text-xs font-semibold">
    <span className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-sm ${ING_BG}`} /> Ingresos</span>
    <span className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-sm ${GAS_BG}`} /> Gastos</span>
  </div>
);

/** Barras agrupadas ingresos/gastos por día, con tooltip al pasar o tocar. */
const BarrasDobles: React.FC<{ serie: Tablero['serie_14_dias'] }> = ({ serie }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 200, B = 22, T = 8, L = 48; // L: margen para las etiquetas del eje
  const max = Math.max(1, ...serie.map((d) => Math.max(d.ingresos, d.gastos)));
  const paso = (W - L) / Math.max(1, serie.length);
  const bw = Math.max(3, Math.min(14, paso / 2 - 4));
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const h = hover !== null ? serie[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ingresos y gastos de los últimos 14 días">
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W} y1={y(max * f)} y2={y(max * f)} className="stroke-black/10 dark:stroke-white/10" strokeWidth={1} />
            <text x={L - 6} y={y(max * f) + 3} textAnchor="end" className="fill-[var(--text-muted)] text-[10px]">{corto(max * f)}</text>
          </g>
        ))}
        <line x1={L} x2={W} y1={H - B} y2={H - B} className="stroke-black/20 dark:stroke-white/20" strokeWidth={1} />
        {serie.map((d, i) => {
          const x0 = L + i * paso;
          const cx = x0 + paso / 2;
          return (
            <g key={d.fecha} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <rect x={x0} y={T} width={paso} height={H - B - T} fill="transparent" />
              {hover === i && <rect x={x0 + 2} y={T} width={paso - 4} height={H - B - T} rx={6} className="fill-black/5 dark:fill-white/5" />}
              <rect x={cx - bw - 1} y={y(d.ingresos)} width={bw} height={Math.max(0, H - B - y(d.ingresos))} rx={3} className={ING} />
              <rect x={cx + 1} y={y(d.gastos)} width={bw} height={Math.max(0, H - B - y(d.gastos))} rx={3} className={GAS} />
              {(i % 2 === serie.length % 2 || serie.length <= 7) && (
                <text x={cx} y={H - 6} textAnchor="middle" className="fill-[var(--text-muted)] text-[10px]">{diaCorto(d.fecha)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="absolute top-0 pointer-events-none rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-lg px-3 py-2 text-xs"
          style={{ left: `${Math.min(75, Math.max(0, ((L + (hover + 0.5) * paso) / W) * 100 - 12))}%` }}
        >
          <p className="font-bold">{diaCorto(h.fecha)}</p>
          <p className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-sm ${ING_BG}`} /> Ingresos <b className="ml-auto pl-2">{formatCOP(h.ingresos)}</b></p>
          <p className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-sm ${GAS_BG}`} /> Gastos <b className="ml-auto pl-2">{formatCOP(h.gastos)}</b></p>
        </div>
      )}
    </div>
  );
};

const BarrasHora: React.FC<{ datos: { hora: number; ingresos: number }[] }> = ({ datos }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (!datos.length) return <p className="text-sm text-[var(--text-muted)] py-6 text-center">Aún no hay cobros hoy.</p>;
  const desde = Math.min(...datos.map((d) => d.hora), 11);
  const hasta = Math.max(...datos.map((d) => d.hora), 15);
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const max = Math.max(1, ...datos.map((d) => d.ingresos));
  const W = 320, H = 120, B = 18;
  const paso = W / horas.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ingresos de hoy por hora">
      <line x1={0} x2={W} y1={H - B} y2={H - B} className="stroke-black/20 dark:stroke-white/20" strokeWidth={1} />
      {horas.map((h, i) => {
        const v = datos.find((d) => d.hora === h)?.ingresos ?? 0;
        const alto = (v / max) * (H - B - 16);
        return (
          <g key={h} onMouseEnter={() => setHover(h)} onMouseLeave={() => setHover(null)} onClick={() => setHover(h)}>
            <rect x={i * paso} y={0} width={paso} height={H} fill="transparent" />
            <rect x={i * paso + paso * 0.2} y={H - B - alto} width={paso * 0.6} height={alto} rx={3} className={ING} />
            <text x={i * paso + paso / 2} y={H - 4} textAnchor="middle" className="fill-[var(--text-muted)] text-[9px]">{h}h</text>
            {hover === h && v > 0 && (
              <text x={i * paso + paso / 2} y={H - B - alto - 4} textAnchor="middle" className="fill-[var(--text-main)] text-[10px] font-bold">{corto(v)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const Ranking: React.FC<{ filas: { etiqueta: string; valor: number; texto: string }[]; clase: string }> = ({ filas, clase }) => {
  if (!filas.length) return <p className="text-sm text-[var(--text-muted)]">Sin datos todavía.</p>;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.etiqueta} className="space-y-0.5">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{f.etiqueta}</span>
            <span className="font-bold tabular-nums shrink-0">{f.texto}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10">
            <div className={`h-full rounded-full ${clase}`} style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const ConfigCard: React.FC<{ onGuardado: (r: { ok: boolean; mensaje: string }) => void }> = ({ onGuardado }) => {
  const { isDemo } = useAuth();
  const api = useComandas();
  const [nombre, setNombre] = useState('');
  const [mesas, setMesas] = useState('10');
  useEffect(() => {
    if (isDemo) return;
    api.config().then((c) => {
      if (c) {
        setNombre(c.nombre);
        setMesas(String(c.num_mesas));
      }
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 flex flex-wrap items-end gap-3">
      <label className="space-y-1 flex-1 min-w-[180px]">
        <span className="text-xs font-semibold text-[var(--text-muted)]">Nombre del restaurante</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--border-soft)] bg-transparent" />
      </label>
      <label className="space-y-1 w-28">
        <span className="text-xs font-semibold text-[var(--text-muted)]">Mesas</span>
        <input type="number" min={1} max={100} value={mesas} onChange={(e) => setMesas(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--border-soft)] bg-transparent" />
      </label>
      <button
        type="button"
        onClick={async () => onGuardado(isDemo ? { ok: true, mensaje: 'Modo demo: no se guarda.' } : await api.guardarConfig(nombre, Number(mesas)))}
        className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] text-white font-bold cursor-pointer"
      >
        Guardar
      </button>
      <p className="w-full text-[11px] text-[var(--text-muted)]">Productos, precios, recetas y empleados se configuran en Administración (más abajo).</p>
    </div>
  );
};
