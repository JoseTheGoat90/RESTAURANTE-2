/**
 * Funciones de la operación diaria: checklists, vencimientos, comprobantes de pago y cocina.
 * Toda validación y permiso se aplica en Supabase (migración 007); aquí solo se llama.
 */
import { useCallback } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { RpcResult } from '../types.ts';

export interface ChecklistItem {
  id: number;
  texto: string;
  tipo: 'si_no' | 'numero';
  minimo: number | null;
  maximo: number | null;
  obligatorio: boolean;
}

export interface ChecklistDia {
  id: number;
  nombre: string;
  rol: string;
  hora_limite: string;
  hecho: boolean;
  hecho_por: string | null;
  hecho_a: string | null;
  alertas: number;
  vencido: boolean;
  items: ChecklistItem[];
  respuestas: Record<string, boolean | number> | null;
}

export interface LoteVencimiento {
  id: number;
  ingrediente: string;
  cantidad: number;
  unidad: string;
  vence_el: string;
  dias_restantes: number;
  dinero: number;
  referencia: string | null;
}

export interface Vencimientos {
  lotes: LoteVencimiento[];
  dinero_en_riesgo: number;
  sin_fecha: { ingrediente: string; stock: number; unidad: string }[];
}

// ---------- Datos de ejemplo (modo demo: nunca tocan la base) ----------
const hoyMas = (d: number) => {
  const f = new Date();
  f.setDate(f.getDate() + d);
  return f.toISOString().slice(0, 10);
};

export const DEMO_CHECKLISTS: ChecklistDia[] = [
  {
    id: 1, nombre: 'Apertura de cocina', rol: 'cocina', hora_limite: '10:30', hecho: true, hecho_por: 'cocina@demo',
    hecho_a: '10:12', alertas: 0, vencido: false, respuestas: null,
    items: [
      { id: 1, texto: 'Gas abierto y sin fugas', tipo: 'si_no', minimo: null, maximo: null, obligatorio: true },
      { id: 2, texto: 'Temperatura de la nevera (°C)', tipo: 'numero', minimo: 0, maximo: 4, obligatorio: true },
    ],
  },
  {
    id: 4, nombre: 'Limpieza de turno', rol: 'cocina', hora_limite: '16:00', hecho: false, hecho_por: null,
    hecho_a: null, alertas: 0, vencido: false, respuestas: null,
    items: [
      { id: 10, texto: 'Superficies y mesones limpios', tipo: 'si_no', minimo: null, maximo: null, obligatorio: true },
      { id: 11, texto: 'Trampa de grasa revisada', tipo: 'si_no', minimo: null, maximo: null, obligatorio: true },
      { id: 12, texto: 'Temperatura del congelador (°C)', tipo: 'numero', minimo: -25, maximo: -15, obligatorio: true },
    ],
  },
];

export const DEMO_VENCIMIENTOS: Vencimientos = {
  dinero_en_riesgo: 61500,
  lotes: [
    { id: 1, ingrediente: 'pollo', cantidad: 3000, unidad: 'g', vence_el: hoyMas(0), dias_restantes: 0, dinero: 54000, referencia: 'demo' },
    { id: 2, ingrediente: 'lechuga', cantidad: 2, unidad: 'unidad', vence_el: hoyMas(2), dias_restantes: 2, dinero: 7500, referencia: 'demo' },
    { id: 3, ingrediente: 'lomo de res fino', cantidad: 2000, unidad: 'g', vence_el: hoyMas(5), dias_restantes: 5, dinero: 76000, referencia: 'demo' },
  ],
  sin_fecha: [{ ingrediente: 'arroz', stock: 4600, unidad: 'g' }],
};

// ---------- Llamadas ----------
async function llamar<T>(nombre: string, cuerpo: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) {
    let msg = `Error en la base de datos (${res.status})`;
    try {
      const e = await res.json();
      msg = e.message || e.error || msg;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Reduce la foto a 1280 px de lado mayor en JPEG: una captura de Nequi pasa de ~3 MB a ~150 KB. */
async function comprimirImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b || archivo), 'image/jpeg', 0.82));
  } catch {
    return archivo;
  }
}

/** Funciones de la operación con el token del usuario ya resuelto. */
export function useOperacion() {
  const { getValidAccessToken, isDemo } = useAuth();

  const conToken = useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
      return fn(token);
    },
    [getValidAccessToken]
  );

  const checklistsHoy = useCallback(
    () => (isDemo ? Promise.resolve(DEMO_CHECKLISTS) : conToken((t) => llamar<ChecklistDia[]>('checklists_hoy', {}, t))),
    [isDemo, conToken]
  );

  const guardarChecklist = useCallback(
    (plantillaId: number, respuestas: Record<string, boolean | number>) =>
      isDemo
        ? Promise.resolve<RpcResult>({ ok: true, mensaje: 'Modo demo: el checklist no se guarda en la base.' })
        : conToken((t) => llamar<RpcResult>('guardar_checklist', { p_plantilla_id: plantillaId, p_respuestas: respuestas }, t)),
    [isDemo, conToken]
  );

  const vencimientos = useCallback(
    (dias = 7) =>
      isDemo ? Promise.resolve(DEMO_VENCIMIENTOS) : conToken((t) => llamar<Vencimientos>('vencimientos', { p_dias: dias }, t)),
    [isDemo, conToken]
  );

  const fijarVidaUtil = useCallback(
    (ingrediente: string, dias: number | null) =>
      isDemo
        ? Promise.resolve<RpcResult>({ ok: true, mensaje: 'Modo demo: no se guarda.' })
        : conToken((t) => llamar<RpcResult>('fijar_vida_util', { p_ingrediente: ingrediente, p_dias: dias }, t)),
    [isDemo, conToken]
  );

  const registrarMerma = useCallback(
    (ingrediente: string, cantidad: number, motivo: string) =>
      isDemo
        ? Promise.resolve<RpcResult>({ ok: true, mensaje: 'Modo demo: la merma no se guarda.' })
        : conToken((t) => llamar<RpcResult>('registrar_merma', { p_ingrediente: ingrediente, p_cantidad: cantidad, p_motivo: motivo }, t)),
    [isDemo, conToken]
  );

  const marcarDisponible = useCallback(
    (producto: string, disponible: boolean) =>
      isDemo
        ? Promise.resolve<RpcResult>({ ok: true, mensaje: 'Modo demo: no se guarda.' })
        : conToken((t) => llamar<RpcResult>('marcar_disponible', { p_producto: producto, p_disponible: disponible }, t)),
    [isDemo, conToken]
  );

  /** Sube la foto al bucket privado "comprobantes" y la une a la venta. */
  const adjuntarComprobante = useCallback(
    async (p: { ventaId: string; archivo: File; metodo: string; monto: number | null; referencia: string }): Promise<RpcResult> => {
      if (isDemo) return { ok: true, mensaje: 'Modo demo: la foto no se sube.' };
      return conToken(async (t) => {
        const foto = await comprimirImagen(p.archivo);
        const ruta = `${new Date().toISOString().slice(0, 10)}/${p.ventaId}-${Date.now()}.jpg`;
        const subida = await fetch(`${SUPABASE_URL}/storage/v1/object/comprobantes/${ruta}`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': foto.type || 'image/jpeg' },
          body: foto,
        });
        if (!subida.ok) {
          let msg = `No se pudo subir la foto (${subida.status}).`;
          try {
            const e = await subida.json();
            msg = e.message || e.error || msg;
          } catch {
            /* sin cuerpo JSON */
          }
          return { ok: false, mensaje: msg };
        }
        return llamar<RpcResult>(
          'adjuntar_comprobante',
          { p_venta_id: p.ventaId, p_foto_path: ruta, p_metodo: p.metodo, p_monto: p.monto, p_referencia: p.referencia || null },
          t
        );
      });
    },
    [isDemo, conToken]
  );

  return { checklistsHoy, guardarChecklist, vencimientos, fijarVidaUtil, registrarMerma, marcarDisponible, adjuntarComprobante };
}
