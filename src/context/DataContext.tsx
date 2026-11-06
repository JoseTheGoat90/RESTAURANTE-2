/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Ingrediente,
  Receta,
  Venta,
  Gasto,
  ConceptoGasto,
  MovimientoInventario,
  ReporteData,
  RpcResult,
  EstadoComanda,
} from '../types.ts';
import {
  fetchIngredientes,
  fetchRecetas,
  fetchVentas,
  fetchGastos,
  fetchConceptosGasto,
  fetchMovimientosInventario,
  rpcReporte,
  rpcRegistrarVenta,
  rpcRegistrarGasto,
  rpcAjustarInventario,
  rpcCrearIngrediente,
} from '../services/api.ts';
import { useAuth } from './AuthContext.tsx';
import { getBogotaTodayDateString, generateOperationId } from '../utils/formatters.ts';

const INITIAL_INGREDIENTES: Ingrediente[] = [
  { ingrediente: 'lomo de res fino', unidad: 'g', stock: 4800, stock_minimo: 2000 },
  { ingrediente: 'pechuga de pollo marinada', unidad: 'g', stock: 6500, stock_minimo: 2500 },
  { ingrediente: 'pan brioche artesanal', unidad: 'unidad', stock: 34, stock_minimo: 20 },
  { ingrediente: 'queso cheddar madurado', unidad: 'g', stock: 1800, stock_minimo: 1500 },
  { ingrediente: 'pasta fettuccine de la casa', unidad: 'g', stock: 3200, stock_minimo: 1200 },
  { ingrediente: 'costilla de cerdo ahumada', unidad: 'kg', stock: 8.5, stock_minimo: 3.0 },
  { ingrediente: 'tomates san marzano', unidad: 'g', stock: 850, stock_minimo: 1200 }, // Under minimum!
  { ingrediente: 'aceite de oliva extra virgen', unidad: 'g', stock: 420, stock_minimo: 800 }, // Under minimum!
  { ingrediente: 'crema de leche fresca', unidad: 'g', stock: 1400, stock_minimo: 1000 },
  { ingrediente: 'papas rústicas con romero', unidad: 'g', stock: 9500, stock_minimo: 3000 },
  { ingrediente: 'aguacate hass', unidad: 'unidad', stock: 12, stock_minimo: 15 }, // Under minimum!
  { ingrediente: 'vino tinto reserva para salsas', unidad: 'unidad', stock: 6, stock_minimo: 2 },
];

const INITIAL_RECETAS: Receta[] = [
  { plato: 'lomo al romero en reducción', ingrediente: 'lomo de res fino', cantidad: 250, precio: 48000 },
  { plato: 'lomo al romero en reducción', ingrediente: 'papas rústicas con romero', cantidad: 180, precio: 48000 },
  { plato: 'lomo al romero en reducción', ingrediente: 'vino tinto reserva para salsas', cantidad: 0.15, precio: 48000 },

  { plato: 'hamburguesa smash cheddar doble', ingrediente: 'pan brioche artesanal', cantidad: 1, precio: 34000 },
  { plato: 'hamburguesa smash cheddar doble', ingrediente: 'lomo de res fino', cantidad: 200, precio: 34000 },
  { plato: 'hamburguesa smash cheddar doble', ingrediente: 'queso cheddar madurado', cantidad: 60, precio: 34000 },
  { plato: 'hamburguesa smash cheddar doble', ingrediente: 'papas rústicas con romero', cantidad: 150, precio: 34000 },

  { plato: 'fettuccine alfredo con pollo grillé', ingrediente: 'pasta fettuccine de la casa', cantidad: 200, precio: 36000 },
  { plato: 'fettuccine alfredo con pollo grillé', ingrediente: 'pechuga de pollo marinada', cantidad: 180, precio: 36000 },
  { plato: 'fettuccine alfredo con pollo grillé', ingrediente: 'crema de leche fresca', cantidad: 120, precio: 36000 },

  { plato: 'costillas bbq ahumadas 500g', ingrediente: 'costilla de cerdo ahumada', cantidad: 0.5, precio: 52000 },
  { plato: 'costillas bbq ahumadas 500g', ingrediente: 'papas rústicas con romero', cantidad: 200, precio: 52000 },

  { plato: 'pechuga grillé con ensalada y aguacate', ingrediente: 'pechuga de pollo marinada', cantidad: 220, precio: 31000 },
  { plato: 'pechuga grillé con ensalada y aguacate', ingrediente: 'aguacate hass', cantidad: 0.5, precio: 31000 },
  { plato: 'pechuga grillé con ensalada y aguacate', ingrediente: 'tomates san marzano', cantidad: 100, precio: 31000 },
];

const INITIAL_CONCEPTOS_GASTO: ConceptoGasto[] = [
  { nombre: 'compra de lomo y cortes de res', categoria: 'ingredientes' },
  { nombre: 'compra de pollo y aves', categoria: 'ingredientes' },
  { nombre: 'verduras y hortalizas frescas', categoria: 'ingredientes' },
  { nombre: 'panes y lácteos', categoria: 'ingredientes' },
  { nombre: 'servicio de gas natural cocina', categoria: 'servicios' },
  { nombre: 'energía eléctrica restaurante', categoria: 'servicios' },
  { nombre: 'arriendo local comercial', categoria: 'servicios' },
  { nombre: 'quincena equipo de cocina', categoria: 'nomina' },
  { nombre: 'quincena servicio de mesa', categoria: 'nomina' },
  { nombre: 'productos de aseo y desinfección', categoria: 'otros' },
  { nombre: 'empaques biodegradables para llevar', categoria: 'otros' },
];

const INITIAL_VENTAS: Venta[] = [
  {
    id_operacion: 'V-20261105-121520-K8P9',
    fecha: '2026-11-05',
    plato: 'lomo al romero en reducción',
    cantidad: 2,
    total: 96000,
    estado: 'pagado',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id_operacion: 'V-20261105-124011-M3Q1',
    fecha: '2026-11-05',
    plato: 'hamburguesa smash cheddar doble',
    cantidad: 3,
    total: 102000,
    estado: 'listo',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id_operacion: 'V-20261105-130245-L7Z2',
    fecha: '2026-11-05',
    plato: 'fettuccine alfredo con pollo grillé',
    cantidad: 1,
    total: 36000,
    estado: 'en_cocina',
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

const INITIAL_GASTOS: Gasto[] = [
  {
    id_operacion: 'G-20261105-083012-B4X7',
    fecha: '2026-11-05',
    concepto: 'compra de lomo y cortes de res',
    categoria: 'ingredientes',
    valor: 85000,
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id_operacion: 'G-20261105-091544-Y9T2',
    fecha: '2026-11-05',
    concepto: 'verduras y hortalizas frescas',
    categoria: 'ingredientes',
    valor: 32000,
    created_at: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
  },
];

const INITIAL_MOVIMIENTOS: MovimientoInventario[] = [
  {
    id: 'mov-1',
    ingrediente: 'lomo de res fino',
    delta: -500,
    motivo: 'Venta (2 porciones Lomo al romero)',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'mov-2',
    ingrediente: 'pan brioche artesanal',
    delta: -3,
    motivo: 'Venta (3 Hamburguesas smash)',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 'mov-3',
    ingrediente: 'costilla de cerdo ahumada',
    delta: 5,
    motivo: 'Compra (5 kg)',
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
];

interface NotificationState extends RpcResult {
  id: number;
}

interface DataContextType {
  ingredientes: Ingrediente[];
  recetas: Receta[];
  ventas: Venta[];
  gastos: Gasto[];
  conceptosGasto: ConceptoGasto[];
  movimientos: MovimientoInventario[];
  reporteHoy: ReporteData;
  isLoading: boolean;
  isRefreshing: boolean;
  lastError: string | null;
  notification: NotificationState | null;
  showNotification: (result: RpcResult) => void;
  clearNotification: () => void;
  loadAllData: () => Promise<void>;
  reloadVentasEInventario: () => Promise<void>;
  reloadGastos: () => Promise<void>;
  executeSale: (payload: { p_id: string; p_plato: string; p_cantidad: number; estado?: EstadoComanda }) => Promise<RpcResult>;
  executeExpense: (payload: { p_id: string; p_concepto: string; p_categoria: string; p_valor: number }) => Promise<RpcResult>;
  executeAdjustStock: (payload: { p_ingrediente: string; p_delta: number; p_motivo: string }) => Promise<RpcResult>;
  executeCreateIngredient: (payload: { p_nombre: string; p_unidad: string; p_stock: number; p_minimo: number }) => Promise<RpcResult>;
  registrar_venta: (payload: { p_id: string; p_plato: string; p_cantidad: number; estado?: EstadoComanda }) => Promise<RpcResult>;
  registrar_gasto: (payload: { p_id: string; p_concepto: string; p_categoria: string; p_valor: number }) => Promise<RpcResult>;
  consultar_inventario: () => { ingredientes: Ingrediente[]; bajo_minimo: { ingrediente: string; stock: number; stock_minimo: number; unidad: string }[]; total_items: number };
  generar_reporte: (fecha?: string | null) => Promise<ReporteData>;
  addConceptoGasto: (nombre: string, categoria: string) => void;
}

const DEMO_PREFIX = 'restaurante_demo_';
function readDemo<T>(key: string, initial: T): T {
  try {
    const s = localStorage.getItem(DEMO_PREFIX + key);
    if (s) return JSON.parse(s) as T;
  } catch {}
  return initial;
}
function writeDemo(key: string, value: unknown) {
  try {
    localStorage.setItem(DEMO_PREFIX + key, JSON.stringify(value));
  } catch {}
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getValidAccessToken, handleAuthError, isDemo, session } = useAuth();

  // En modo real los datos vienen SOLO de Supabase. Los datos de ejemplo existen
  // únicamente en modo demo y se guardan aparte (prefijo restaurante_demo_).
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [conceptosGasto, setConceptosGasto] = useState<ConceptoGasto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Al cambiar de usuario o de modo: limpiar y cargar la fuente correcta
  useEffect(() => {
    try {
      // Restos de versiones anteriores que mezclaban datos de ejemplo con reales
      ['ingredientes', 'recetas', 'ventas', 'gastos', 'conceptos', 'movimientos'].forEach((k) =>
        localStorage.removeItem('restaurante_' + k)
      );
    } catch {}
    if (isDemo) {
      setIngredientes(readDemo('ingredientes', INITIAL_INGREDIENTES));
      setRecetas(readDemo('recetas', INITIAL_RECETAS));
      setVentas(readDemo('ventas', INITIAL_VENTAS));
      setGastos(readDemo('gastos', INITIAL_GASTOS));
      setConceptosGasto(readDemo('conceptos', INITIAL_CONCEPTOS_GASTO));
      setMovimientos(readDemo('movimientos', INITIAL_MOVIMIENTOS));
    } else {
      setIngredientes([]);
      setRecetas([]);
      setVentas([]);
      setGastos([]);
      setConceptosGasto([]);
      setMovimientos([]);
    }
    setLastError(null);
  }, [isDemo, session?.userEmail]);

  useEffect(() => { if (isDemo) writeDemo('ingredientes', ingredientes); }, [isDemo, ingredientes]);
  useEffect(() => { if (isDemo) writeDemo('recetas', recetas); }, [isDemo, recetas]);
  useEffect(() => { if (isDemo) writeDemo('ventas', ventas); }, [isDemo, ventas]);
  useEffect(() => { if (isDemo) writeDemo('gastos', gastos); }, [isDemo, gastos]);
  useEffect(() => { if (isDemo) writeDemo('conceptos', conceptosGasto); }, [isDemo, conceptosGasto]);
  useEffect(() => { if (isDemo) writeDemo('movimientos', movimientos); }, [isDemo, movimientos]);

  const reporteHoy: ReporteData = React.useMemo(() => {
    const today = getBogotaTodayDateString();
    const ventasHoy = ventas.filter((v) => !v.fecha || v.fecha === today);
    const gastosHoy = gastos.filter((g) => !g.fecha || g.fecha === today);

    const total_ventas = ventasHoy.reduce((acc, v) => acc + (v.total || 0), 0);
    const total_gastos = gastosHoy.reduce((acc, g) => acc + (g.valor || 0), 0);
    const balance = total_ventas - total_gastos;

    const unidades_por_plato: Record<string, number> = {};
    for (const v of ventasHoy) {
      unidades_por_plato[v.plato] = (unidades_por_plato[v.plato] || 0) + v.cantidad;
    }

    const gastos_por_categoria: Record<string, number> = {};
    for (const g of gastosHoy) {
      gastos_por_categoria[g.categoria] = (gastos_por_categoria[g.categoria] || 0) + g.valor;
    }

    const ingredientes_bajo_minimo = ingredientes
      .filter((i) => i.stock <= i.stock_minimo)
      .map((i) => ({
        ingrediente: i.ingrediente,
        stock: i.stock,
        stock_minimo: i.stock_minimo,
        unidad: i.unidad,
      }));

    return {
      periodo: today,
      numero_ventas: ventasHoy.length,
      total_ventas,
      total_gastos,
      balance,
      unidades_por_plato,
      gastos_por_categoria,
      ingredientes_bajo_minimo,
      movimientos_inventario: movimientos.slice(0, 20).map((m) => ({
        ingrediente: m.ingrediente,
        delta: m.delta,
        unidad: ingredientes.find((i) => i.ingrediente === m.ingrediente)?.unidad || 'g',
        motivo: m.motivo,
        fecha: m.created_at,
      })),
    };
  }, [ventas, gastos, ingredientes, movimientos]);

  const showNotification = useCallback((result: RpcResult) => {
    setNotification({
      ...result,
      id: Date.now(),
    });
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  /** Carga desde Supabase. En modo real los datos remotos reemplazan siempre a los locales (aunque vengan vacíos). */
  const fetchInto = useCallback(
    async (parts: Array<'ing' | 'rec' | 'ven' | 'gas' | 'con' | 'mov'>) => {
      if (isDemo || !session) return;
      const token = await getValidAccessToken();
      if (!token) return;
      const opts = { token, onAuthError: handleAuthError };
      const jobs: Record<string, () => Promise<void>> = {
        ing: async () => setIngredientes(await fetchIngredientes(opts)),
        rec: async () => setRecetas(await fetchRecetas(opts)),
        ven: async () => setVentas(await fetchVentas(50, opts)),
        gas: async () => setGastos(await fetchGastos(50, opts)),
        con: async () => setConceptosGasto(await fetchConceptosGasto(opts)),
        mov: async () => setMovimientos(await fetchMovimientosInventario(50, opts)),
      };
      const results = await Promise.allSettled(parts.map((p) => jobs[p]()));
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      setLastError(
        failed.length
          ? `No se pudieron cargar algunos datos: ${failed[0].reason instanceof Error ? failed[0].reason.message : 'error de conexión'}`
          : null
      );
    },
    [isDemo, session, getValidAccessToken, handleAuthError]
  );

  const loadAllData = useCallback(async () => {
    if (isDemo || !session) return;
    setIsLoading(true);
    setIsRefreshing(true);
    try {
      await fetchInto(['ing', 'rec', 'ven', 'gas', 'con', 'mov']);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isDemo, session, fetchInto]);

  const reloadVentasEInventario = useCallback(() => fetchInto(['ven', 'ing', 'mov']), [fetchInto]);
  const reloadGastos = useCallback(() => fetchInto(['gas', 'con', 'ing']), [fetchInto]);

  /** Ejecuta una operación en Supabase y devuelve su resultado real (nunca un éxito simulado). */
  const runRemote = async (
    call: (opts: { token: string; onAuthError: () => void }) => Promise<RpcResult>,
    reload: () => Promise<void>
  ): Promise<RpcResult> => {
    try {
      const token = await getValidAccessToken();
      if (!token) return { ok: false, mensaje: 'Tu sesión expiró. Inicia sesión de nuevo.' };
      const res = await call({ token, onAuthError: handleAuthError });
      if (res.ok) await reload();
      return res;
    } catch (err) {
      return { ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo conectar con la base de datos.' };
    }
  };

  const executeSale = async (payload: {
    p_id: string;
    p_plato: string;
    p_cantidad: number;
    estado?: EstadoComanda;
  }): Promise<RpcResult> => {
    // Modo real: solo Supabase. Si falla, se informa el error y NO se guarda nada localmente.
    if (!isDemo) return runRemote((o) => rpcRegistrarVenta(payload, o), reloadVentasEInventario);

    const platoLower = payload.p_plato.toLowerCase().trim();
    const matchingRecipes = recetas.filter((r) => r.plato.toLowerCase().trim() === platoLower);
    const unitPrice = matchingRecipes[0]?.precio || 35000;
    const total = unitPrice * payload.p_cantidad;
    const today = getBogotaTodayDateString();

    const newSale: Venta = {
      id_operacion: payload.p_id,
      fecha: today,
      plato: payload.p_plato,
      cantidad: payload.p_cantidad,
      total,
      estado: payload.estado || 'pagado',
      created_at: new Date().toISOString(),
    };

    setVentas((prev) => [newSale, ...prev]);

    const newMovs: MovimientoInventario[] = [];
    setIngredientes((prev) => {
      const copy = [...prev];
      for (const rec of matchingRecipes) {
        const required = rec.cantidad * payload.p_cantidad;
        const idx = copy.findIndex((i) => i.ingrediente.toLowerCase().trim() === rec.ingrediente.toLowerCase().trim());
        if (idx !== -1) {
          copy[idx] = {
            ...copy[idx],
            stock: Math.max(0, Number((copy[idx].stock - required).toFixed(2))),
          };
          newMovs.push({
            id: 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            ingrediente: rec.ingrediente,
            delta: -required,
            motivo: `Venta (${payload.p_cantidad}x ${payload.p_plato})`,
            referencia: payload.p_id,
            created_at: new Date().toISOString(),
          });
        }
      }
      return copy;
    });

    if (newMovs.length > 0) {
      setMovimientos((prev) => [...newMovs, ...prev]);
    }

    return {
      ok: true,
      mensaje: `Venta registrada con éxito (${payload.p_cantidad}x ${payload.p_plato}). Insumos descontados.`,
    };
  };

  const addConceptoGasto = useCallback((nombre: string, categoria: string) => {
    const cleanNombre = nombre.toLowerCase().trim();
    if (!cleanNombre) return;
    setConceptosGasto((prev) => {
      if (prev.some((c) => c.nombre.toLowerCase().trim() === cleanNombre)) return prev;
      return [...prev, { nombre: cleanNombre, categoria }];
    });
  }, []);

  const executeExpense = async (payload: {
    p_id: string;
    p_concepto: string;
    p_categoria: string;
    p_valor: number;
  }): Promise<RpcResult> => {
    // Automatically register concept in catalog
    addConceptoGasto(payload.p_concepto, payload.p_categoria);

    // Modo real: solo Supabase. Si falla, se informa el error y NO se guarda nada localmente.
    if (!isDemo) return runRemote((o) => rpcRegistrarGasto(payload, o), reloadGastos);

    const today = getBogotaTodayDateString();
    const newGasto: Gasto = {
      id_operacion: payload.p_id,
      fecha: today,
      concepto: payload.p_concepto.toLowerCase(),
      categoria: payload.p_categoria,
      valor: payload.p_valor,
      created_at: new Date().toISOString(),
    };

    setGastos((prev) => [newGasto, ...prev]);

    return {
      ok: true,
      mensaje: `Gasto registrado con éxito (${payload.p_concepto}).`,
    };
  };

  const executeAdjustStock = async (payload: {
    p_ingrediente: string;
    p_delta: number;
    p_motivo: string;
  }): Promise<RpcResult> => {
    // Modo real: solo Supabase. Si falla, se informa el error y NO se guarda nada localmente.
    if (!isDemo) return runRemote((o) => rpcAjustarInventario(payload, o), reloadVentasEInventario);

    setIngredientes((prev) =>
      prev.map((i) => {
        if (i.ingrediente.toLowerCase().trim() === payload.p_ingrediente.toLowerCase().trim()) {
          const newStock = Math.max(0, Number((i.stock + payload.p_delta).toFixed(2)));
          return { ...i, stock: newStock };
        }
        return i;
      })
    );

    const newMov: MovimientoInventario = {
      id: 'mov-' + Date.now(),
      ingrediente: payload.p_ingrediente,
      delta: payload.p_delta,
      motivo: payload.p_motivo,
      created_at: new Date().toISOString(),
    };
    setMovimientos((prev) => [newMov, ...prev]);

    return {
      ok: true,
      mensaje: `Inventario de ${payload.p_ingrediente} ajustado con éxito (${payload.p_delta > 0 ? '+' : ''}${payload.p_delta}).`,
    };
  };

  const executeCreateIngredient = async (payload: {
    p_nombre: string;
    p_unidad: string;
    p_stock: number;
    p_minimo: number;
  }): Promise<RpcResult> => {
    // Modo real: solo Supabase. Si falla, se informa el error y NO se guarda nada localmente.
    if (!isDemo) return runRemote((o) => rpcCrearIngrediente(payload, o), reloadVentasEInventario);

    const newIng: Ingrediente = {
      ingrediente: payload.p_nombre.toLowerCase(),
      unidad: payload.p_unidad,
      stock: payload.p_stock,
      stock_minimo: payload.p_minimo,
    };

    setIngredientes((prev) => [newIng, ...prev.filter((i) => i.ingrediente !== newIng.ingrediente)]);

    return {
      ok: true,
      mensaje: `Ingrediente ${payload.p_nombre} creado con éxito.`,
    };
  };

  const consultar_inventario = useCallback(() => {
    const bajo_minimo = ingredientes
      .filter((i) => i.stock <= i.stock_minimo)
      .map((i) => ({
        ingrediente: i.ingrediente,
        stock: i.stock,
        stock_minimo: i.stock_minimo,
        unidad: i.unidad,
      }));
    return {
      ingredientes,
      bajo_minimo,
      total_items: ingredientes.length,
    };
  }, [ingredientes]);

  const generar_reporte = useCallback(async (fecha?: string | null) => {
    if (isDemo) return reporteHoy;
    const token = await getValidAccessToken();
    try {
      const res = await rpcReporte(fecha || null, { token, onAuthError: handleAuthError });
      if (res && typeof res.total_ventas === 'number') {
        return res;
      }
    } catch {}
    return reporteHoy;
  }, [isDemo, getValidAccessToken, handleAuthError, reporteHoy]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return (
    <DataContext.Provider
      value={{
        ingredientes,
        recetas,
        ventas,
        gastos,
        conceptosGasto,
        movimientos,
        reporteHoy,
        isLoading,
        isRefreshing,
        lastError,
        notification,
        showNotification,
        clearNotification,
        loadAllData,
        reloadVentasEInventario,
        reloadGastos,
        executeSale,
        executeExpense,
        executeAdjustStock,
        executeCreateIngredient,
        registrar_venta: executeSale,
        registrar_gasto: executeExpense,
        consultar_inventario,
        generar_reporte,
        addConceptoGasto,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
