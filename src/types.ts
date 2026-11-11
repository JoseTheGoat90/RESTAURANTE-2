/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnidadMedida = 'g' | 'kg' | 'lb' | 'unidad' | 'porcion' | 'paquete';

export type TipoInsumo =
  | 'granos_legumbres'
  | 'tuberculos_vegetales'
  | 'verduras_hortalizas'
  | 'carnes_proteinas'
  | 'otros_ingredientes'
  | 'salsas_condimentos'
  | 'desechables'
  | 'limpieza'
  | 'otro';

export type CategoriaGasto = 'servicios' | 'seguridad' | 'insumos' | 'otros' | 'nomina' | 'ingredientes';

export type MetodoPago = 'efectivo' | 'nequi' | 'tarjeta' | 'credito';

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
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}
