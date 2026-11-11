/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Settings2, Loader2, Check } from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { formatCOP, capitalizeFirst, formatBogotaDateTime } from '../utils/formatters.ts';
import {
  fetchPerfiles,
  fetchFaltantes,
  fetchAuditoria,
  rpcGuardarProducto,
  rpcGuardarConsumo,
  rpcGuardarPerfil,
  rpcGuardarIngrediente,
  rpcAtenderFaltante,
  Perfil,
  Faltante,
  Auditoria,
} from '../services/api.ts';
import { Producto, Rol, RpcResult } from '../types.ts';

type Seccion = 'productos' | 'consumos' | 'insumos' | 'empleados' | 'faltantes' | 'historial';

const SECCIONES: { id: Seccion; label: string }[] = [
  { id: 'productos', label: 'Productos y precios' },
  { id: 'consumos', label: 'Recetas / consumos' },
  { id: 'insumos', label: 'Unidades y mínimos' },
  { id: 'empleados', label: 'Empleados' },
  { id: 'faltantes', label: 'Faltantes reportados' },
  { id: 'historial', label: 'Historial' },
];

const ROLES: { id: Rol; label: string }[] = [
  { id: 'admin', label: 'Administrador / cajero' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'parrilla', label: 'Parrilla' },
  { id: 'mesera', label: 'Mesera' },
  { id: 'domicilios', label: 'Encargado de domicilios' },
  { id: 'domiciliario', label: 'Domiciliario' },
];

const VARIANTES = [
  { id: '', label: 'Siempre' },
  { id: 'media', label: 'Porción media' },
  { id: 'entera', label: 'Porción entera' },
  { id: 'mesa', label: 'En mesa' },
  { id: 'para_llevar', label: 'Para llevar' },
  { id: 'domicilio', label: 'Domicilio' },
];

const input =
  'h-9 px-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-main)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]';
const btnSec =
  'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--bg-main)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-main)] border border-[var(--border-soft)] transition-colors cursor-pointer disabled:opacity-40';
const btnPri =
  'h-9 px-3.5 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50';

const num = (v: string): number | null => {
  const t = v.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return isNaN(n) ? NaN : n;
};

/** Panel de administración: catálogo, recetas, insumos, empleados, faltantes e historial. Solo administración. */
export const AdminPanel: React.FC = () => {
  const { productos, ingredientes, porciones, consumos, showNotification, loadAllData } = useData();
  const { getValidAccessToken, handleAuthError, isDemo } = useAuth();
  const [seccion, setSeccion] = useState<Seccion>('productos');
  const [guardando, setGuardando] = useState(false);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);

  const opts = useCallback(async () => ({ token: await getValidAccessToken(), onAuthError: handleAuthError }), [getValidAccessToken, handleAuthError]);

  const cargarListas = useCallback(async () => {
    if (isDemo) return;
    const o = await opts();
    const [p, f, a] = await Promise.allSettled([fetchPerfiles(o), fetchFaltantes(o), fetchAuditoria(o)]);
    if (p.status === 'fulfilled') setPerfiles(p.value);
    if (f.status === 'fulfilled') setFaltantes(f.value);
    if (a.status === 'fulfilled') setAuditoria(a.value);
  }, [isDemo, opts]);

  useEffect(() => {
    cargarListas();
  }, [cargarListas]);

  const ejecutar = async (fn: (o: Awaited<ReturnType<typeof opts>>) => Promise<RpcResult>): Promise<boolean> => {
    if (isDemo) {
      showNotification({ ok: false, mensaje: 'La administración solo funciona con la base de datos real.' });
      return false;
    }
    setGuardando(true);
    try {
      const res = await fn(await opts());
      showNotification(res);
      if (res.ok) await Promise.all([loadAllData(), cargarListas()]);
      return res.ok;
    } catch (err) {
      showNotification({ ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo guardar.' });
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // ---- Productos ----
  const [edicion, setEdicion] = useState<Record<string, { precio: string; llevar: string; media: string; disponible: boolean; activo: boolean }>>({});
  const filaProducto = (p: Producto) =>
    edicion[p.nombre] ?? {
      precio: p.precio != null ? String(p.precio) : '',
      llevar: p.precio_llevar != null ? String(p.precio_llevar) : '',
      media: p.precio_media != null ? String(p.precio_media) : '',
      disponible: p.disponible,
      activo: p.activo,
    };
  const editar = (p: Producto, cambio: Partial<ReturnType<typeof filaProducto>>) =>
    setEdicion((prev) => ({ ...prev, [p.nombre]: { ...filaProducto(p), ...cambio } }));

  const guardarProducto = async (p: Producto) => {
    const f = filaProducto(p);
    const precio = num(f.precio), llevar = num(f.llevar), media = num(f.media);
    if ([precio, llevar, media].some((v) => v !== null && (isNaN(v) || v < 0))) {
      showNotification({ ok: false, mensaje: 'Revisa los precios: deben ser números positivos o quedar vacíos.' });
      return;
    }
    const ok = await ejecutar((o) =>
      rpcGuardarProducto(
        { p_nombre: p.nombre, p_categoria: p.categoria, p_precio: precio, p_precio_llevar: llevar, p_precio_media: media,
          p_presentacion: p.presentacion ?? null, p_unidad: p.unidad ?? null, p_disponible: f.disponible, p_activo: f.activo },
        o
      )
    );
    if (ok) setEdicion((prev) => { const n = { ...prev }; delete n[p.nombre]; return n; });
  };

  const [nuevoProd, setNuevoProd] = useState({ nombre: '', categoria: 'almuerzos', precio: '', llevar: '', media: '', presentacion: '' });
  const crearProducto = async () => {
    const precio = num(nuevoProd.precio), llevar = num(nuevoProd.llevar), media = num(nuevoProd.media);
    if (!nuevoProd.nombre.trim()) return showNotification({ ok: false, mensaje: 'Escribe el nombre del producto.' });
    if ([precio, llevar, media].some((v) => v !== null && (isNaN(v) || v < 0))) return showNotification({ ok: false, mensaje: 'Revisa los precios.' });
    const ok = await ejecutar((o) =>
      rpcGuardarProducto(
        { p_nombre: nuevoProd.nombre, p_categoria: nuevoProd.categoria, p_precio: precio, p_precio_llevar: llevar, p_precio_media: media,
          p_presentacion: nuevoProd.presentacion.trim() || null, p_unidad: nuevoProd.categoria === 'bebidas' ? 'unidad' : null },
        o
      )
    );
    if (ok) setNuevoProd({ nombre: '', categoria: nuevoProd.categoria, precio: '', llevar: '', media: '', presentacion: '' });
  };

  // ---- Consumos ----
  const [consProducto, setConsProducto] = useState('');
  const [nuevoCons, setNuevoCons] = useState({ variante: '', tipo: 'porcion' as 'porcion' | 'ingrediente', item: '', cantidad: '' });
  const productoConsumo = consProducto || productos[0]?.nombre || '';
  const guardarConsumo = async (variante: string | null, tipo: 'porcion' | 'ingrediente', item: string, cantidad: number) =>
    ejecutar((o) => rpcGuardarConsumo({ p_producto: productoConsumo, p_variante: variante, p_tipo: tipo, p_item: item, p_cantidad: cantidad }, o));

  // ---- Insumos ----
  const [edIns, setEdIns] = useState<Record<string, { unidad: string; minimo: string }>>({});

  // ---- Empleados ----
  const [nuevoEmp, setNuevoEmp] = useState({ email: '', nombre: '', rol: 'mesera' as Rol });

  const tabla = 'w-full text-left border-collapse text-xs';
  const th = 'pb-2.5 font-bold text-[var(--text-muted)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12 }}
      className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-5 shadow-xs"
    >
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="w-4 h-4 text-[var(--brand-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text-main)]">Administración</h3>
        {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-soft)] text-xs mb-4">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeccion(s.id)}
            className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
              seccion === s.id ? 'bg-[var(--brand-accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {s.label}
            {s.id === 'faltantes' && faltantes.filter((f) => !f.atendido).length > 0 && ` (${faltantes.filter((f) => !f.atendido).length})`}
          </button>
        ))}
      </div>

      {seccion === 'productos' && (
        <div className="space-y-4">
          <p className="text-[11px] text-[var(--text-muted)]">
            Precio = en mesa (almuerzos), porción entera (asados) o precio único (bebidas). Un producto sin precio no se puede vender.
            Las ventas ya registradas conservan su precio.
          </p>
          <div className="overflow-x-auto">
            <table className={tabla}>
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className={th}>Producto</th>
                  <th className={th}>Precio</th>
                  <th className={th}>Para llevar</th>
                  <th className={th}>Porción media</th>
                  <th className={th}>Disponible</th>
                  <th className={th}>Activo</th>
                  <th className={`${th} text-right`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {productos.map((p) => {
                  const f = filaProducto(p);
                  return (
                    <tr key={p.nombre}>
                      <td className="py-2 pr-2 font-semibold text-[var(--text-main)]">
                        {capitalizeFirst(p.nombre)}
                        <span className="ml-1.5 text-[10px] text-[var(--text-muted)] font-medium">{p.categoria}</span>
                      </td>
                      <td className="py-2 pr-2"><input className={`${input} w-24 font-mono`} value={f.precio} onChange={(e) => editar(p, { precio: e.target.value })} placeholder="Sin precio" /></td>
                      <td className="py-2 pr-2">
                        {p.categoria === 'almuerzos' ? <input className={`${input} w-24 font-mono`} value={f.llevar} onChange={(e) => editar(p, { llevar: e.target.value })} placeholder="—" /> : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="py-2 pr-2">
                        {p.categoria === 'asados' ? <input className={`${input} w-24 font-mono`} value={f.media} onChange={(e) => editar(p, { media: e.target.value })} placeholder="Sin precio" /> : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="py-2"><input type="checkbox" checked={f.disponible} onChange={(e) => editar(p, { disponible: e.target.checked })} /></td>
                      <td className="py-2"><input type="checkbox" checked={f.activo} onChange={(e) => editar(p, { activo: e.target.checked })} /></td>
                      <td className="py-2 text-right">
                        <button type="button" disabled={guardando || !edicion[p.nombre]} onClick={() => guardarProducto(p)} className={btnSec}>Guardar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-[var(--border-soft)]">
            <input className={`${input} w-56`} placeholder="Nuevo producto (ej. sopa de costilla)" value={nuevoProd.nombre} onChange={(e) => setNuevoProd({ ...nuevoProd, nombre: e.target.value })} />
            <select className={input} value={nuevoProd.categoria} onChange={(e) => setNuevoProd({ ...nuevoProd, categoria: e.target.value })}>
              <option value="almuerzos">Almuerzos</option>
              <option value="asados">Asados</option>
              <option value="bebidas">Bebidas</option>
            </select>
            <input className={`${input} w-28 font-mono`} placeholder={nuevoProd.categoria === 'asados' ? 'Precio entera' : nuevoProd.categoria === 'bebidas' ? 'Precio' : 'Precio mesa'} value={nuevoProd.precio} onChange={(e) => setNuevoProd({ ...nuevoProd, precio: e.target.value })} />
            {nuevoProd.categoria === 'almuerzos' && <input className={`${input} w-28 font-mono`} placeholder="Precio llevar" value={nuevoProd.llevar} onChange={(e) => setNuevoProd({ ...nuevoProd, llevar: e.target.value })} />}
            {nuevoProd.categoria === 'asados' && <input className={`${input} w-28 font-mono`} placeholder="Precio media" value={nuevoProd.media} onChange={(e) => setNuevoProd({ ...nuevoProd, media: e.target.value })} />}
            {nuevoProd.categoria === 'bebidas' && <input className={`${input} w-28`} placeholder="Presentación" value={nuevoProd.presentacion} onChange={(e) => setNuevoProd({ ...nuevoProd, presentacion: e.target.value })} />}
            <button type="button" disabled={guardando} onClick={crearProducto} className={btnPri}>Agregar producto</button>
          </div>
        </div>
      )}

      {seccion === 'consumos' && (
        <div className="space-y-4">
          <p className="text-[11px] text-[var(--text-muted)]">
            Qué descuenta cada venta. Cada consumo va al inventario de porciones <strong>o</strong> al general, nunca a ambos.
            “Siempre” aplica a toda venta del producto; las demás opciones solo a esa porción o modalidad (por ejemplo, desechables para llevar).
          </p>
          <select className={`${input} w-72`} value={productoConsumo} onChange={(e) => setConsProducto(e.target.value)}>
            {productos.filter((p) => p.activo).map((p) => (
              <option key={p.nombre} value={p.nombre}>{capitalizeFirst(p.nombre)}</option>
            ))}
          </select>
          <table className={tabla}>
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className={th}>Cuándo</th><th className={th}>Inventario</th><th className={th}>Descuenta</th><th className={th}>Cantidad por unidad vendida</th><th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {consumos.filter((c) => c.producto === productoConsumo).map((c) => (
                <tr key={c.id}>
                  <td className="py-2">{VARIANTES.find((v) => v.id === (c.variante ?? ''))?.label}</td>
                  <td className="py-2">{c.tipo === 'porcion' ? 'Porciones' : 'General'}</td>
                  <td className="py-2 font-semibold text-[var(--text-main)]">{capitalizeFirst(c.item)}</td>
                  <td className="py-2 font-mono">{c.cantidad} {c.tipo === 'porcion' ? 'porc.' : ingredientes.find((i) => i.ingrediente === c.item)?.unidad}</td>
                  <td className="py-2 text-right">
                    <button type="button" disabled={guardando} className={btnSec} onClick={() => guardarConsumo(c.variante, c.tipo, c.item, 0)}>Quitar</button>
                  </td>
                </tr>
              ))}
              {consumos.filter((c) => c.producto === productoConsumo).length === 0 && (
                <tr><td colSpan={5} className="py-3 text-[var(--text-muted)]">Sin consumos: vender este producto no descuenta inventario.</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-[var(--border-soft)]">
            <select className={input} value={nuevoCons.variante} onChange={(e) => setNuevoCons({ ...nuevoCons, variante: e.target.value })}>
              {VARIANTES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <select className={input} value={nuevoCons.tipo} onChange={(e) => setNuevoCons({ ...nuevoCons, tipo: e.target.value as 'porcion' | 'ingrediente', item: '' })}>
              <option value="porcion">Inventario de porciones</option>
              <option value="ingrediente">Inventario general</option>
            </select>
            <select className={`${input} w-56`} value={nuevoCons.item} onChange={(e) => setNuevoCons({ ...nuevoCons, item: e.target.value })}>
              <option value="">Selecciona…</option>
              {nuevoCons.tipo === 'porcion'
                ? porciones.map((p) => <option key={p.item} value={p.item}>{capitalizeFirst(p.item)}</option>)
                : ingredientes.map((i) => <option key={i.ingrediente} value={i.ingrediente}>{capitalizeFirst(i.ingrediente)} ({i.unidad})</option>)}
            </select>
            <input className={`${input} w-24 font-mono`} placeholder="Cantidad" value={nuevoCons.cantidad} onChange={(e) => setNuevoCons({ ...nuevoCons, cantidad: e.target.value })} />
            <button
              type="button"
              disabled={guardando || !nuevoCons.item}
              className={btnPri}
              onClick={async () => {
                const c = num(nuevoCons.cantidad);
                if (c === null || isNaN(c) || c <= 0) return showNotification({ ok: false, mensaje: 'La cantidad debe ser mayor a cero.' });
                if (await guardarConsumo(nuevoCons.variante || null, nuevoCons.tipo, nuevoCons.item, c)) setNuevoCons({ ...nuevoCons, item: '', cantidad: '' });
              }}
            >
              Agregar consumo
            </button>
          </div>
        </div>
      )}

      {seccion === 'insumos' && (
        <div className="overflow-x-auto">
          <p className="text-[11px] text-[var(--text-muted)] mb-3">Unidad de medida y cantidad mínima de cada insumo (las existencias se cambian con entradas, compras o ajustes).</p>
          <table className={tabla}>
            <thead>
              <tr className="border-b border-[var(--border-soft)]"><th className={th}>Insumo</th><th className={th}>Unidad</th><th className={th}>Mínimo</th><th className={th}></th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {ingredientes.map((i) => {
                const e = edIns[i.ingrediente] ?? { unidad: i.unidad, minimo: String(i.stock_minimo) };
                return (
                  <tr key={i.ingrediente}>
                    <td className={`py-2 font-semibold ${i.unidad === 'por definir' ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text-main)]'}`}>{capitalizeFirst(i.ingrediente)}</td>
                    <td className="py-2 pr-2">
                      <select className={input} value={e.unidad} onChange={(ev) => setEdIns({ ...edIns, [i.ingrediente]: { ...e, unidad: ev.target.value } })}>
                        {Array.from(new Set([e.unidad, 'kg', 'g', 'lb', 'l', 'ml', 'unidad', 'paquete', 'bolsa', 'botella', 'porcion'])).map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2"><input className={`${input} w-24 font-mono`} value={e.minimo} onChange={(ev) => setEdIns({ ...edIns, [i.ingrediente]: { ...e, minimo: ev.target.value } })} /></td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={guardando || !edIns[i.ingrediente] || e.unidad === 'por definir'}
                        className={btnSec}
                        onClick={async () => {
                          const m = num(e.minimo);
                          if (m === null || isNaN(m) || m < 0) return showNotification({ ok: false, mensaje: 'Mínimo no válido.' });
                          const ok = await ejecutar((o) => rpcGuardarIngrediente({ p_nombre: i.ingrediente, p_unidad: e.unidad, p_minimo: m, p_categoria: i.tipo_insumo || 'otro' }, o));
                          if (ok) setEdIns((prev) => { const n = { ...prev }; delete n[i.ingrediente]; return n; });
                        }}
                      >
                        Guardar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {seccion === 'empleados' && (
        <div className="space-y-4">
          <p className="text-[11px] text-[var(--text-muted)]">
            Primero crea la cuenta (correo y contraseña) en Supabase › Authentication › Add user. Luego asígnale aquí su cargo.
            Desactivar a un empleado le quita el acceso de inmediato.
          </p>
          <table className={tabla}>
            <thead>
              <tr className="border-b border-[var(--border-soft)]"><th className={th}>Nombre</th><th className={th}>Correo</th><th className={th}>Cargo</th><th className={th}>Activo</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {perfiles.map((p) => (
                <tr key={p.email}>
                  <td className="py-2 font-semibold text-[var(--text-main)]">{p.nombre}</td>
                  <td className="py-2 text-[var(--text-muted)]">{p.email}</td>
                  <td className="py-2">
                    <select className={input} value={p.rol} disabled={guardando} onChange={(e) => ejecutar((o) => rpcGuardarPerfil({ p_email: p.email, p_nombre: p.nombre, p_rol: e.target.value as Rol, p_activo: p.activo }, o))}>
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2">
                    <input type="checkbox" checked={p.activo} disabled={guardando} onChange={(e) => ejecutar((o) => rpcGuardarPerfil({ p_email: p.email, p_nombre: p.nombre, p_rol: p.rol, p_activo: e.target.checked }, o))} />
                  </td>
                </tr>
              ))}
              {perfiles.length === 0 && <tr><td colSpan={4} className="py-3 text-[var(--text-muted)]">Aún no hay empleados con cargo asignado.</td></tr>}
            </tbody>
          </table>
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-[var(--border-soft)]">
            <input className={`${input} w-48`} placeholder="Nombre" value={nuevoEmp.nombre} onChange={(e) => setNuevoEmp({ ...nuevoEmp, nombre: e.target.value })} />
            <input className={`${input} w-56`} placeholder="Correo de su cuenta" value={nuevoEmp.email} onChange={(e) => setNuevoEmp({ ...nuevoEmp, email: e.target.value })} />
            <select className={input} value={nuevoEmp.rol} onChange={(e) => setNuevoEmp({ ...nuevoEmp, rol: e.target.value as Rol })}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <button
              type="button"
              disabled={guardando || !nuevoEmp.email.trim() || !nuevoEmp.nombre.trim()}
              className={btnPri}
              onClick={async () => {
                if (await ejecutar((o) => rpcGuardarPerfil({ p_email: nuevoEmp.email, p_nombre: nuevoEmp.nombre, p_rol: nuevoEmp.rol, p_activo: true }, o)))
                  setNuevoEmp({ email: '', nombre: '', rol: nuevoEmp.rol });
              }}
            >
              Asignar cargo
            </button>
          </div>
        </div>
      )}

      {seccion === 'faltantes' && (
        <div className="divide-y divide-[var(--border-soft)] border border-[var(--border-soft)] rounded-xl overflow-hidden">
          {faltantes.length === 0 && <div className="p-6 text-center text-xs text-[var(--text-muted)]">No hay faltantes reportados.</div>}
          {faltantes.map((f) => (
            <div key={f.id} className="p-3 flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-[var(--text-main)]">
                  {capitalizeFirst(f.item)} · {f.tipo}{f.cantidad != null ? ` · ${f.cantidad}` : ''}
                </div>
                <div className="text-[var(--text-muted)]">{f.nota} · {f.reportado_por} · {formatBogotaDateTime(f.created_at)}</div>
              </div>
              {f.atendido ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]"><Check className="w-3 h-3" />Atendido</span>
              ) : (
                <button type="button" disabled={guardando} className={btnSec} onClick={() => ejecutar((o) => rpcAtenderFaltante({ p_id: f.id }, o))}>Marcar atendido</button>
              )}
            </div>
          ))}
        </div>
      )}

      {seccion === 'historial' && (
        <div className="divide-y divide-[var(--border-soft)] border border-[var(--border-soft)] rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
          {auditoria.length === 0 && <div className="p-6 text-center text-xs text-[var(--text-muted)]">Sin operaciones registradas.</div>}
          {auditoria.map((a) => (
            <div key={a.id} className="p-3 text-xs flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-[var(--text-main)]">
                  {a.accion} {a.entidad} {a.referencia ? <span className="font-mono font-medium text-[var(--text-muted)]">{a.referencia}</span> : null}
                </div>
                <div className="text-[var(--text-muted)] truncate">
                  {Object.entries(a.detalle || {})
                    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                    .map(([k, v]) => `${k}: ${typeof v === 'number' && /total|valor|precio/.test(k) ? formatCOP(v) : v}`)
                    .join(' · ')}
                </div>
              </div>
              <div className="text-right text-[10px] text-[var(--text-muted)] shrink-0">
                <div>{a.usuario}{a.rol ? ` (${a.rol})` : ''}</div>
                <div>{formatBogotaDateTime(a.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
