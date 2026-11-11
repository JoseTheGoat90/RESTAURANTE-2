/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnidadMedida = 'g' | 'kg' | 'lb' | 'l' | 'ml' | 'unidad' | 'porcion' | 'paquete' | 'bolsa' | 'botella';

export type TipoInsumo =
  | 'granos_legumbres'
  | 'tuberculos_vegetales'
  | 'verduras_hortalizas'
  | 'carnes_proteinas'
  | 'otros_ingredientes'
  | 'salsas_condimentos'
  | 'desechables'
  | 'limpieza'
  | 'bebidas'
  | 'otro';

export type Rol = 'admin' | 'cocina' | 'parrilla' | 'mesera' | 'domicilios' | 'domiciliario';

export type CategoriaProducto = 'almuerzos' | 'asados' | 'bebidas' | string;

export interface Producto {
  id?: number;
  nombre: string;
  categoria: CategoriaProducto;
  precio: number | null; // mesa (almuerzos) · porción entera (asados) · precio único (bebidas)
  precio_llevar: number | null;
  precio_media: number | null;
  presentacion?: string | null;
  unidad?: string | null;
  disponible: boolean;
  activo: boolean;
  estacion?: string;
}

export interface ItemPorciones {
  item: string;
  grupo: 'asado' | 'ejecutivo' | 'otro';
  existente: number;
  entradas: number;
  ventas: number;
  total: number;
  minimo: number;
  periodo_desde?: string;
  activo: boolean;
}

export interface MovimientoPorciones {
  id: number;
  item: string;
  tipo: 'existente' | 'entrada' | 'venta' | 'reversion' | 'ajuste' | 'cierre';
  cantidad: number;
  total_anterior: number | null;
  total_nuevo: number | null;
  motivo?: string;
  referencia?: string;
  usuario: string;
  created_at: string;
}

export interface ConsumoProducto {
  id: number;
  producto: string;
  variante: 'media' | 'entera' | 'mesa' | 'para_llevar' | 'domicilio' | null;
  tipo: 'porcion' | 'ingrediente';
  item: string;
  cantidad: number;
}

export interface CajaActual {
  id: number;
  base: number;
  abierta_por: string;
  abierta_en: string;
  numero_ventas: number;
  ventas_efectivo: number;
  ventas_otros: number;
  ventas_por_metodo: Record<string, number>;
  gastos_efectivo: number;
  esperado: number;
}

export type CategoriaGasto =
  | 'servicios'
  | 'seguridad'
  | 'compras'
  | 'insumos'
  | 'ingredientes'
  | 'nomina'
  | 'aseo'
  | 'mantenimiento'
  | 'transporte'
  | 'reparaciones'
  | 'otros';

export type MetodoPago = 'efectivo' | 'nequi' | 'tarjeta' | 'transferencia' | 'credito';

export type EstadoGasto = 'pagado' | 'pendiente';

export type TipoPedido = 'mesa' | 'domicilio' | 'para_llevar';

export type TamanoPorcion = 'media' | 'entera';

export interface Ingrediente {
  ingrediente: string;
  unidad: string;
  stock: number;
  stock_minimo: number;
  tipo_insumo?: TipoInsumo;
}

export interface Receta {
  plato: string;
  ingrediente: string;
  cantidad: number;
  precio: number;
  precio_media?: number;
  precio_entera?: number;
  precio_llevar?: number;
  precio_mesa?: number;
}

export type EstadoComanda = 'nuevo' | 'en_cocina' | 'en_camino' | 'listo' | 'entregado' | 'pagado' | 'cancelado';

export interface Venta {
  id_operacion: string;
  fecha: string;
  plato: string;
  cantidad: number;
  total: number;
  tamano_porcion?: TamanoPorcion;
  estado?: EstadoComanda;
  tipo_pedido?: TipoPedido;
  mesa?: string;
  direccion_domicilio?: string;
  telefono_contacto?: string;
  acompanamiento?: string;
  con_ensalada?: boolean;
  con_salsas?: boolean;
  categoria?: string;
  precio_unitario?: number;
  metodo_pago?: MetodoPago | string;
  pago_estado?: 'pagado' | 'pendiente' | 'cancelado' | 'anulado';
  cliente?: string;
  notas?: string;
  domiciliario?: string;
  registrado_por?: string;
  cobrado_por?: string;
  estacion?: string;
  created_at?: string;
}

export interface Gasto {
  id_operacion: string;
  fecha: string;
  concepto: string;
  categoria: CategoriaGasto | string;
  valor: number;
  periodo?: string;
  metodo_pago?: MetodoPago | string;
  responsable?: string;
  estado?: EstadoGasto;
  created_at?: string;
}

export interface ConceptoGasto {
  nombre: string;
  categoria: CategoriaGasto | string;
}

export interface MovimientoInventario {
  id: string | number;
  ingrediente: string;
  delta: number;
  motivo: string;
  referencia?: string;
  created_at?: string;
  usuario?: string;
  stock_anterior?: number | null;
  stock_nuevo?: number | null;
}

export interface RpcResult {
  ok: boolean;
  mensaje: string;
}

export interface IngredienteBajoMinimo {
  ingrediente: string;
  stock: number;
  stock_minimo: number;
  unidad: string;
}

export interface MovimientoReporte {
  ingrediente: string;
  delta: number;
  unidad: string;
  motivo: string;
  fecha?: string;
}

export interface ReporteData {
  periodo?: string;
  numero_ventas: number;
  total_ventas: number;
  total_gastos: number;
  balance: number;
  unidades_por_plato?: Record<string, number>;
  gastos_por_categoria?: Record<string, number>;
  ingredientes_bajo_minimo?: IngredienteBajoMinimo[];
  movimientos_inventario?: MovimientoReporte[];
  gastos_pendientes?: number;
  total_compras?: number;
  ventas_por_categoria?: Record<string, number>;
  ventas_por_modalidad?: Record<string, number>;
  ventas_por_metodo?: Record<string, number>;
  porciones_bajas?: { item: string; total: number; minimo: number }[];
  nota_balance?: string;
}

export interface PlatoBajaRotacion {
  plato: string;
  unidades_60_dias: number;
}

export interface ProyeccionData {
  mes?: string;
  dias_transcurridos?: number;
  dias_del_mes?: number;
  ventas_mes_actual?: number;
  gastos_mes_actual?: number;
  proyeccion_ventas_mes?: number;
  proyeccion_gastos_mes?: number;
  ventas_mismo_mes_anio_anterior?: number;
  dias_con_ventas_en_historial?: number;
  confiable?: boolean;
  baja_rotacion?: PlatoBajaRotacion[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp in ms
  userEmail: string;
  isDemo?: boolean; // datos de ejemplo solo en este navegador; nunca toca la base
  rol?: Rol; // cargo del empleado (validado también en el servidor)
  nombre?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}
