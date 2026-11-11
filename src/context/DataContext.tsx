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
  TipoPedido,
  MetodoPago,
  EstadoGasto,
  TipoInsumo,
  Producto,
  ItemPorciones,
  MovimientoPorciones,
  CajaActual,
  ConsumoProducto,
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
  fetchProductos,
  fetchPorciones,
  fetchMovimientosPorciones,
  rpcActualizarEstadoVenta,
  rpcAsignarDomiciliario,
  rpcMarcarGastoPagado,
  rpcReportarFaltante,
  rpcRegistrarCompra,
  rpcRegistrarPorciones,
  rpcAbrirCaja,
  rpcCajaActual,
  rpcCerrarCaja,
  fetchConsumos,
  rpcListarDomiciliarios,
  rpcCerrarPeriodoPorciones,
  rpcReportePeriodo,
} from '../services/api.ts';
import { useAuth } from './AuthContext.tsx';
import { getBogotaTodayDateString, generateOperationId, capitalizeFirst } from '../utils/formatters.ts';

const INITIAL_INGREDIENTES: Ingrediente[] = [
  // Granos, legumbres y pastas
  { ingrediente: 'arroz', unidad: 'lb', stock: 45, stock_minimo: 15, tipo_insumo: 'granos_legumbres' },
  { ingrediente: 'lentejas', unidad: 'lb', stock: 25, stock_minimo: 8, tipo_insumo: 'granos_legumbres' },
  { ingrediente: 'fríjoles', unidad: 'lb', stock: 30, stock_minimo: 10, tipo_insumo: 'granos_legumbres' },
  { ingrediente: 'pastas', unidad: 'lb', stock: 20, stock_minimo: 6, tipo_insumo: 'granos_legumbres' },

  // Tubérculos, plátanos y otros vegetales
  { ingrediente: 'yuca', unidad: 'lb', stock: 35, stock_minimo: 12, tipo_insumo: 'tuberculos_vegetales' },
  { ingrediente: 'plátano', unidad: 'unidad', stock: 50, stock_minimo: 18, tipo_insumo: 'tuberculos_vegetales' },
  { ingrediente: 'papa', unidad: 'lb', stock: 40, stock_minimo: 15, tipo_insumo: 'tuberculos_vegetales' },
  { ingrediente: 'ají', unidad: 'lb', stock: 6, stock_minimo: 2, tipo_insumo: 'tuberculos_vegetales' },
  { ingrediente: 'pimentón', unidad: 'lb', stock: 12, stock_minimo: 4, tipo_insumo: 'tuberculos_vegetales' },
  { ingrediente: 'cilantro', unidad: 'paquete', stock: 15, stock_minimo: 5, tipo_insumo: 'tuberculos_vegetales' },
  { ingrediente: 'apio', unidad: 'lb', stock: 10, stock_minimo: 3, tipo_insumo: 'tuberculos_vegetales' },

  // Verduras y hortalizas
  { ingrediente: 'lechuga', unidad: 'unidad', stock: 18, stock_minimo: 6, tipo_insumo: 'verduras_hortalizas' },
  { ingrediente: 'tomate', unidad: 'lb', stock: 25, stock_minimo: 8, tipo_insumo: 'verduras_hortalizas' },
  { ingrediente: 'repollo', unidad: 'unidad', stock: 12, stock_minimo: 4, tipo_insumo: 'verduras_hortalizas' },
  { ingrediente: 'zanahoria', unidad: 'lb', stock: 20, stock_minimo: 6, tipo_insumo: 'verduras_hortalizas' },
  { ingrediente: 'pepino', unidad: 'lb', stock: 14, stock_minimo: 5, tipo_insumo: 'verduras_hortalizas' },

  // Carnes y proteínas
  { ingrediente: 'jarrete grueso', unidad: 'lb', stock: 22, stock_minimo: 6, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'carne molida', unidad: 'lb', stock: 18, stock_minimo: 6, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'chicharrón', unidad: 'lb', stock: 15, stock_minimo: 5, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'carne salada', unidad: 'lb', stock: 16, stock_minimo: 5, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'bondiola de cerdo', unidad: 'lb', stock: 18, stock_minimo: 6, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'pollo (para sopas y guisar)', unidad: 'lb', stock: 28, stock_minimo: 10, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'costillas de res', unidad: 'lb', stock: 20, stock_minimo: 6, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'costillas de cerdo', unidad: 'lb', stock: 18, stock_minimo: 6, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'alitas de pollo', unidad: 'lb', stock: 15, stock_minimo: 5, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'lomo de cerdo', unidad: 'lb', stock: 24, stock_minimo: 8, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'pechuga', unidad: 'lb', stock: 26, stock_minimo: 8, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'carne de res', unidad: 'lb', stock: 28, stock_minimo: 8, tipo_insumo: 'carnes_proteinas' },
  { ingrediente: 'chuleta', unidad: 'unidad', stock: 20, stock_minimo: 6, tipo_insumo: 'carnes_proteinas' },

  // Otros ingredientes y acompañamientos de servicio
  { ingrediente: 'queso', unidad: 'lb', stock: 18, stock_minimo: 5, tipo_insumo: 'otros_ingredientes' },
  { ingrediente: 'huevos', unidad: 'unidad', stock: 60, stock_minimo: 20, tipo_insumo: 'otros_ingredientes' },
  { ingrediente: 'bollo', unidad: 'unidad', stock: 65, stock_minimo: 20, tipo_insumo: 'otros_ingredientes' },
  { ingrediente: 'patacón', unidad: 'unidad', stock: 70, stock_minimo: 20, tipo_insumo: 'otros_ingredientes' },

  // Salsas, condimentos y aceites
  { ingrediente: 'salsa para carne', unidad: 'unidad', stock: 8, stock_minimo: 2, tipo_insumo: 'salsas_condimentos' },
  { ingrediente: 'salsa BBQ', unidad: 'unidad', stock: 8, stock_minimo: 2, tipo_insumo: 'salsas_condimentos' },
  { ingrediente: 'vinagre', unidad: 'unidad', stock: 6, stock_minimo: 2, tipo_insumo: 'salsas_condimentos' },
  { ingrediente: 'sal', unidad: 'lb', stock: 20, stock_minimo: 5, tipo_insumo: 'salsas_condimentos' },
  { ingrediente: 'aceite', unidad: 'unidad', stock: 12, stock_minimo: 4, tipo_insumo: 'salsas_condimentos' },
  { ingrediente: 'salsas de la casa', unidad: 'porcion', stock: 55, stock_minimo: 15, tipo_insumo: 'salsas_condimentos' },
  { ingrediente: 'ensalada fresca', unidad: 'porcion', stock: 45, stock_minimo: 15, tipo_insumo: 'verduras_hortalizas' },

  // Suministros de empaque y desechables
  { ingrediente: 'cubiertos desechables', unidad: 'unidad', stock: 120, stock_minimo: 40, tipo_insumo: 'desechables' },
  { ingrediente: 'empaque desechable térmico para sopa', unidad: 'unidad', stock: 50, stock_minimo: 20, tipo_insumo: 'desechables' },
  { ingrediente: 'empaque desechable para secos', unidad: 'unidad', stock: 60, stock_minimo: 25, tipo_insumo: 'desechables' },
  { ingrediente: 'bolsas de domicilio', unidad: 'unidad', stock: 100, stock_minimo: 40, tipo_insumo: 'desechables' },

  // Limpieza
  { ingrediente: 'insumos de aseo y desinfección', unidad: 'unidad', stock: 8, stock_minimo: 2, tipo_insumo: 'limpieza' },
];

const INITIAL_RECETAS: Receta[] = [
  // Asados con porción media y entera (del documento)
  { plato: 'asado de carne de res', ingrediente: 'carne de res', cantidad: 0.5, precio: 22000, precio_media: 15000, precio_entera: 22000 },
  { plato: 'lomo de cerdo', ingrediente: 'lomo de cerdo', cantidad: 0.5, precio: 20000, precio_media: 14000, precio_entera: 20000 },
  { plato: 'pechuga a la plancha', ingrediente: 'pechuga', cantidad: 0.5, precio: 20000, precio_media: 14000, precio_entera: 20000 },
  { plato: 'chuleta de cerdo', ingrediente: 'chuleta', cantidad: 1, precio: 20000, precio_media: 14000, precio_entera: 20000 },

  // Almuerzos corrientes y secos (diferenciados por mesa y llevar)
  { plato: 'almuerzo corriente', ingrediente: 'carne molida', cantidad: 0.35, precio: 13000, precio_mesa: 13000, precio_llevar: 14000 },
  { plato: 'almuerzo seco', ingrediente: 'chicharrón', cantidad: 0.35, precio: 11000, precio_mesa: 11000, precio_llevar: 12000 },

  // Variedades de sopa del documento (mesa $15.000 / llevar $16.000)
  { plato: 'sopa de mondongo', ingrediente: 'carne salada', cantidad: 0.4, precio: 15000, precio_mesa: 15000, precio_llevar: 16000 },
  { plato: 'ajiaco', ingrediente: 'pollo (para sopas y guisar)', cantidad: 0.4, precio: 15000, precio_mesa: 15000, precio_llevar: 16000 },
  { plato: 'mote de queso', ingrediente: 'queso', cantidad: 0.3, precio: 15000, precio_mesa: 15000, precio_llevar: 16000 },
  { plato: 'sopa de costilla de res', ingrediente: 'costillas de res', cantidad: 0.5, precio: 15000, precio_mesa: 15000, precio_llevar: 16000 },
  { plato: 'sopa de jarrete tradicional', ingrediente: 'jarrete grueso', cantidad: 0.5, precio: 15000, precio_mesa: 15000, precio_llevar: 16000 },

  // Bebidas (del documento)
  { plato: 'gaseosa postobon personal', ingrediente: 'gaseosa postobon', cantidad: 1, precio: 3500 },
  { plato: 'gaseosa coca-cola personal', ingrediente: 'gaseosa coca-cola', cantidad: 1, precio: 3500 },
  { plato: 'coca-cola 1.5 litros', ingrediente: 'coca-cola familiar', cantidad: 1, precio: 7000 },
  { plato: 'agua presentacion 1', ingrediente: 'agua 1', cantidad: 1, precio: 1000 },
  { plato: 'agua presentacion 2', ingrediente: 'agua 2', cantidad: 1, precio: 2000 },
];

const INITIAL_CONCEPTOS_GASTO: ConceptoGasto[] = [
  // Servicios públicos y conectividad
  { nombre: 'energía eléctrica (luz)', categoria: 'servicios' },
  { nombre: 'servicio de gas cocina', categoria: 'servicios' },
  { nombre: 'acueducto y agua', categoria: 'servicios' },
  { nombre: 'internet y conectividad', categoria: 'servicios' },

  // Seguridad
  { nombre: 'servicio de vigilancia', categoria: 'seguridad' },

  // Compras e insumos
  { nombre: 'compra de carnes y pollo', categoria: 'insumos' },
  { nombre: 'compra de costillas y cerdo', categoria: 'insumos' },
  { nombre: 'verduras y hortalizas', categoria: 'insumos' },
  { nombre: 'acompañamientos (yuca, papa, bollo)', categoria: 'insumos' },
  { nombre: 'elementos desechables y cubiertos', categoria: 'insumos' },

  // Otros gastos operativos
  { nombre: 'aseo, limpieza y desinfección', categoria: 'otros' },
  { nombre: 'mantenimiento de equipos', categoria: 'otros' },
  { nombre: 'transporte y fletes de insumos', categoria: 'otros' },
];

const INITIAL_VENTAS: Venta[] = [
  {
    id_operacion: 'PED-20261110-001',
    fecha: '2026-11-10',
    plato: 'asado de carne de res',
    cantidad: 1,
    tamano_porcion: 'entera',
    total: 22000,
    estado: 'pagado',
    tipo_pedido: 'mesa',
    mesa: 'Mesa 3',
    acompanamiento: 'patacón',
    con_ensalada: true,
    con_salsas: true,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id_operacion: 'PED-20261110-002',
    fecha: '2026-11-10',
    plato: 'sopa de mondongo',
    cantidad: 2,
    total: 32000,
    estado: 'en_camino',
    tipo_pedido: 'domicilio',
    acompanamiento: 'bollo',
    direccion_domicilio: 'Calle 14 # 8-32, Barrio Centro',
    telefono_contacto: '3105557890',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id_operacion: 'PED-20261110-003',
    fecha: '2026-11-10',
    plato: 'almuerzo corriente',
    cantidad: 2,
    total: 28000,
    estado: 'en_cocina',
    tipo_pedido: 'para_llevar',
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
];

const INITIAL_GASTOS: Gasto[] = [
  {
    id_operacion: 'GST-20261110-01',
    fecha: '2026-11-10',
    concepto: 'compra de carnes y pollo',
    categoria: 'insumos',
    valor: 145000,
    periodo: 'Noviembre 2026',
    metodo_pago: 'efectivo',
    responsable: 'Administrador',
    estado: 'pagado',
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id_operacion: 'GST-20261110-02',
    fecha: '2026-11-10',
    concepto: 'servicio de gas cocina',
    categoria: 'servicios',
    valor: 82000,
    periodo: 'Noviembre 2026',
    metodo_pago: 'nequi',
    responsable: 'Administrador',
    estado: 'pagado',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id_operacion: 'GST-20261110-03',
    fecha: '2026-11-10',
    concepto: 'servicio de vigilancia',
    categoria: 'seguridad',
    valor: 120000,
    periodo: 'Noviembre 2026',
    metodo_pago: 'transferencia',
    estado: 'pendiente',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id_operacion: 'GST-20261110-04',
    fecha: '2026-11-10',
    concepto: 'elementos desechables y cubiertos',
    categoria: 'insumos',
    valor: 45000,
    periodo: 'Noviembre 2026',
    metodo_pago: 'efectivo',
    estado: 'pagado',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const INITIAL_MOVIMIENTOS: MovimientoInventario[] = [
  {
    id: 'mov-1',
    ingrediente: 'costillas de res (para sopa)',
    delta: -1.0,
    motivo: 'Venta (2x Sopa de costilla)',
    referencia: 'PED-20261110-001',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'mov-2',
    ingrediente: 'lomo de cerdo',
    delta: -0.5,
    motivo: 'Venta Domicilio (1x Lomo con patacón)',
    referencia: 'PED-20261110-002',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'mov-3',
    ingrediente: 'cubiertos desechables',
    delta: -1,
    motivo: 'Suministro para Domicilio',
    referencia: 'PED-20261110-002',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
];

// Catálogo de ejemplo (solo modo demo). En modo real el menú viene de la tabla productos.
const DEMO_PRODUCTOS: Producto[] = [
  { nombre: 'almuerzo corriente', categoria: 'almuerzos', precio: 13000, precio_llevar: 14000, precio_media: null, disponible: true, activo: true, estacion: 'cocina' },
  { nombre: 'almuerzo seco', categoria: 'almuerzos', precio: 11000, precio_llevar: 12000, precio_media: null, disponible: true, activo: true, estacion: 'cocina' },
  { nombre: 'corriente especial con mondongo', categoria: 'almuerzos', precio: 15000, precio_llevar: 16000, precio_media: null, disponible: true, activo: true, estacion: 'cocina' },
  { nombre: 'corriente especial con ajiaco', categoria: 'almuerzos', precio: 15000, precio_llevar: 16000, precio_media: null, disponible: true, activo: true, estacion: 'cocina' },
  { nombre: 'corriente especial con mote de queso', categoria: 'almuerzos', precio: 15000, precio_llevar: 16000, precio_media: null, disponible: true, activo: true, estacion: 'cocina' },
  { nombre: 'asado de carne de res', categoria: 'asados', precio: 22000, precio_llevar: null, precio_media: 15000, disponible: true, activo: true, estacion: 'parrilla' },
  { nombre: 'asado de lomo de cerdo', categoria: 'asados', precio: 20000, precio_llevar: null, precio_media: 14000, disponible: true, activo: true, estacion: 'parrilla' },
  { nombre: 'asado de pechuga', categoria: 'asados', precio: 20000, precio_llevar: null, precio_media: 14000, disponible: true, activo: true, estacion: 'parrilla' },
  { nombre: 'asado de chuleta', categoria: 'asados', precio: 20000, precio_llevar: null, precio_media: 14000, disponible: true, activo: true, estacion: 'parrilla' },
  { nombre: 'gaseosa postobón personal', categoria: 'bebidas', precio: 3500, precio_llevar: null, precio_media: null, presentacion: 'personal', disponible: true, activo: true, estacion: 'bar' },
  { nombre: 'coca-cola personal', categoria: 'bebidas', precio: 3500, precio_llevar: null, precio_media: null, presentacion: 'personal', disponible: true, activo: true, estacion: 'bar' },
  { nombre: 'coca-cola 1,5 litros', categoria: 'bebidas', precio: 7000, precio_llevar: null, precio_media: null, presentacion: '1,5 litros', disponible: true, activo: true, estacion: 'bar' },
  { nombre: 'agua pequeña', categoria: 'bebidas', precio: 1000, precio_llevar: null, precio_media: null, presentacion: 'pequeña', disponible: true, activo: true, estacion: 'bar' },
  { nombre: 'agua grande', categoria: 'bebidas', precio: 2000, precio_llevar: null, precio_media: null, presentacion: 'grande', disponible: true, activo: true, estacion: 'bar' },
];

const DEMO_PORCIONES: ItemPorciones[] = [
  'lomo de cerdo', 'carne de res', 'pechuga', 'costillas', 'chuleta', 'sobrebarriga', 'chinchurria',
].map((item): ItemPorciones => ({ item, grupo: 'asado', existente: 0, entradas: 0, ventas: 0, total: 0, minimo: 0, activo: true }))
  .concat(['ejecutivo de cerdo', 'ejecutivo de chuleta', 'ejecutivo de pechuga', 'ejecutivo de carne de res'].map((item): ItemPorciones => ({
    item, grupo: 'ejecutivo', existente: 0, entradas: 0, ventas: 0, total: 0, minimo: 0, activo: true,
  })));

/** Precio que cobra la base para un producto (misma regla que registrar_venta en el servidor). */
export function precioDeProducto(p: Producto | undefined, tipoPedido: TipoPedido, tamano?: 'media' | 'entera'): number | null {
  if (!p) return null;
  if (p.categoria === 'asados') return tamano === 'media' ? p.precio_media : p.precio;
  if ((tipoPedido === 'para_llevar' || tipoPedido === 'domicilio') && p.precio_llevar != null) return p.precio_llevar;
  return p.precio;
}

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
  productos: Producto[];
  porciones: ItemPorciones[];
  movimientosPorciones: MovimientoPorciones[];
  caja: CajaActual | null;
  consumos: ConsumoProducto[];
  domiciliarios: { email: string; nombre: string }[];
  executeSale: (payload: SalePayload) => Promise<RpcResult>;
  executeExpense: (payload: {
    p_id: string;
    p_concepto: string;
    p_categoria: string;
    p_valor: number;
    periodo?: string;
    metodo_pago?: MetodoPago | string;
    responsable?: string;
    estado?: EstadoGasto;
  }) => Promise<RpcResult>;
  executeAdjustStock: (payload: { p_ingrediente: string; p_delta: number; p_motivo: string }) => Promise<RpcResult>;
  executeCreateIngredient: (payload: { p_nombre: string; p_unidad: string; p_stock: number; p_minimo: number; tipo_insumo?: TipoInsumo }) => Promise<RpcResult>;
  updateOrderStatus: (id_operacion: string, nuevoEstado: EstadoComanda, extra?: { metodo_pago?: string; motivo?: string; devolver_inventario?: boolean }) => Promise<RpcResult>;
  updateExpenseStatus: (id_operacion: string, nuevoEstado: EstadoGasto, metodo_pago?: string) => Promise<RpcResult>;
  asignarDomiciliario: (id_operacion: string, email: string) => Promise<RpcResult>;
  reportarFaltante: (payload: { p_item: string; p_tipo?: string; p_cantidad?: number; p_nota?: string }) => Promise<RpcResult>;
  registrarCompra: (payload: { p_ingrediente: string; p_cantidad: number; p_valor: number; p_proveedor?: string; p_inventario?: 'general' | 'porciones'; p_metodo_pago?: string; p_estado_pago?: string }) => Promise<RpcResult>;
  registrarPorciones: (payload: { p_item: string; p_tipo: 'existente' | 'entrada' | 'ajuste'; p_cantidad: number; p_motivo?: string }) => Promise<RpcResult>;
  cerrarPeriodoPorciones: () => Promise<RpcResult>;
  abrirCaja: (base: number) => Promise<RpcResult>;
  cerrarCaja: (contado: number) => Promise<RpcResult>;
  registrar_venta: (payload: SalePayload) => Promise<RpcResult>;
  registrar_gasto: (payload: { p_id: string; p_concepto: string; p_categoria: string; p_valor: number; periodo?: string; metodo_pago?: string; estado?: EstadoGasto }) => Promise<RpcResult>;
  consultar_inventario: () => { ingredientes: Ingrediente[]; bajo_minimo: { ingrediente: string; stock: number; stock_minimo: number; unidad: string }[]; total_items: number };
  generar_reporte: (fecha?: string | null, hasta?: string | null) => Promise<ReporteData>;
  addConceptoGasto: (nombre: string, categoria: string) => void;
}

export interface SalePayload {
  p_id: string;
  p_plato: string;
  p_cantidad: number;
  /** Solo informativo / modo demo: el precio real lo decide la base. */
  p_precio_unitario?: number;
  tamano_porcion?: 'media' | 'entera';
  estado?: EstadoComanda;
  tipo_pedido?: TipoPedido;
  mesa?: string;
  direccion_domicilio?: string;
  telefono_contacto?: string;
  p_acompanamiento?: string;
  p_con_ensalada?: boolean;
  p_con_salsas?: boolean;
  metodo_pago?: MetodoPago | string;
  cliente?: string;
  notas?: string;
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
  const { getValidAccessToken, handleAuthError, isDemo, session, rol } = useAuth();
  const esAdmin = rol === 'admin';

  // En modo real los datos vienen SOLO de Supabase. Los datos de ejemplo existen
  // únicamente en modo demo y se guardan aparte (prefijo restaurante_demo_).
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [conceptosGasto, setConceptosGasto] = useState<ConceptoGasto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [porciones, setPorciones] = useState<ItemPorciones[]>([]);
  const [movimientosPorciones, setMovimientosPorciones] = useState<MovimientoPorciones[]>([]);
  const [caja, setCaja] = useState<CajaActual | null>(null);
  const [consumos, setConsumos] = useState<ConsumoProducto[]>([]);
  const [domiciliarios, setDomiciliarios] = useState<{ email: string; nombre: string }[]>([]);

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
      setProductos(DEMO_PRODUCTOS);
      setPorciones(readDemo('porciones', DEMO_PORCIONES));
      setMovimientosPorciones(readDemo('movimientos_porciones', [] as MovimientoPorciones[]));
      setCaja(readDemo<CajaActual | null>('caja', null));
    } else {
      setProductos([]);
      setConsumos([]);
      setDomiciliarios([]);
      setPorciones([]);
      setMovimientosPorciones([]);
      setCaja(null);
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
  useEffect(() => { if (isDemo) writeDemo('porciones', porciones); }, [isDemo, porciones]);
  useEffect(() => { if (isDemo) writeDemo('movimientos_porciones', movimientosPorciones); }, [isDemo, movimientosPorciones]);
  useEffect(() => { if (isDemo) writeDemo('caja', caja); }, [isDemo, caja]);

  const reporteHoy: ReporteData = React.useMemo(() => {
    const today = getBogotaTodayDateString();
    // Ingreso = venta cobrada (los pedidos pendientes o cancelados no cuentan). Gasto = gasto pagado.
    const ventasHoy = ventas.filter((v) => (!v.fecha || v.fecha === today) && (v.pago_estado ?? 'pagado') === 'pagado' && v.estado !== 'cancelado');
    const gastosHoy = gastos.filter((g) => (!g.fecha || g.fecha === today) && (g.estado ?? 'pagado') === 'pagado');

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
    async (parts: Array<'ing' | 'rec' | 'ven' | 'gas' | 'con' | 'mov' | 'pro' | 'por' | 'mpo' | 'caja' | 'cns' | 'dom'>) => {
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
        pro: async () => setProductos(await fetchProductos(opts)),
        por: async () => setPorciones(await fetchPorciones(opts)),
        mpo: async () => setMovimientosPorciones(await fetchMovimientosPorciones(50, opts)),
        caja: async () => setCaja(esAdmin ? await rpcCajaActual(opts) : null),
        cns: async () => setConsumos(await fetchConsumos(opts)),
        dom: async () => setDomiciliarios(rol === 'admin' || rol === 'domicilios' ? await rpcListarDomiciliarios(opts) : []),
      };
      // Gastos, conceptos y caja son información financiera: solo administración
      const permitidas = parts.filter((p) => esAdmin || !['gas', 'con', 'caja'].includes(p));
      const results = await Promise.allSettled(permitidas.map((p) => jobs[p]()));
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      setLastError(
        failed.length
          ? `No se pudieron cargar algunos datos: ${failed[0].reason instanceof Error ? failed[0].reason.message : 'error de conexión'}`
          : null
      );
    },
    [isDemo, session, getValidAccessToken, handleAuthError, esAdmin, rol]
  );

  const loadAllData = useCallback(async () => {
    if (isDemo || !session) return;
    setIsLoading(true);
    setIsRefreshing(true);
    try {
      await fetchInto(['ing', 'rec', 'ven', 'gas', 'con', 'mov', 'pro', 'por', 'mpo', 'caja', 'cns', 'dom']);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isDemo, session, fetchInto]);

  const reloadVentasEInventario = useCallback(() => fetchInto(['ven', 'ing', 'mov', 'por', 'mpo', 'caja']), [fetchInto]);
  const reloadGastos = useCallback(() => fetchInto(['gas', 'con', 'ing', 'mov', 'por', 'mpo', 'caja']), [fetchInto]);

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

  const executeSale = async (payload: SalePayload): Promise<RpcResult> => {
    // Modo real: solo Supabase (precio, permisos e inventario se resuelven en la base).
    // Si falla, se informa el error y NO se guarda nada localmente.
    if (!isDemo)
      return runRemote(
        (o) =>
          rpcRegistrarVenta(
            {
              p_id: payload.p_id,
              p_plato: payload.p_plato,
              p_cantidad: payload.p_cantidad,
              p_estado: payload.estado,
              p_tipo_pedido: payload.tipo_pedido,
              p_mesa: payload.mesa,
              p_tamano_porcion: payload.tamano_porcion,
              p_acompanamiento: payload.p_acompanamiento,
              p_con_ensalada: payload.p_con_ensalada,
              p_con_salsas: payload.p_con_salsas,
              p_direccion: payload.direccion_domicilio,
              p_telefono: payload.telefono_contacto,
              p_metodo_pago: payload.metodo_pago,
              p_cliente: payload.cliente,
              p_notas: payload.notas,
            },
            o
          ),
        reloadVentasEInventario
      );

    const platoLower = payload.p_plato.toLowerCase().trim();
    const matchingRecipes = recetas.filter((r) => r.plato.toLowerCase().trim() === platoLower);
    
    // Accurate pricing based on portion size and service modality
    let unitPrice =
      precioDeProducto(
        productos.find((p) => p.nombre === platoLower),
        payload.tipo_pedido || 'mesa',
        payload.tamano_porcion
      ) ?? payload.p_precio_unitario;
    if (!unitPrice || unitPrice <= 0) {
      const rec = matchingRecipes[0];
      if (payload.tamano_porcion === 'media' && rec?.precio_media) {
        unitPrice = rec.precio_media;
      } else if (payload.tamano_porcion === 'entera' && rec?.precio_entera) {
        unitPrice = rec.precio_entera;
      } else if (payload.tipo_pedido === 'para_llevar' && rec?.precio_llevar) {
        unitPrice = rec.precio_llevar;
      } else if (payload.tipo_pedido === 'mesa' && rec?.precio_mesa) {
        unitPrice = rec.precio_mesa;
      } else {
        unitPrice = rec?.precio || 20000;
      }
    }

    const total = unitPrice * payload.p_cantidad;
    const today = getBogotaTodayDateString();

    const newSale: Venta = {
      id_operacion: payload.p_id,
      fecha: today,
      plato: payload.p_plato,
      cantidad: payload.p_cantidad,
      total,
      tamano_porcion: payload.tamano_porcion,
      estado: payload.estado || 'pagado',
      pago_estado: (payload.estado || 'pagado') === 'pagado' ? 'pagado' : 'pendiente',
      metodo_pago: payload.metodo_pago || 'efectivo',
      tipo_pedido: payload.tipo_pedido || 'mesa',
      mesa: payload.mesa || (payload.tipo_pedido === 'mesa' ? 'Mesa 1' : undefined),
      direccion_domicilio: payload.direccion_domicilio,
      telefono_contacto: payload.telefono_contacto,
      acompanamiento: payload.p_acompanamiento,
      con_ensalada: payload.p_con_ensalada ?? true,
      con_salsas: payload.p_con_salsas ?? true,
      created_at: new Date().toISOString(),
    };

    setVentas((prev) => [newSale, ...prev]);

    const newMovs: MovimientoInventario[] = [];
    setIngredientes((prev) => {
      const copy = [...prev];

      // 1. Descuento de ingredientes por receta (carnes, bases)
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

      // 2. Descuento de Acompañamiento específico si fue seleccionado
      if (payload.p_acompanamiento && payload.p_acompanamiento !== 'ninguno') {
        const acomp = payload.p_acompanamiento.toLowerCase();
        let acompItemName = '';
        let acompCantPorPorcion = 1;

        if (acomp.includes('patac')) {
          acompItemName = 'patacón';
          acompCantPorPorcion = 2; // 2 patacones por porción
        } else if (acomp.includes('bollo')) {
          acompItemName = 'bollo';
          acompCantPorPorcion = 1;
        } else if (acomp.includes('yuca')) {
          acompItemName = 'yuca';
          acompCantPorPorcion = 0.35; // 0.35 lb de yuca
        } else if (acomp.includes('papa')) {
          acompItemName = 'papa';
          acompCantPorPorcion = 0.35; // 0.35 lb de papa
        }

        if (acompItemName) {
          const acompIdx = copy.findIndex((i) => i.ingrediente.toLowerCase().includes(acompItemName));
          if (acompIdx !== -1) {
            const totalAcomp = Number((acompCantPorPorcion * payload.p_cantidad).toFixed(2));
            copy[acompIdx] = {
              ...copy[acompIdx],
              stock: Math.max(0, Number((copy[acompIdx].stock - totalAcomp).toFixed(2))),
            };
            newMovs.push({
              id: 'mov-' + Date.now() + '-acomp',
              ingrediente: copy[acompIdx].ingrediente,
              delta: -totalAcomp,
              motivo: `Acompañamiento venta: ${capitalizeFirst(acompItemName)}`,
              referencia: payload.p_id,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Descuento de Ensalada fresca si está activada
      if (payload.p_con_ensalada !== false) {
        const ensaladaIdx = copy.findIndex((i) => i.ingrediente.toLowerCase().includes('ensalada'));
        if (ensaladaIdx !== -1) {
          copy[ensaladaIdx] = {
            ...copy[ensaladaIdx],
            stock: Math.max(0, copy[ensaladaIdx].stock - payload.p_cantidad),
          };
          newMovs.push({
            id: 'mov-' + Date.now() + '-ens',
            ingrediente: copy[ensaladaIdx].ingrediente,
            delta: -payload.p_cantidad,
            motivo: `Ensalada fresca (${payload.p_cantidad} porc.)`,
            referencia: payload.p_id,
            created_at: new Date().toISOString(),
          });
        }
      }

      // 4. Descuento de Salsas de la casa si está activada
      if (payload.p_con_salsas !== false) {
        const salsasIdx = copy.findIndex((i) => i.ingrediente.toLowerCase().includes('salsas'));
        if (salsasIdx !== -1) {
          copy[salsasIdx] = {
            ...copy[salsasIdx],
            stock: Math.max(0, copy[salsasIdx].stock - payload.p_cantidad),
          };
          newMovs.push({
            id: 'mov-' + Date.now() + '-sal',
            ingrediente: copy[salsasIdx].ingrediente,
            delta: -payload.p_cantidad,
            motivo: `Salsas de la casa (${payload.p_cantidad} porc.)`,
            referencia: payload.p_id,
            created_at: new Date().toISOString(),
          });
        }
      }

      // 5. Control de desechables y cubiertos para llevar o a domicilio
      if (payload.tipo_pedido === 'domicilio' || payload.tipo_pedido === 'para_llevar') {
        const isSopa = platoLower.includes('sopa');
        const empaqueIdx = copy.findIndex((i) => i.ingrediente.toLowerCase().includes(isSopa ? 'térmico para sopa' : 'para secos'));
        if (empaqueIdx !== -1) {
          copy[empaqueIdx] = {
            ...copy[empaqueIdx],
            stock: Math.max(0, copy[empaqueIdx].stock - payload.p_cantidad),
          };
          newMovs.push({
            id: 'mov-' + Date.now() + '-emp',
            ingrediente: copy[empaqueIdx].ingrediente,
            delta: -payload.p_cantidad,
            motivo: `Empaque para ${payload.tipo_pedido} (${payload.p_cantidad} un.)`,
            referencia: payload.p_id,
            created_at: new Date().toISOString(),
          });
        }

        const cubiertosIdx = copy.findIndex((i) => i.ingrediente.toLowerCase().includes('cubiertos'));
        if (cubiertosIdx !== -1) {
          copy[cubiertosIdx] = {
            ...copy[cubiertosIdx],
            stock: Math.max(0, copy[cubiertosIdx].stock - payload.p_cantidad),
          };
          newMovs.push({
            id: 'mov-' + Date.now() + '-cub',
            ingrediente: copy[cubiertosIdx].ingrediente,
            delta: -payload.p_cantidad,
            motivo: `Cubiertos para ${payload.tipo_pedido}`,
            referencia: payload.p_id,
            created_at: new Date().toISOString(),
          });
        }

        if (payload.tipo_pedido === 'domicilio') {
          const bolsaIdx = copy.findIndex((i) => i.ingrediente.toLowerCase().includes('bolsa'));
          if (bolsaIdx !== -1) {
            copy[bolsaIdx] = {
              ...copy[bolsaIdx],
              stock: Math.max(0, copy[bolsaIdx].stock - 1),
            };
            newMovs.push({
              id: 'mov-' + Date.now() + '-bol',
              ingrediente: copy[bolsaIdx].ingrediente,
              delta: -1,
              motivo: `Bolsa transporte domicilio`,
              referencia: payload.p_id,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      return copy;
    });

    if (newMovs.length > 0) {
      setMovimientos((prev) => [...newMovs, ...prev]);
    }

    const acompMsg = payload.p_acompanamiento ? ` · Acompañamiento: ${capitalizeFirst(payload.p_acompanamiento)}` : '';
    return {
      ok: true,
      mensaje: `Pedido registrado con éxito (${payload.p_cantidad}x ${payload.p_plato}${acompMsg}${payload.tipo_pedido === 'domicilio' ? ' · Domicilio' : ''}). Inventario y empaques descontados.`,
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
    periodo?: string;
    metodo_pago?: MetodoPago | string;
    responsable?: string;
    estado?: EstadoGasto;
  }): Promise<RpcResult> => {
    // Automatically register concept in catalog
    addConceptoGasto(payload.p_concepto, payload.p_categoria);

    // Modo real: solo Supabase. Si falla, se informa el error y NO se guarda nada localmente.
    if (!isDemo)
      return runRemote(
        (o) =>
          rpcRegistrarGasto(
            {
              p_id: payload.p_id,
              p_concepto: payload.p_concepto,
              p_categoria: payload.p_categoria,
              p_valor: payload.p_valor,
              p_metodo_pago: payload.metodo_pago,
              p_responsable: payload.responsable,
              p_estado: payload.estado,
              p_periodo: payload.periodo,
            },
            o
          ),
        reloadGastos
      );

    const today = getBogotaTodayDateString();
    const newGasto: Gasto = {
      id_operacion: payload.p_id,
      fecha: today,
      concepto: payload.p_concepto.toLowerCase(),
      categoria: payload.p_categoria,
      valor: payload.p_valor,
      periodo: payload.periodo || 'Noviembre 2026',
      metodo_pago: payload.metodo_pago || 'efectivo',
      responsable: payload.responsable || 'Administrador',
      estado: payload.estado || 'pagado',
      created_at: new Date().toISOString(),
    };

    setGastos((prev) => [newGasto, ...prev]);

    return {
      ok: true,
      mensaje: `Gasto registrado con éxito (${payload.p_concepto}) · ${newGasto.estado === 'pendiente' ? 'Pendiente' : 'Pagado'}.`,
    };
  };

  const updateOrderStatus = async (
    id_operacion: string,
    nuevoEstado: EstadoComanda,
    extra?: { metodo_pago?: string; motivo?: string; devolver_inventario?: boolean }
  ): Promise<RpcResult> => {
    let res: RpcResult;
    if (!isDemo) {
      res = await runRemote(
        (o) =>
          rpcActualizarEstadoVenta(
            {
              p_id: id_operacion,
              p_estado: nuevoEstado,
              p_metodo_pago: extra?.metodo_pago,
              p_motivo: extra?.motivo,
              p_devolver_inventario: extra?.devolver_inventario,
            },
            o
          ),
        reloadVentasEInventario
      );
    } else {
      setVentas((prev) =>
        prev.map((v) =>
          v.id_operacion === id_operacion
            ? {
                ...v,
                estado: nuevoEstado === 'pagado' ? (v.estado === 'pagado' ? 'entregado' : v.estado) : nuevoEstado,
                pago_estado: nuevoEstado === 'pagado' ? 'pagado' : nuevoEstado === 'cancelado' ? (v.pago_estado === 'pagado' ? 'anulado' : 'cancelado') : v.pago_estado,
                metodo_pago: extra?.metodo_pago || v.metodo_pago,
              }
            : v
        )
      );
      res = { ok: true, mensaje: `Pedido actualizado a "${nuevoEstado.replace('_', ' ')}".` };
    }
    showNotification(res);
    return res;
  };

  const updateExpenseStatus = async (id_operacion: string, nuevoEstado: EstadoGasto, metodo_pago?: string): Promise<RpcResult> => {
    let res: RpcResult;
    if (nuevoEstado !== 'pagado') {
      res = { ok: false, mensaje: 'Un gasto pagado no puede volver a pendiente.' };
    } else if (!isDemo) {
      res = await runRemote((o) => rpcMarcarGastoPagado({ p_id: id_operacion, p_metodo_pago: metodo_pago }, o), reloadGastos);
    } else {
      setGastos((prev) => prev.map((g) => (g.id_operacion === id_operacion ? { ...g, estado: nuevoEstado } : g)));
      res = { ok: true, mensaje: 'Gasto marcado como pagado.' };
    }
    showNotification(res);
    return res;
  };

  const demoNoDisponible = (): RpcResult => ({
    ok: false,
    mensaje: 'Esta operación solo funciona con la base de datos real (inicia sesión con tu cuenta).',
  });

  const asignarDomiciliario = async (id_operacion: string, email: string) =>
    isDemo
      ? demoNoDisponible()
      : runRemote((o) => rpcAsignarDomiciliario({ p_id: id_operacion, p_domiciliario: email }, o), reloadVentasEInventario);

  const reportarFaltante = async (payload: { p_item: string; p_tipo?: string; p_cantidad?: number; p_nota?: string }) =>
    isDemo
      ? { ok: true, mensaje: 'Faltante reportado a administración (modo demo).' }
      : runRemote((o) => rpcReportarFaltante(payload, o), async () => {});

  const registrarCompra = async (payload: {
    p_ingrediente: string;
    p_cantidad: number;
    p_valor: number;
    p_proveedor?: string;
    p_inventario?: 'general' | 'porciones';
    p_metodo_pago?: string;
    p_estado_pago?: string;
  }) =>
    isDemo
      ? demoNoDisponible()
      : runRemote((o) => rpcRegistrarCompra({ ...payload, p_id: generateOperationId('C') }, o), async () => {
          await reloadGastos();
        });

  const registrarPorciones = async (payload: { p_item: string; p_tipo: 'existente' | 'entrada' | 'ajuste'; p_cantidad: number; p_motivo?: string }): Promise<RpcResult> => {
    if (!isDemo) return runRemote((o) => rpcRegistrarPorciones(payload, o), reloadVentasEInventario);
    let total = 0;
    setPorciones((prev) =>
      prev.map((p) => {
        if (p.item !== payload.p_item) return p;
        const next = { ...p };
        if (payload.p_tipo === 'existente') next.existente = payload.p_cantidad;
        if (payload.p_tipo === 'entrada') next.entradas += payload.p_cantidad;
        if (payload.p_tipo === 'ajuste') next.existente += payload.p_cantidad;
        next.total = next.existente + next.entradas - next.ventas;
        total = next.total;
        return next;
      })
    );
    return { ok: true, mensaje: `${payload.p_item}: porciones actualizadas${total ? ` (${total})` : ''}.` };
  };

  const cerrarPeriodoPorciones = async (): Promise<RpcResult> => {
    if (!isDemo) return runRemote((o) => rpcCerrarPeriodoPorciones(o), reloadVentasEInventario);
    setPorciones((prev) => prev.map((p) => ({ ...p, existente: p.total, entradas: 0, ventas: 0 })));
    return { ok: true, mensaje: 'Periodo de porciones cerrado (modo demo).' };
  };

  const abrirCaja = async (base: number): Promise<RpcResult> => {
    if (!isDemo) return runRemote((o) => rpcAbrirCaja({ p_base: base }, o), reloadVentasEInventario);
    setCaja({ id: 1, base, abierta_por: 'demo', abierta_en: new Date().toISOString(), numero_ventas: 0, ventas_efectivo: 0, ventas_otros: 0, ventas_por_metodo: {}, gastos_efectivo: 0, esperado: base });
    return { ok: true, mensaje: 'Caja abierta (modo demo).' };
  };

  const cerrarCaja = async (contado: number): Promise<RpcResult> => {
    if (!caja) return { ok: false, mensaje: 'No hay una caja abierta.' };
    if (!isDemo) return runRemote((o) => rpcCerrarCaja({ p_caja_id: caja.id, p_contado: contado }, o), reloadVentasEInventario);
    setCaja(null);
    return { ok: true, mensaje: `Caja cerrada (modo demo). Diferencia: ${contado - caja.esperado}.` };
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
    tipo_insumo?: TipoInsumo;
  }): Promise<RpcResult> => {
    // Modo real: solo Supabase. Si falla, se informa el error y NO se guarda nada localmente.
    if (!isDemo)
      return runRemote(
        (o) =>
          rpcCrearIngrediente(
            { p_nombre: payload.p_nombre, p_unidad: payload.p_unidad, p_stock: payload.p_stock, p_minimo: payload.p_minimo, p_categoria: payload.tipo_insumo },
            o
          ),
        reloadVentasEInventario
      );

    const newIng: Ingrediente = {
      ingrediente: payload.p_nombre.toLowerCase(),
      unidad: payload.p_unidad,
      stock: payload.p_stock,
      stock_minimo: payload.p_minimo,
      tipo_insumo: payload.tipo_insumo,
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

  const generar_reporte = useCallback(async (fecha?: string | null, hasta?: string | null) => {
    if (isDemo) return reporteHoy;
    const token = await getValidAccessToken();
    const opts = { token, onAuthError: handleAuthError };
    try {
      const desde = fecha || getBogotaTodayDateString();
      const res = hasta ? await rpcReportePeriodo(desde, hasta, opts) : await rpcReporte(fecha || null, opts);
      if (res && typeof res.total_ventas === 'number') {
        return { ...res, total_ventas: Number(res.total_ventas), total_gastos: Number(res.total_gastos), balance: Number(res.balance) };
      }
    } catch (err) {
      showNotification({ ok: false, mensaje: err instanceof Error ? err.message : 'No se pudo generar el reporte.' });
    }
    return reporteHoy;
  }, [isDemo, getValidAccessToken, handleAuthError, reporteHoy, showNotification]);

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
        productos,
        porciones,
        movimientosPorciones,
        caja,
        consumos,
        domiciliarios,
        asignarDomiciliario,
        reportarFaltante,
        registrarCompra,
        registrarPorciones,
        cerrarPeriodoPorciones,
        abrirCaja,
        cerrarCaja,
        executeSale,
        executeExpense,
        executeAdjustStock,
        executeCreateIngredient,
        updateOrderStatus,
        updateExpenseStatus,
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
