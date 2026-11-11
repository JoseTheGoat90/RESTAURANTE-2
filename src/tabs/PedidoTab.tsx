/**
 * Tomar pedido como mesero: mesa → productos con un toque → enviar a cocina/parrilla.
 * Una comanda puede tener varios productos; se le pueden agregar más mientras la mesa esté abierta,
 * y caja la cobra completa. Todo pasa por las funciones de la base (migración 008).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Trash2, Send, Wallet, X, MessageSquarePlus, Loader2, RefreshCw, Bike, ShoppingBag, Armchair, CheckCheck, ListPlus } from 'lucide-react';
import { useData, precioDeProducto } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Producto, TipoPedido, MetodoPago, Venta } from '../types.ts';
import { formatCOP, capitalizeFirst, generateOperationId } from '../utils/formatters.ts';
import { ComandaAbierta, ConfigRestaurante, ItemComanda, useComandas } from '../services/comandas.ts';
import { ComprobanteModal, ComprobantePendiente, METODOS_CON_COMPROBANTE } from '../components/ComprobanteModal.tsx';
import { VenderTab, ACOMPANAMIENTOS_PRESET } from './VenderTab.tsx';

type Vista = 'nuevo' | 'abiertas' | 'historial';

interface Linea extends ItemComanda {
  key: string;
  precio: number;
  categoria: string;
}

const METODOS: { id: MetodoPago; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
];

const ESTADO_CHIP: Record<string, string> = {
  nuevo: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  en_cocina: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  listo: 'bg-emerald-600 text-white',
  en_camino: 'bg-sky-600 text-white',
  entregado: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  cancelado: 'bg-rose-500/15 text-rose-600 line-through',
  pagado: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', // ventas antiguas: "pagado" equivalía a entregado
};
const ESTADO_TXT: Record<string, string> = {
  nuevo: 'Pendiente', en_cocina: 'Preparando', listo: 'LISTO', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado',
  pagado: 'Entregado',
};

const ORDEN_CATEGORIAS = ['almuerzos', 'asados', 'bebidas'];

function minutosDesde(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Modo demo: las comandas abiertas se arman con las ventas guardadas en el navegador. */
function abiertasDesdeVentas(ventas: Venta[]): ComandaAbierta[] {
  const hace24h = Date.now() - 24 * 3600 * 1000;
  const grupos = new Map<string, ComandaAbierta>();
  for (const v of ventas) {
    if (new Date(v.created_at || v.fecha).getTime() < hace24h) continue;
    const clave = v.comanda_id || (v.tipo_pedido === 'mesa' && v.mesa ? `mesa|${v.mesa}` : v.id_operacion);
    const g = grupos.get(clave) ?? {
      comanda_id: clave, tipo_pedido: v.tipo_pedido || 'mesa', mesa: v.mesa ?? null, cliente: v.cliente ?? null,
      direccion: v.direccion_domicilio ?? null, telefono: v.telefono_contacto ?? null, domiciliario: v.domiciliario ?? null,
      desde: v.created_at || v.fecha, registrado_por: v.registrado_por ?? null, total: 0, por_cobrar: 0, items: [],
    };
    const estado = v.estado || 'entregado';
    const pago = v.pago_estado || 'pendiente';
    g.items.push({ id: v.id_operacion, plato: v.plato, cantidad: v.cantidad, total: v.total, estado, pago_estado: pago,
      tamano_porcion: v.tamano_porcion ?? null, notas: v.notas ?? null, estacion: v.estacion ?? null });
    if (estado !== 'cancelado') {
      g.total += v.total;
      if (pago !== 'pagado') g.por_cobrar += v.total;
    }
    grupos.set(clave, g);
  }
  return [...grupos.values()].filter((g) =>
    g.items.some((i) => i.estado !== 'cancelado' && (i.pago_estado !== 'pagado' || i.estado !== 'entregado'))
  );
}

export const PedidoTab: React.FC = () => {
  const { productos, ventas, executeSale, updateOrderStatus, showNotification, reloadVentasEInventario } = useData();
  const { rol, isDemo } = useAuth();
  const api = useComandas();
  const esCaja = rol === 'admin';

  const [vista, setVista] = useState<Vista>('nuevo');
  const [tipo, setTipo] = useState<TipoPedido>(rol === 'domicilios' ? 'domicilio' : 'mesa');
  const [mesa, setMesa] = useState<string | null>(null);
  const [cliente, setCliente] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [categoria, setCategoria] = useState<string>('almuerzos');
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [agregarA, setAgregarA] = useState<ComandaAbierta | null>(null);
  const [config, setConfig] = useState<ConfigRestaurante>({ nombre: 'Restaurante', num_mesas: 10 });
  const [abiertasRemotas, setAbiertasRemotas] = useState<ComandaAbierta[]>([]);
  const [cargandoAbiertas, setCargandoAbiertas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [asado, setAsado] = useState<Producto | null>(null);
  const [comprobante, setComprobante] = useState<ComprobantePendiente | null>(null);
  const [cobrando, setCobrando] = useState<ComandaAbierta | null>(null);

  const abiertas = isDemo ? abiertasDesdeVentas(ventas) : abiertasRemotas;

  const cargarAbiertas = useCallback(async () => {
    if (isDemo) return;
    setCargandoAbiertas(true);
    try {
      setAbiertasRemotas(await api.comandasAbiertas());
    } catch (e) {
      showNotification({ ok: false, mensaje: e instanceof Error ? e.message : 'No se pudieron cargar las mesas abiertas.' });
    } finally {
      setCargandoAbiertas(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) return;
    api.config().then((c) => c && setConfig(c)).catch(() => undefined);
    void cargarAbiertas();
    const t = setInterval(() => void cargarAbiertas(), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  // ---------- Catálogo ----------
  const activos = useMemo(() => productos.filter((p) => p.activo), [productos]);
  const categorias = useMemo(() => {
    const set = new Set(activos.map((p) => p.categoria as string));
    return [...ORDEN_CATEGORIAS.filter((c) => set.has(c)), ...[...set].filter((c) => !ORDEN_CATEGORIAS.includes(c))];
  }, [activos]);
  useEffect(() => {
    if (categorias.length && !categorias.includes(categoria)) setCategoria(categorias[0]);
  }, [categorias, categoria]);

  const tipoEfectivo: TipoPedido = (agregarA?.tipo_pedido as TipoPedido) || tipo;

  const agregar = (p: Producto, extra?: Partial<ItemComanda>) => {
    const tamano = extra?.tamano_porcion;
    const precio = precioDeProducto(p, tipoEfectivo, p.categoria === 'asados' ? tamano ?? 'entera' : undefined);
    if (!precio) {
      showNotification({ ok: false, mensaje: `"${capitalizeFirst(p.nombre)}" no tiene precio configurado. Pídelo a administración.` });
      return;
    }
    const key = [p.nombre, tamano, extra?.acompanamiento, extra?.con_ensalada, extra?.con_salsas].join('|');
    setCarrito((c) => {
      const i = c.findIndex((l) => l.key === key && !l.notas);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...c, { key, plato: p.nombre, cantidad: 1, precio, categoria: p.categoria, ...extra }];
    });
  };

  const tocarProducto = (p: Producto) => {
    if (!p.disponible) return showNotification({ ok: false, mensaje: `${capitalizeFirst(p.nombre)} está agotado hoy.` });
    if (p.categoria === 'asados') setAsado(p);
    else agregar(p);
  };

  const cambiarCantidad = (key: string, d: number) =>
    setCarrito((c) => c.flatMap((l) => (l.key === key ? (l.cantidad + d <= 0 ? [] : [{ ...l, cantidad: l.cantidad + d }]) : [l])));

  const notaLinea = (key: string) => {
    const l = carrito.find((x) => x.key === key);
    const n = window.prompt('Nota para cocina (ej.: sin cebolla, bien asado):', l?.notas ?? '');
    if (n === null) return;
    setCarrito((c) => c.map((x) => (x.key === key ? { ...x, notas: n.trim() || undefined, key: x.key.split('#')[0] + (n.trim() ? `#${n.trim()}` : '') } : x)));
  };

  // Al cambiar de modalidad se recalculan los precios del carrito
  useEffect(() => {
    setCarrito((c) =>
      c.map((l) => {
        const p = productos.find((x) => x.nombre === l.plato);
        const precio = p ? precioDeProducto(p, tipoEfectivo, p.categoria === 'asados' ? l.tamano_porcion ?? 'entera' : undefined) : null;
        return precio ? { ...l, precio } : l;
      })
    );
  }, [tipoEfectivo, productos]);

  const total = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const mesasOcupadas = useMemo(() => {
    const m = new Map<string, ComandaAbierta>();
    abiertas.filter((a) => a.tipo_pedido === 'mesa' && a.mesa).forEach((a) => m.set(a.mesa!, a));
    return m;
  }, [abiertas]);

  const limpiar = () => {
    setCarrito([]);
    setNotas('');
    setAgregarA(null);
    if (tipo === 'mesa') setMesa(null);
    else {
      setCliente('');
      setDireccion('');
      setTelefono('');
    }
  };

  // ---------- Enviar ----------
  const enviar = async (cobrar: boolean) => {
    if (!carrito.length) return;
    if (!agregarA && tipo === 'mesa' && !mesa) return showNotification({ ok: false, mensaje: 'Elige la mesa.' });
    if (!agregarA && tipo === 'domicilio' && !direccion.trim()) return showNotification({ ok: false, mensaje: 'Escribe la dirección del domicilio.' });
    setEnviando(true);
    const lote = generateOperationId('CMD');
    const items: ItemComanda[] = carrito.map(({ key: _k, precio: _p, categoria: _c, ...it }) => it);
    try {
      let res;
      if (isDemo) {
        for (const [i, it] of items.entries()) {
          const r = await executeSale({
            p_id: `${lote}-${i + 1}`, p_plato: it.plato, p_cantidad: it.cantidad, p_precio_unitario: carrito[i].precio,
            tamano_porcion: it.tamano_porcion, estado: cobrar ? 'pagado' : 'nuevo', tipo_pedido: tipoEfectivo,
            mesa: agregarA?.mesa ?? (tipo === 'mesa' ? mesa ?? undefined : undefined),
            direccion_domicilio: direccion || undefined, telefono_contacto: telefono || undefined, cliente: cliente || undefined,
            p_acompanamiento: it.acompanamiento, p_con_ensalada: it.con_ensalada, p_con_salsas: it.con_salsas, metodo_pago: metodo,
          });
          if (!r.ok) {
            res = r;
            break;
          }
        }
        res = res ?? { ok: true, mensaje: `Pedido enviado (demo): ${items.length} producto(s) por ${formatCOP(total)}.` };
      } else {
        res = await api.registrarComanda({
          lote, items, tipo_pedido: tipoEfectivo, mesa: tipo === 'mesa' ? mesa ?? undefined : undefined, cliente, direccion, telefono,
          notas, cobrar, metodo_pago: metodo, comanda_id: agregarA?.comanda_id,
        });
      }
      showNotification(res);
      if (res.ok) {
        const comandaId = (res as { comanda_id?: string }).comanda_id ?? agregarA?.comanda_id ?? lote;
        if (cobrar && METODOS_CON_COMPROBANTE.includes(metodo))
          setComprobante({ ventaId: comandaId, total, metodo, descripcion: `${items.length} producto(s)` });
        limpiar();
        void reloadVentasEInventario();
        void cargarAbiertas();
      }
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Acciones sobre comandas abiertas ----------
  const accionComanda = async (c: ComandaAbierta, estado: string) => {
    let res;
    if (isDemo) {
      for (const it of c.items.filter((i) => i.estado === 'listo' || i.estado === 'en_camino')) await updateOrderStatus(it.id, estado as never);
      res = { ok: true, mensaje: 'Actualizado (demo).' };
    } else res = await api.estadoComanda(c.comanda_id, estado);
    showNotification(res);
    void reloadVentasEInventario();
    void cargarAbiertas();
  };

  const cobrar = async (c: ComandaAbierta, m: MetodoPago) => {
    setCobrando(null);
    let res;
    if (isDemo) {
      for (const it of c.items.filter((i) => i.pago_estado !== 'pagado' && i.estado !== 'cancelado'))
        await updateOrderStatus(it.id, 'pagado', { metodo_pago: m });
      res = { ok: true, mensaje: `Cobrado ${formatCOP(c.por_cobrar)} (demo).` };
    } else res = await api.cobrarComanda(c.comanda_id, m);
    showNotification(res);
    if (res.ok && METODOS_CON_COMPROBANTE.includes(m))
      setComprobante({ ventaId: c.comanda_id, total: c.por_cobrar, metodo: m, descripcion: tituloComanda(c) });
    void reloadVentasEInventario();
    void cargarAbiertas();
  };

  const visibles = activos.filter((p) => p.categoria === categoria);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4 pb-28 sm:pb-8">
      {/* Sub-pestañas */}
      <div className="flex gap-2 overflow-x-auto">
        {([
          ['nuevo', agregarA ? `Agregar a ${tituloComanda(agregarA)}` : 'Nuevo pedido'],
          ['abiertas', `Mesas abiertas (${abiertas.length})`],
          ['historial', 'Historial y comandas'],
        ] as [Vista, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap cursor-pointer border ${
              vista === id ? 'bg-[var(--brand-accent)] text-white border-transparent' : 'bg-[var(--bg-card)] border-[var(--border-soft)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'historial' && <VenderTab />}

      {vista === 'abiertas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">Pedidos sin cobrar o sin entregar. Se actualiza cada 15 s.</p>
            <button type="button" onClick={() => void cargarAbiertas()} className="p-2 rounded-xl border border-[var(--border-soft)] cursor-pointer" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${cargandoAbiertas ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {!abiertas.length && <p className="text-center py-16 text-[var(--text-muted)] font-semibold">No hay mesas abiertas.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {abiertas.map((c) => {
              const hayListos = c.items.some((i) => i.estado === 'listo');
              return (
                <div key={c.comanda_id} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold">{tituloComanda(c)}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        hace {minutosDesde(c.desde)} min{c.registrado_por ? ` · ${c.registrado_por}` : ''}
                        {c.tipo_pedido === 'domicilio' && c.direccion ? ` · ${c.direccion}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold">{formatCOP(c.total)}</p>
                      {c.por_cobrar > 0 ? (
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Por cobrar {formatCOP(c.por_cobrar)}</p>
                      ) : (
                        <p className="text-xs font-bold text-emerald-600">Cobrado</p>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {c.items.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className={i.estado === 'cancelado' ? 'line-through opacity-60' : ''}>
                          {i.cantidad}× {capitalizeFirst(i.plato)}
                          {i.tamano_porcion === 'media' && ' (media)'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${ESTADO_CHIP[i.estado] ?? ''}`}>{ESTADO_TXT[i.estado] ?? i.estado}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAgregarA(c);
                        setVista('nuevo');
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-soft)] text-sm font-bold cursor-pointer"
                    >
                      <ListPlus className="w-4 h-4" /> Agregar
                    </button>
                    {hayListos && rol !== 'domiciliario' && (
                      <button type="button" onClick={() => void accionComanda(c, 'entregado')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold cursor-pointer">
                        <CheckCheck className="w-4 h-4" /> Entregado
                      </button>
                    )}
                    {esCaja && c.por_cobrar > 0 && (
                      <button type="button" onClick={() => setCobrando(c)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">
                        <Wallet className="w-4 h-4" /> Cobrar {formatCOP(c.por_cobrar)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === 'nuevo' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
          <div className="space-y-4">
            {/* Modalidad y mesa */}
            {agregarA ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--brand-accent)] bg-[var(--brand-accent)]/5 px-4 py-3">
                <p className="font-bold">Agregando productos a {tituloComanda(agregarA)}</p>
                <button type="button" onClick={() => setAgregarA(null)} className="text-sm font-bold underline cursor-pointer">Cancelar</button>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['mesa', 'Mesa', Armchair],
                    ['para_llevar', 'Para llevar', ShoppingBag],
                    ['domicilio', 'Domicilio', Bike],
                  ] as [TipoPedido, string, React.ElementType][]).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTipo(id)}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-extrabold border-2 cursor-pointer ${
                        tipo === id ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white' : 'border-[var(--border-soft)]'
                      }`}
                    >
                      <Icon className="w-5 h-5" /> {label}
                    </button>
                  ))}
                </div>
                {tipo === 'mesa' && (
                  <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2">
                    {Array.from({ length: config.num_mesas }, (_, i) => `Mesa ${i + 1}`).map((m) => {
                      const ocupada = mesasOcupadas.get(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => (ocupada ? setAgregarA(ocupada) : setMesa(m))}
                          title={ocupada ? `Ocupada · ${formatCOP(ocupada.total)} · toca para agregar` : m}
                          className={`aspect-square rounded-xl text-lg font-extrabold border-2 cursor-pointer ${
                            mesa === m
                              ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white'
                              : ocupada
                                ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'border-[var(--border-soft)]'
                          }`}
                        >
                          {m.replace('Mesa ', '')}
                        </button>
                      );
                    })}
                  </div>
                )}
                {tipo === 'domicilio' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente" className="px-3 py-2.5 rounded-xl border border-[var(--border-soft)] bg-transparent" />
                    <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección *" className="px-3 py-2.5 rounded-xl border border-[var(--border-soft)] bg-transparent" />
                    <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" inputMode="tel" className="px-3 py-2.5 rounded-xl border border-[var(--border-soft)] bg-transparent" />
                  </div>
                )}
                {tipo === 'mesa' && <p className="text-xs text-[var(--text-muted)]">Mesas en amarillo están ocupadas: tócala para agregarle productos.</p>}
              </div>
            )}

            {/* Catálogo */}
            <div className="flex gap-2 overflow-x-auto">
              {categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap cursor-pointer border ${
                    categoria === c ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-transparent' : 'border-[var(--border-soft)]'
                  }`}
                >
                  {capitalizeFirst(c)}
                </button>
              ))}
            </div>
            {!activos.length && <p className="text-sm text-[var(--text-muted)]">No hay productos activos. Administración los crea en Resumen › Administración.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {visibles.map((p) => {
                const precio = p.categoria === 'asados' ? null : precioDeProducto(p, tipoEfectivo);
                return (
                  <button
                    key={p.nombre}
                    type="button"
                    onClick={() => tocarProducto(p)}
                    className={`text-left rounded-2xl border-2 p-3 min-h-[92px] flex flex-col justify-between cursor-pointer transition-transform active:scale-[0.97] ${
                      p.disponible ? 'border-[var(--border-soft)] bg-[var(--bg-card)] hover:border-[var(--brand-accent)]' : 'border-rose-500/40 bg-rose-500/5 opacity-60'
                    }`}
                  >
                    <span className="font-extrabold leading-tight">{capitalizeFirst(p.nombre)}</span>
                    <span className="text-sm font-bold text-[var(--brand-accent)]">
                      {!p.disponible
                        ? 'Agotado'
                        : p.categoria === 'asados'
                          ? `${p.precio_media ? formatCOP(p.precio_media) + ' / ' : ''}${p.precio ? formatCOP(p.precio) : 'sin precio'}`
                          : precio
                            ? formatCOP(precio)
                            : 'Sin precio'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Carrito */}
          <div className="lg:sticky lg:top-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {agregarA ? tituloComanda(agregarA) : tipo === 'mesa' ? mesa ?? 'Elige mesa' : tipo === 'para_llevar' ? 'Para llevar' : 'Domicilio'}
              </h3>
              {carrito.length > 0 && (
                <button type="button" onClick={() => setCarrito([])} className="text-xs font-bold text-rose-600 cursor-pointer">Vaciar</button>
              )}
            </div>
            {!carrito.length && <p className="text-sm text-[var(--text-muted)] py-6 text-center">Toca los productos para agregarlos.</p>}
            <ul className="space-y-2 max-h-[45vh] overflow-y-auto">
              {carrito.map((l) => (
                <li key={l.key} className="rounded-xl bg-black/5 dark:bg-white/5 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {capitalizeFirst(l.plato)}
                        {l.tamano_porcion && ` (${l.tamano_porcion})`}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {[l.acompanamiento, l.con_ensalada === false ? 'sin ensalada' : null, l.con_salsas === false ? 'sin salsas' : null, l.notas].filter(Boolean).join(' · ') ||
                          formatCOP(l.precio)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => notaLinea(l.key)} className="p-1.5 rounded-lg cursor-pointer" title="Nota para cocina"><MessageSquarePlus className="w-4 h-4" /></button>
                      <button type="button" onClick={() => cambiarCantidad(l.key, -1)} className="w-8 h-8 rounded-lg border border-[var(--border-soft)] flex items-center justify-center cursor-pointer">
                        {l.cantidad === 1 ? <Trash2 className="w-4 h-4 text-rose-600" /> : <Minus className="w-4 h-4" />}
                      </button>
                      <span className="w-6 text-center font-extrabold">{l.cantidad}</span>
                      <button type="button" onClick={() => cambiarCantidad(l.key, 1)} className="w-8 h-8 rounded-lg border border-[var(--border-soft)] flex items-center justify-center cursor-pointer"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {carrito.length > 0 && (
              <>
                <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Nota general (opcional)" className="w-full px-3 py-2 rounded-xl border border-[var(--border-soft)] bg-transparent text-sm" />
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-[var(--text-muted)]">Total</span>
                  <span className="text-2xl font-black">{formatCOP(total)}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">El precio final lo confirma la base según la modalidad.</p>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void enviar(false)}
                  className="w-full py-4 rounded-2xl bg-[var(--brand-accent)] text-white text-lg font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {agregarA ? 'Agregar a la comanda' : 'Enviar a cocina'}
                </button>
                {esCaja && !agregarA && (
                  <div className="space-y-2 rounded-xl border border-dashed border-[var(--border-soft)] p-2.5">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">Caja: cobrar ya (igual pasa por cocina)</p>
                    <div className="grid grid-cols-4 gap-1">
                      {METODOS.map((m) => (
                        <button key={m.id} type="button" onClick={() => setMetodo(m.id)} className={`py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${metodo === m.id ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[var(--border-soft)]'}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" disabled={enviando} onClick={() => void enviar(true)} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                      <Wallet className="w-4 h-4" /> Enviar y cobrar {formatCOP(total)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Asado: presentación y acompañamiento */}
      {asado && <OpcionesAsado producto={asado} tipo={tipoEfectivo} onCerrar={() => setAsado(null)} onAgregar={(extra) => { agregar(asado, extra); setAsado(null); }} />}

      {/* Elegir medio de pago para cobrar una comanda */}
      {cobrando && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setCobrando(null)}>
          <div className="bg-[var(--bg-card)] w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">Cobrar {tituloComanda(cobrando)}</h3>
            <p className="text-3xl font-black">{formatCOP(cobrando.por_cobrar)}</p>
            <div className="grid grid-cols-2 gap-2">
              {METODOS.map((m) => (
                <button key={m.id} type="button" onClick={() => void cobrar(cobrando, m.id)} className="py-4 rounded-2xl border-2 border-[var(--border-soft)] font-extrabold hover:bg-emerald-600 hover:text-white hover:border-emerald-600 cursor-pointer">
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {comprobante && <ComprobanteModal pendiente={comprobante} onCerrar={() => setComprobante(null)} />}
    </div>
  );
};

function tituloComanda(c: ComandaAbierta) {
  if (c.tipo_pedido === 'domicilio') return `Domicilio${c.cliente ? ` · ${c.cliente}` : ''}`;
  if (c.tipo_pedido === 'para_llevar') return 'Para llevar';
  return c.mesa || 'Mesa';
}

const OpcionesAsado: React.FC<{
  producto: Producto;
  tipo: TipoPedido;
  onCerrar: () => void;
  onAgregar: (extra: Partial<ItemComanda>) => void;
}> = ({ producto, tipo, onCerrar, onAgregar }) => {
  const [tamano, setTamano] = useState<'media' | 'entera'>('entera');
  const [acomp, setAcomp] = useState(ACOMPANAMIENTOS_PRESET[0]?.label ?? '');
  const [ensalada, setEnsalada] = useState(true);
  const [salsas, setSalsas] = useState(true);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onCerrar}>
      <div className="bg-[var(--bg-card)] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{capitalizeFirst(producto.nombre)}</h3>
          <button type="button" onClick={onCerrar} className="p-1.5 cursor-pointer" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['media', 'entera'] as const).map((t) => {
            const precio = precioDeProducto(producto, tipo, t);
            return (
              <button key={t} type="button" disabled={!precio} onClick={() => setTamano(t)} className={`py-4 rounded-2xl border-2 font-extrabold cursor-pointer disabled:opacity-40 ${tamano === t ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white' : 'border-[var(--border-soft)]'}`}>
                Porción {t}
                <span className="block text-sm">{precio ? formatCOP(precio) : 'sin precio'}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {ACOMPANAMIENTOS_PRESET.map((a) => (
            <button key={a.id} type="button" onClick={() => setAcomp(a.label)} className={`px-3 py-2 rounded-xl text-sm font-bold border cursor-pointer ${acomp === a.label ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-transparent' : 'border-[var(--border-soft)]'}`}>
              {a.label.replace(/\s*\(.*\)/, '')}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEnsalada((v) => !v)} className={`py-3 rounded-xl font-bold border-2 cursor-pointer ${ensalada ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-rose-500 text-rose-600'}`}>
            {ensalada ? 'Con ensalada' : 'Sin ensalada'}
          </button>
          <button type="button" onClick={() => setSalsas((v) => !v)} className={`py-3 rounded-xl font-bold border-2 cursor-pointer ${salsas ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-rose-500 text-rose-600'}`}>
            {salsas ? 'Con salsas' : 'Sin salsas'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onAgregar({ tamano_porcion: tamano, acompanamiento: acomp.startsWith('Sin') ? undefined : acomp.replace(/\s*\(.*\)/, ''), con_ensalada: ensalada, con_salsas: salsas })}
          className="w-full py-4 rounded-2xl bg-[var(--brand-accent)] text-white text-lg font-extrabold cursor-pointer"
        >
          Agregar al pedido
        </button>
      </div>
    </div>
  );
};
