/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SUPABASE_URL, SUPABASE_KEY, getChatUrl } from '../config.ts';
import {
  Ingrediente,
  Receta,
  Venta,
  Gasto,
  ConceptoGasto,
  MovimientoInventario,
  RpcResult,
  ReporteData,
  ProyeccionData,
  Producto,
  ItemPorciones,
  MovimientoPorciones,
  CajaActual,
  Rol,
  ConsumoProducto,
} from '../types.ts';

interface FetchOptions {
  token: string;
  onAuthError?: () => void;
}

async function handleResponse<T>(res: Response, onAuthError?: () => void): Promise<T> {
  if (res.status === 401) {
    if (onAuthError) onAuthError();
    throw new Error('Sesión expirada o no autorizada.');
  }

  if (!res.ok) {
    let errorMsg = `Error en la solicitud (${res.status})`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.message || errJson.error || errJson.details || errorMsg;
    } catch {
      // not JSON
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

function getSupabaseHeaders(token: string): HeadersInit {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchIngredientes({ token, onAuthError }: FetchOptions): Promise<Ingrediente[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ingredientes?select=ingrediente,unidad,stock,stock_minimo,tipo_insumo:categoria&activo=eq.true&order=ingrediente.asc`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<Ingrediente[]>(res, onAuthError);
}

export async function fetchRecetas({ token, onAuthError }: FetchOptions): Promise<Receta[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recetas?select=plato,ingrediente,cantidad,precio&order=plato.asc`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<Receta[]>(res, onAuthError);
}

export async function fetchVentas(limit = 50, { token, onAuthError }: FetchOptions): Promise<Venta[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ventas?select=id_operacion,fecha,plato,categoria,cantidad,precio_unitario,total,estado,tipo_pedido,mesa,tamano_porcion,acompanamiento,con_ensalada,con_salsas,cliente,direccion_domicilio,telefono_contacto,notas,metodo_pago,pago_estado,domiciliario,registrado_por,cobrado_por,estacion,comanda_id,created_at&order=created_at.desc&limit=${limit}`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<Venta[]>(res, onAuthError);
}

export async function fetchGastos(limit = 50, { token, onAuthError }: FetchOptions): Promise<Gasto[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?select=id_operacion,fecha,concepto,categoria,valor,periodo,metodo_pago,responsable,estado,created_at&anulado=eq.false&order=created_at.desc&limit=${limit}`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<Gasto[]>(res, onAuthError);
}

export async function fetchConceptosGasto({ token, onAuthError }: FetchOptions): Promise<ConceptoGasto[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/conceptos_gasto?select=nombre,categoria&order=nombre.asc`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<ConceptoGasto[]>(res, onAuthError);
}

export async function fetchMovimientosInventario(limit = 50, { token, onAuthError }: FetchOptions): Promise<MovimientoInventario[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_inventario?select=id,ingrediente,delta,motivo,referencia,created_at,usuario,stock_anterior,stock_nuevo&order=created_at.desc&limit=${limit}`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<MovimientoInventario[]>(res, onAuthError);
}

// RPC CALLS
export async function fetchProductos({ token, onAuthError }: FetchOptions): Promise<Producto[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/productos?select=id,nombre,categoria,precio,precio_llevar,precio_media,presentacion,unidad,disponible,activo,estacion&order=categoria.asc,nombre.asc`,
    { headers: getSupabaseHeaders(token) }
  );
  const rows = await handleResponse<Producto[]>(res, onAuthError);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return rows.map((p) => ({ ...p, precio: num(p.precio), precio_llevar: num(p.precio_llevar), precio_media: num(p.precio_media) }));
}

export async function fetchPorciones({ token, onAuthError }: FetchOptions): Promise<ItemPorciones[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_porciones?select=*&activo=eq.true&order=grupo.asc,item.asc`, {
    headers: getSupabaseHeaders(token),
  });
  const rows = await handleResponse<ItemPorciones[]>(res, onAuthError);
  return rows.map((r) => ({
    ...r,
    existente: Number(r.existente),
    entradas: Number(r.entradas),
    ventas: Number(r.ventas),
    total: Number(r.total),
    minimo: Number(r.minimo),
  }));
}

export async function fetchMovimientosPorciones(limit = 50, { token, onAuthError }: FetchOptions): Promise<MovimientoPorciones[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_porciones?select=*&order=created_at.desc&limit=${limit}`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<MovimientoPorciones[]>(res, onAuthError);
}

export async function fetchConsumos({ token, onAuthError }: FetchOptions): Promise<ConsumoProducto[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/consumos_producto?select=*`, { headers: getSupabaseHeaders(token) });
  const rows = await handleResponse<ConsumoProducto[]>(res, onAuthError);
  return rows.map((r) => ({ ...r, cantidad: Number(r.cantidad) }));
}

export const rpcListarDomiciliarios = (o: FetchOptions) =>
  rpc<{ email: string; nombre: string }[]>('listar_domiciliarios', {}, o);

async function selectRows<T>(path: string, { token, onAuthError }: FetchOptions): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: getSupabaseHeaders(token) });
  return handleResponse<T[]>(res, onAuthError);
}

export interface Perfil { email: string; nombre: string; rol: Rol; activo: boolean }
export interface Faltante { id: number; item: string; tipo: string; cantidad: number | null; nota: string | null; reportado_por: string; atendido: boolean; created_at: string }
export interface Auditoria { id: number; usuario: string; rol: string | null; accion: string; entidad: string; referencia: string | null; detalle: Record<string, unknown>; created_at: string }

export const fetchPerfiles = (o: FetchOptions) => selectRows<Perfil>('perfiles?select=email,nombre,rol,activo&order=rol.asc,nombre.asc', o);
export const fetchFaltantes = (o: FetchOptions) => selectRows<Faltante>('reportes_faltantes?select=*&order=created_at.desc&limit=50', o);
export const fetchAuditoria = (o: FetchOptions) => selectRows<Auditoria>('auditoria?select=*&order=created_at.desc&limit=100', o);

/** Llama una función RPC de Supabase. Todas las validaciones y permisos se aplican en el servidor. */
async function rpc<T = RpcResult>(name: string, body: Record<string, unknown>, { token, onAuthError }: FetchOptions): Promise<T> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (v !== undefined) clean[k] = v;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: getSupabaseHeaders(token),
    body: JSON.stringify(clean),
  });
  return handleResponse<T>(res, onAuthError);
}

export interface VentaPayload {
  p_id: string;
  p_plato: string;
  p_cantidad: number;
  p_estado?: string;
  p_tipo_pedido?: string;
  p_mesa?: string;
  p_tamano_porcion?: string;
  p_acompanamiento?: string;
  p_con_ensalada?: boolean;
  p_con_salsas?: boolean;
  p_direccion?: string;
  p_telefono?: string;
  p_metodo_pago?: string;
  p_cliente?: string;
  p_notas?: string;
}

export const rpcRegistrarVenta = (p: VentaPayload, o: FetchOptions) => rpc('registrar_venta', { ...p }, o);

export const rpcActualizarEstadoVenta = (
  p: { p_id: string; p_estado: string; p_metodo_pago?: string; p_motivo?: string; p_devolver_inventario?: boolean },
  o: FetchOptions
) => rpc('actualizar_estado_venta', p, o);

export const rpcAsignarDomiciliario = (p: { p_id: string; p_domiciliario: string }, o: FetchOptions) =>
  rpc('asignar_domiciliario', p, o);

export interface GastoPayload {
  p_id: string;
  p_concepto: string;
  p_categoria: string;
  p_valor: number;
  p_metodo_pago?: string;
  p_responsable?: string;
  p_estado?: string;
  p_periodo?: string;
  p_soporte_url?: string;
}

export const rpcRegistrarGasto = (p: GastoPayload, o: FetchOptions) => rpc('registrar_gasto', { ...p }, o);

export const rpcMarcarGastoPagado = (p: { p_id: string; p_metodo_pago?: string }, o: FetchOptions) =>
  rpc('marcar_gasto_pagado', p, o);

export const rpcAjustarInventario = (p: { p_ingrediente: string; p_delta: number; p_motivo: string }, o: FetchOptions) =>
  rpc('ajustar_inventario', p, o);

export const rpcCrearIngrediente = (
  p: { p_nombre: string; p_unidad: string; p_stock: number; p_minimo: number; p_categoria?: string },
  o: FetchOptions
) => rpc('crear_ingrediente', p, o);

export const rpcReportarFaltante = (p: { p_item: string; p_tipo?: string; p_cantidad?: number; p_nota?: string }, o: FetchOptions) =>
  rpc('reportar_faltante', p, o);

export const rpcRegistrarCompra = (
  p: {
    p_ingrediente: string;
    p_cantidad: number;
    p_valor: number;
    p_proveedor?: string;
    p_id?: string;
    p_inventario?: 'general' | 'porciones';
    p_metodo_pago?: string;
    p_estado_pago?: string;
  },
  o: FetchOptions
) => rpc('registrar_compra', p, o);

export const rpcRegistrarPorciones = (
  p: { p_item: string; p_tipo: 'existente' | 'entrada' | 'ajuste'; p_cantidad: number; p_motivo?: string },
  o: FetchOptions
) => rpc('registrar_porciones', p, o);

export const rpcCerrarPeriodoPorciones = (o: FetchOptions) => rpc('cerrar_periodo_porciones', {}, o);

export const rpcGuardarProducto = (
  p: { p_nombre: string; p_categoria: string; p_precio: number | null; p_precio_llevar?: number | null; p_precio_media?: number | null;
       p_presentacion?: string | null; p_unidad?: string | null; p_disponible?: boolean; p_activo?: boolean },
  o: FetchOptions
) => rpc('guardar_producto', p, o);

export const rpcGuardarConsumo = (
  p: { p_producto: string; p_variante: string | null; p_tipo: 'porcion' | 'ingrediente'; p_item: string; p_cantidad: number },
  o: FetchOptions
) => rpc('guardar_consumo', p, o);

export const rpcGuardarPerfil = (p: { p_email: string; p_nombre: string; p_rol: Rol; p_activo: boolean }, o: FetchOptions) =>
  rpc('guardar_perfil', p, o);

export const rpcGuardarIngrediente = (
  p: { p_nombre: string; p_unidad: string; p_minimo: number; p_categoria: string; p_costo_unitario?: number | null },
  o: FetchOptions
) => rpc('guardar_ingrediente', p, o);

export const rpcAtenderFaltante = (p: { p_id: number }, o: FetchOptions) => rpc('atender_faltante', p, o);

export const rpcAbrirCaja = (p: { p_base: number }, o: FetchOptions) => rpc('abrir_caja', p, o);
export const rpcCajaActual = (o: FetchOptions) => rpc<CajaActual | null>('caja_actual', {}, o);
export const rpcCerrarCaja = (p: { p_caja_id: number; p_contado: number }, o: FetchOptions) =>
  rpc<RpcResult & { esperado?: number; diferencia?: number }>('cerrar_caja', p, o);

export const rpcMiPerfil = (o: FetchOptions) => rpc<{ email: string; rol: Rol | null; nombre: string | null }>('mi_perfil', {}, o);

export const rpcReporte = (fecha: string | null, o: FetchOptions) => rpc<ReporteData>('reporte', { p_fecha: fecha }, o);

export const rpcReportePeriodo = (desde: string, hasta: string, o: FetchOptions) =>
  rpc<ReporteData>('reporte_periodo', { p_desde: desde, p_hasta: hasta }, o);

export const rpcProyeccion = (o: FetchOptions) => rpc<ProyeccionData>('proyeccion', {}, o);

// CHAT ASSISTANT
export async function sendChatMessage(
  payload: { token: string; message: string; sessionId: string },
  onAuthError?: () => void
): Promise<{ output: string }> {
  const res = await fetch(getChatUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    if (onAuthError) onAuthError();
    throw new Error('No autorizado (401).');
  }

  if (!res.ok) {
    let errorMsg = `Error en el servicio de chat (${res.status})`;
    try {
      const err = await res.json();
      errorMsg = err.message || errorMsg;
    } catch {
      // not JSON
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<{ output: string }>;
}
