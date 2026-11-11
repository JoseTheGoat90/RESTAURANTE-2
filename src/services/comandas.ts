/**
 * Comandas (pedidos de varios productos), tablero del dueño, planilla de porciones y configuración.
 * Las reglas (precios, permisos, inventario, no duplicar) viven en Supabase (migración 008).
 */
import { useCallback } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { RpcResult } from '../types.ts';

export interface ItemComanda {
  plato: string;
  cantidad: number;
  tamano_porcion?: 'media' | 'entera';
  acompanamiento?: string;
  con_ensalada?: boolean;
  con_salsas?: boolean;
  notas?: string;
}

export interface ItemAbierto {
  id: string;
  plato: string;
  cantidad: number;
  total: number;
  estado: string;
  pago_estado: string;
  tamano_porcion: string | null;
  notas: string | null;
  estacion: string | null;
}

export interface ComandaAbierta {
  comanda_id: string;
  tipo_pedido: string;
  mesa: string | null;
  cliente: string | null;
  direccion: string | null;
  telefono: string | null;
  domiciliario: string | null;
  desde: string;
  registrado_por: string | null;
  total: number;
  por_cobrar: number;
  items: ItemAbierto[];
}

export interface Tablero {
  generado: string;
  hoy: {
    ingresos: number;
    ingresos_semana_pasada: number;
    variacion_pct: number | null;
    gastos: number;
    por_cobrar: number;
    pedidos: number;
    ticket_promedio: number | null;
    por_hora: { hora: number; ingresos: number }[];
    por_modalidad: Record<string, number>;
    por_medio: Record<string, number>;
  };
  mes: {
    ingresos: number;
    gastos: number;
    gastos_fijos: number;
    balance: number;
    dias_transcurridos: number;
    dias_del_mes: number;
    proyeccion_ingresos: number;
    proyeccion_gastos: number;
    cobertura_gastos_pct: number | null;
    dias_con_ventas: number;
    gastos_por_categoria: { categoria: string; valor: number }[];
    gastos_pendientes: { n: number; valor: number };
  };
  serie_14_dias: { fecha: string; ingresos: number; gastos: number }[];
  top_productos_7_dias: { plato: string; unidades: number; ingresos: number }[];
  operacion: {
    pedidos_activos: Record<string, number>;
    caja: { base?: number; esperado?: number } | null;
    checklists: { total: number; hechos: number; vencidos: number; alertas: number };
  };
  alertas: {
    insumos_bajos: { item: string; stock: number; minimo: number; unidad: string }[];
    porciones_bajas: { item: string; total: number; minimo: number }[];
    faltantes: number;
    dinero_en_riesgo: number;
    agotados_menu: string[];
  };
}

export interface ConfigRestaurante {
  nombre: string;
  num_mesas: number;
  rol_registro?: string | null; // cargo de las cuentas nuevas (null = registro cerrado)
}

export interface CierrePorciones {
  fecha: string;
  item: string;
  existente: number;
  entradas: number;
  ventas: number;
  total: number;
}

// ---------- Datos de ejemplo (modo demo) ----------
const diasAtras = (n: number) => {
  const f = new Date();
  f.setDate(f.getDate() - n);
  return f.toISOString().slice(0, 10);
};

export const DEMO_TABLERO: Tablero = {
  generado: 'demo',
  hoy: {
    ingresos: 486000, ingresos_semana_pasada: 452000, variacion_pct: 8, gastos: 120000, por_cobrar: 58500, pedidos: 31,
    ticket_promedio: 15700,
    por_hora: [{ hora: 11, ingresos: 42000 }, { hora: 12, ingresos: 168000 }, { hora: 13, ingresos: 191000 }, { hora: 14, ingresos: 85000 }],
    por_modalidad: { mesa: 301000, para_llevar: 121000, domicilio: 64000 },
    por_medio: { efectivo: 262000, nequi: 189000, tarjeta: 35000 },
  },
  mes: {
    ingresos: 4870000, gastos: 3410000, gastos_fijos: 1650000, balance: 1460000, dias_transcurridos: 10, dias_del_mes: 30,
    proyeccion_ingresos: 14610000, proyeccion_gastos: 10230000, cobertura_gastos_pct: 143, dias_con_ventas: 40,
    gastos_por_categoria: [
      { categoria: 'compras', valor: 1760000 }, { categoria: 'nomina', valor: 1200000 },
      { categoria: 'servicios', valor: 250000 }, { categoria: 'seguridad', valor: 200000 },
    ],
    gastos_pendientes: { n: 2, valor: 340000 },
  },
  serie_14_dias: Array.from({ length: 14 }, (_, i) => ({
    fecha: diasAtras(13 - i),
    ingresos: [410, 455, 0, 390, 470, 520, 610, 430, 480, 0, 400, 455, 500, 486][i] * 1000,
    gastos: [120, 90, 0, 310, 95, 140, 80, 110, 250, 0, 105, 90, 160, 120][i] * 1000,
  })),
  top_productos_7_dias: [
    { plato: 'almuerzo corriente', unidades: 142, ingresos: 1910000 },
    { plato: 'asado de carne de res', unidades: 38, ingresos: 702000 },
    { plato: 'corriente especial con mondongo', unidades: 31, ingresos: 480000 },
    { plato: 'coca-cola personal', unidades: 58, ingresos: 203000 },
  ],
  operacion: { pedidos_activos: { nuevo: 2, en_cocina: 3, listo: 1 }, caja: { base: 100000, esperado: 362000 }, checklists: { total: 5, hechos: 3, vencidos: 1, alertas: 1 } },
  alertas: {
    insumos_bajos: [{ item: 'pollo', stock: 1200, minimo: 1500, unidad: 'g' }],
    porciones_bajas: [{ item: 'chuleta', total: 2, minimo: 4 }],
    faltantes: 1, dinero_en_riesgo: 54000, agotados_menu: ['corriente especial con ajiaco'],
  },
};

// ---------- Llamadas ----------
function cabeceras(token: string) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function leerError(res: Response): Promise<string> {
  try {
    const e = await res.json();
    return e.message || e.error || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

async function rpc<T>(nombre: string, cuerpo: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, { method: 'POST', headers: cabeceras(token), body: JSON.stringify(cuerpo) });
  if (!res.ok) throw new Error(await leerError(res));
  return res.json() as Promise<T>;
}

async function leer<T>(ruta: string, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: cabeceras(token) });
  if (!res.ok) throw new Error(await leerError(res));
  return res.json() as Promise<T>;
}

/** Funciones remotas con el token del usuario. En modo demo, el que llama decide qué simular. */
export function useComandas() {
  const { getValidAccessToken } = useAuth();

  const conToken = useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
      return fn(token);
    },
    [getValidAccessToken]
  );

  const seguro = useCallback(
    async (fn: () => Promise<RpcResult>): Promise<RpcResult> => {
      try {
        return await fn();
      } catch (e) {
        return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo conectar con la base de datos.' };
      }
    },
    []
  );

  return {
    registrarComanda: useCallback(
      (p: {
        lote: string; items: ItemComanda[]; tipo_pedido: string; mesa?: string; cliente?: string; direccion?: string;
        telefono?: string; notas?: string; cobrar?: boolean; metodo_pago?: string; comanda_id?: string;
      }) =>
        seguro(() =>
          conToken((t) =>
            rpc<RpcResult & { comanda_id?: string; total?: number }>('registrar_comanda', {
              p_lote: p.lote, p_items: p.items, p_tipo_pedido: p.tipo_pedido, p_mesa: p.mesa ?? null, p_cliente: p.cliente || null,
              p_direccion: p.direccion || null, p_telefono: p.telefono || null, p_notas: p.notas || null,
              p_cobrar: Boolean(p.cobrar), p_metodo_pago: p.metodo_pago || 'efectivo', p_comanda_id: p.comanda_id ?? null,
            }, t)
          )
        ),
      [conToken, seguro]
    ),
    comandasAbiertas: useCallback(() => conToken((t) => rpc<ComandaAbierta[]>('comandas_abiertas', {}, t)), [conToken]),
    cobrarComanda: useCallback(
      (id: string, metodo: string) => seguro(() => conToken((t) => rpc<RpcResult>('cobrar_comanda', { p_comanda_id: id, p_metodo_pago: metodo }, t))),
      [conToken, seguro]
    ),
    estadoComanda: useCallback(
      (id: string, estado: string) => seguro(() => conToken((t) => rpc<RpcResult>('estado_comanda', { p_comanda_id: id, p_estado: estado }, t))),
      [conToken, seguro]
    ),
    tablero: useCallback(() => conToken((t) => rpc<Tablero>('tablero', {}, t)), [conToken]),
    config: useCallback(
      () => conToken(async (t) => (await leer<ConfigRestaurante[]>('restaurante_config?select=*&limit=1', t))[0] ?? null),
      [conToken]
    ),
    guardarConfig: useCallback(
      (nombre: string, mesas: number, rolRegistro?: string) =>
        seguro(() =>
          conToken((t) =>
            rpc<RpcResult>('guardar_config', { p_nombre: nombre, p_num_mesas: mesas, ...(rolRegistro !== undefined ? { p_rol_registro: rolRegistro } : {}) }, t)
          )
        ),
      [conToken, seguro]
    ),
    planillaCierres: useCallback(
      () => conToken((t) => leer<CierrePorciones[]>('porciones_cierres?select=fecha,item,existente,entradas,ventas,total&order=fecha.desc,item.asc&limit=200', t)),
      [conToken]
    ),
  };
}
