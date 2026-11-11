/**
 * Pantalla de cocina (KDS) para tablet en la pared: manos sucias u ocupadas, cero escritura.
 * - Un botón LISTO gigante por pedido (se pulsa con el nudillo).
 * - Teclado USB o numérico como "bump bar": 1–9 marca listo ese pedido, Enter el más antiguo.
 * - Color por tiempo de espera: verde, amarillo a los 10 min, rojo a los 20.
 * - Sonido (y voz opcional) cuando entra un pedido nuevo. Se refresca sola cada 10 s.
 * - "Se acabó": un toque y el plato deja de poder venderse.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Volume2, VolumeX, ChefHat, Ban, Undo2, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useOperacion } from '../services/operacion.ts';
import { Venta } from '../types.ts';
import { capitalizeFirst } from '../utils/formatters.ts';

type Estacion = 'cocina' | 'parrilla' | 'todas';

interface Pedido {
  clave: string;
  titulo: string;
  items: Venta[];
  desde: number; // ms del ítem más antiguo
  enPreparacion: boolean;
}

const minutosDesde = (ms: number, ahora: number) => Math.max(0, Math.floor((ahora - ms) / 60000));

function colorTiempo(min: number) {
  if (min >= 20) return { barra: 'bg-rose-600', texto: 'text-rose-600 dark:text-rose-400', borde: 'border-rose-600' };
  if (min >= 10) return { barra: 'bg-amber-500', texto: 'text-amber-600 dark:text-amber-400', borde: 'border-amber-500' };
  return { barra: 'bg-emerald-600', texto: 'text-emerald-700 dark:text-emerald-400', borde: 'border-emerald-600' };
}

function tituloPedido(v: Venta): string {
  if (v.tipo_pedido === 'domicilio') return `Domicilio${v.cliente ? ` · ${v.cliente}` : ''}`;
  if (v.tipo_pedido === 'para_llevar') return 'Para llevar';
  return v.mesa || 'Mesa';
}

function pitar() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
  } catch {
    /* sin audio */
  }
}

function decir(texto: string) {
  try {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-CO';
    window.speechSynthesis.speak(u);
  } catch {
    /* sin voz */
  }
}

export const CocinaTab: React.FC = () => {
  const { ventas, productos, updateOrderStatus, reloadVentasEInventario, loadAllData, showNotification } = useData();
  const { rol, isDemo } = useAuth();
  const { marcarDisponible, pedidosCocina, estadoVenta } = useOperacion();
  // Pedidos activos propios: el panel solo carga las últimas 50 ventas y en un día movido se perderían
  const [remotos, setRemotos] = useState<Venta[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const fuente = isDemo ? ventas : remotos;
  const [estacion, setEstacion] = useState<Estacion>(rol === 'parrilla' ? 'parrilla' : rol === 'cocina' ? 'cocina' : 'todas');
  const [ahora, setAhora] = useState(Date.now());
  const [sonido, setSonido] = useState(false);
  const [voz, setVoz] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [verAgotar, setVerAgotar] = useState(false);
  const vistos = useRef<Set<string> | null>(null);

  // Refresco automático: la tablet de cocina no tiene quién recargue la página
  const cargar = useCallback(async () => {
    if (isDemo) return;
    try {
      setRemotos(await pedidosCocina());
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Sin conexión con la base.');
    }
  }, [isDemo, pedidosCocina]);

  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 10_000);
    const r = setInterval(() => setAhora(Date.now()), 15_000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deEstacion = useCallback(
    (v: Venta) => estacion === 'todas' || (v.estacion ?? 'cocina') === estacion,
    [estacion]
  );

  const pedidos = useMemo<Pedido[]>(() => {
    const activos = fuente.filter((v) => (v.estado === 'nuevo' || v.estado === 'en_cocina') && v.estacion !== 'bar' && deEstacion(v));
    const grupos = new Map<string, Pedido>();
    for (const v of activos) {
      // Un pedido = su comanda; las ventas antiguas sin comanda se agrupan por mesa
      const clave = v.comanda_id || `${v.tipo_pedido}|${v.tipo_pedido === 'mesa' ? v.mesa : v.id_operacion}`;
      const ms = new Date(v.created_at || v.fecha).getTime();
      const g = grupos.get(clave) ?? { clave, titulo: tituloPedido(v), items: [], desde: ms, enPreparacion: false };
      g.items.push(v);
      g.desde = Math.min(g.desde, ms);
      g.enPreparacion ||= v.estado === 'en_cocina';
      grupos.set(clave, g);
    }
    return [...grupos.values()].sort((a, b) => a.desde - b.desde);
  }, [fuente, deEstacion]);

  const listos = useMemo(
    () => [...fuente].reverse().filter((v) => v.estado === 'listo' && deEstacion(v) && v.estacion !== 'bar').slice(0, 4),
    [fuente, deEstacion]
  );

  // Aviso de pedido nuevo (no suena con lo que ya estaba al abrir la pantalla)
  useEffect(() => {
    const ids = new Set(pedidos.flatMap((p) => p.items.map((i) => i.id_operacion)));
    if (vistos.current) {
      const nuevos = pedidos.filter((p) => p.items.some((i) => !vistos.current!.has(i.id_operacion)));
      if (nuevos.length) {
        if (sonido) pitar();
        if (voz) decir(`Nuevo pedido, ${nuevos.map((n) => n.titulo).join(', ')}`);
      }
    }
    vistos.current = ids;
  }, [pedidos, sonido, voz]);

  const marcar = useCallback(
    async (p: Pedido, estado: 'en_cocina' | 'listo') => {
      if (ocupado) return;
      setOcupado(p.clave);
      try {
        if (isDemo) {
          for (const it of p.items) await updateOrderStatus(it.id_operacion, estado);
        } else {
          // Un solo aviso por pedido, no uno por producto
          const fallos: string[] = [];
          for (const it of p.items) {
            const r = await estadoVenta(it.id_operacion, estado).catch((e: Error) => ({ ok: false, mensaje: e.message }));
            if (!r.ok) fallos.push(r.mensaje);
          }
          showNotification(
            fallos.length
              ? { ok: false, mensaje: fallos[0] }
              : { ok: true, mensaje: `${p.titulo}: ${estado === 'listo' ? 'LISTO' : 'en preparación'}.` }
          );
          await cargar();
          void reloadVentasEInventario();
        }
        if (estado === 'listo' && voz) decir(`${p.titulo} listo`);
      } finally {
        setOcupado(null);
      }
    },
    [ocupado, updateOrderStatus, voz, isDemo, estadoVenta, showNotification, cargar, reloadVentasEInventario]
  );

  // "Bump bar": teclado numérico USB barato, sin tocar la pantalla
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && pedidos[n - 1]) {
        e.preventDefault();
        void marcar(pedidos[n - 1], 'listo');
      } else if ((e.key === 'Enter' || e.key === ' ') && pedidos[0]) {
        e.preventDefault();
        void marcar(pedidos[0], 'listo');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pedidos, marcar]);

  const platosEstacion = useMemo(
    () => productos.filter((p) => p.activo && p.estacion !== 'bar' && (estacion === 'todas' || (p.estacion ?? 'cocina') === estacion)),
    [productos, estacion]
  );

  const toggleDisponible = async (nombre: string, disponible: boolean) => {
    const res = await marcarDisponible(nombre, disponible);
    showNotification(res);
    if (res.ok) await loadAllData();
  };

  const pantallaCompleta = () => {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="px-3 sm:px-6 py-4 space-y-4 pb-24 sm:pb-8">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ChefHat className="w-7 h-7 text-[var(--brand-accent)]" />
          <h2 className="text-2xl font-extrabold tracking-tight">Pedidos en cocina</h2>
          <span className="px-3 py-1 rounded-full bg-[var(--brand-accent)] text-white font-extrabold">{pedidos.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rol === 'admin' && (
            <div className="flex rounded-xl border border-[var(--border-soft)] overflow-hidden">
              {(['todas', 'cocina', 'parrilla'] as Estacion[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEstacion(e)}
                  className={`px-3 py-2 text-sm font-bold cursor-pointer ${estacion === e ? 'bg-[var(--brand-accent)] text-white' : ''}`}
                >
                  {capitalizeFirst(e)}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              const nuevo = !sonido;
              setSonido(nuevo);
              if (nuevo) pitar(); // el navegador exige un toque para habilitar el audio
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold cursor-pointer ${sonido ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[var(--border-soft)]'}`}
          >
            {sonido ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} Sonido
          </button>
          <button
            type="button"
            onClick={() => setVoz((v) => !v)}
            className={`px-3 py-2 rounded-xl border text-sm font-bold cursor-pointer ${voz ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[var(--border-soft)]'}`}
          >
            Voz
          </button>
          <button
            type="button"
            onClick={() => setVerAgotar((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-bold cursor-pointer ${verAgotar ? 'bg-rose-600 border-rose-600 text-white' : 'border-[var(--border-soft)]'}`}
          >
            <Ban className="w-4 h-4" /> Se acabó
          </button>
          <button type="button" onClick={pantallaCompleta} className="p-2 rounded-xl border border-[var(--border-soft)] cursor-pointer" title="Pantalla completa">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* "Se acabó": un toque saca el plato del menú del mesero */}
      {verAgotar && (
        <div className="rounded-2xl border-2 border-rose-500/40 bg-rose-500/5 p-4">
          <p className="text-sm font-semibold mb-3">Toca un plato para marcarlo agotado (o para volver a ofrecerlo). La caja y las meseras ya no podrán venderlo.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {platosEstacion.map((p) => (
              <button
                key={p.nombre}
                type="button"
                onClick={() => void toggleDisponible(p.nombre, !p.disponible)}
                className={`px-3 py-4 rounded-xl text-sm font-extrabold border-2 cursor-pointer text-left ${
                  p.disponible ? 'border-[var(--border-soft)] bg-[var(--bg-card)]' : 'border-rose-600 bg-rose-600 text-white line-through'
                }`}
              >
                {capitalizeFirst(p.nombre)}
                <span className="block text-[11px] font-semibold no-underline opacity-80">{p.disponible ? 'Disponible' : 'AGOTADO'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {errorCarga && <p className="p-3 rounded-xl bg-rose-500/10 text-rose-600 text-sm font-semibold">Sin conexión: {errorCarga}. Se reintenta solo.</p>}

      {pedidos.length === 0 && (
        <div className="text-center py-20 text-[var(--text-muted)]">
          <p className="text-3xl font-extrabold">Sin pedidos pendientes</p>
          <p className="mt-2 text-sm">Se actualiza solo cada 10 segundos. Atajos de teclado: 1–9 o Enter = LISTO.</p>
        </div>
      )}

      {/* Tarjetas de pedido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {pedidos.map((p, idx) => {
          const min = minutosDesde(p.desde, ahora);
          const c = colorTiempo(min);
          return (
            <div key={p.clave} className={`rounded-3xl border-4 ${c.borde} bg-[var(--bg-card)] overflow-hidden flex flex-col`}>
              <div className={`${c.barra} text-white px-5 py-3 flex items-center justify-between`}>
                <span className="text-xl font-extrabold">
                  {idx < 9 && <span className="mr-2 inline-flex w-8 h-8 items-center justify-center rounded-lg bg-black/25">{idx + 1}</span>}
                  {p.titulo}
                </span>
                <span className="text-lg font-extrabold tabular-nums">{min} min</span>
              </div>
              <div className="px-5 py-4 space-y-3 flex-1">
                {p.items.map((it) => (
                  <div key={it.id_operacion}>
                    <p className="text-2xl font-extrabold leading-tight">
                      {it.cantidad}× {capitalizeFirst(it.plato)}
                      {it.tamano_porcion === 'media' && <span className="text-[var(--brand-accent)]"> (media)</span>}
                    </p>
                    <p className={`text-base font-bold ${c.texto}`}>
                      {[
                        it.acompanamiento,
                        it.con_ensalada === false && it.categoria !== 'bebidas' ? 'SIN ENSALADA' : null,
                        it.con_salsas === false && it.categoria !== 'bebidas' ? 'SIN SALSAS' : null,
                        it.notas,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {!p.enPreparacion && (
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => void marcar(p, 'en_cocina')}
                    className="py-6 rounded-2xl border-2 border-[var(--border-soft)] text-lg font-extrabold cursor-pointer disabled:opacity-50"
                  >
                    Empezar
                  </button>
                )}
                <button
                  type="button"
                  disabled={ocupado !== null}
                  onClick={() => void marcar(p, 'listo')}
                  className={`${p.enPreparacion ? 'col-span-3' : 'col-span-2'} py-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-4xl font-black tracking-wide cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {ocupado === p.clave && <Loader2 className="w-8 h-8 animate-spin" />} LISTO
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Últimos listos, por si se tocó por error */}
      {listos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Listos recientes:</span>
          {listos.map((v) => (
            <button
              key={v.id_operacion}
              type="button"
              onClick={async () => {
                if (isDemo) return void updateOrderStatus(v.id_operacion, 'en_cocina');
                showNotification(await estadoVenta(v.id_operacion, 'en_cocina').catch((e: Error) => ({ ok: false, mensaje: e.message })));
                await cargar();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-soft)] text-xs font-bold cursor-pointer"
              title="Devolver a preparación"
            >
              <Undo2 className="w-3.5 h-3.5" /> {tituloPedido(v)} · {v.cantidad}× {capitalizeFirst(v.plato)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
