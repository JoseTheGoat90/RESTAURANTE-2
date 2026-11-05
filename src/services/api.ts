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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ingredientes?select=ingrediente,unidad,stock,stock_minimo&order=ingrediente.asc`, {
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ventas?select=id_operacion,fecha,plato,cantidad,total,created_at&order=created_at.desc&limit=${limit}`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<Venta[]>(res, onAuthError);
}

export async function fetchGastos(limit = 50, { token, onAuthError }: FetchOptions): Promise<Gasto[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/gastos?select=id_operacion,fecha,concepto,categoria,valor,created_at&order=created_at.desc&limit=${limit}`, {
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/movimientos_inventario?select=id,ingrediente,delta,motivo,referencia,created_at&order=created_at.desc&limit=${limit}`, {
    headers: getSupabaseHeaders(token),
  });
  return handleResponse<MovimientoInventario[]>(res, onAuthError);
}

// RPC CALLS
export async function rpcRegistrarVenta(
  payload: { p_id: string; p_plato: string; p_cantidad: number },
  { token, onAuthError }: FetchOptions
): Promise<RpcResult> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_venta`, {
    method: 'POST',
    headers: getSupabaseHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<RpcResult>(res, onAuthError);
}

export async function rpcRegistrarGasto(
  payload: { p_id: string; p_concepto: string; p_categoria: string; p_valor: number },
  { token, onAuthError }: FetchOptions
): Promise<RpcResult> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_gasto`, {
    method: 'POST',
    headers: getSupabaseHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<RpcResult>(res, onAuthError);
}

export async function rpcAjustarInventario(
  payload: { p_ingrediente: string; p_delta: number; p_motivo: string },
  { token, onAuthError }: FetchOptions
): Promise<RpcResult> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ajustar_inventario`, {
    method: 'POST',
    headers: getSupabaseHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<RpcResult>(res, onAuthError);
}

export async function rpcCrearIngrediente(
  payload: { p_nombre: string; p_unidad: string; p_stock: number; p_minimo: number },
  { token, onAuthError }: FetchOptions
): Promise<RpcResult> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crear_ingrediente`, {
    method: 'POST',
    headers: getSupabaseHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<RpcResult>(res, onAuthError);
}

export async function rpcReporte(
  fecha: string | null,
  { token, onAuthError }: FetchOptions
): Promise<ReporteData> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reporte`, {
    method: 'POST',
    headers: getSupabaseHeaders(token),
    body: JSON.stringify({ p_fecha: fecha }),
  });
  return handleResponse<ReporteData>(res, onAuthError);
}

export async function rpcProyeccion({ token, onAuthError }: FetchOptions): Promise<ProyeccionData> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/proyeccion`, {
    method: 'POST',
    headers: getSupabaseHeaders(token),
    body: JSON.stringify({}),
  });
  return handleResponse<ProyeccionData>(res, onAuthError);
}

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
