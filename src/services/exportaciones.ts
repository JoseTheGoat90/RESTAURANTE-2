/**
 * Exportaciones del reporte: Excel (.xlsx con varias hojas) y PDF con formato.
 * Las librerías se cargan solo al exportar, para no hacer más pesada la app.
 */
import { SUPABASE_URL, SUPABASE_KEY } from '../config.ts';
import { ReporteData, Venta, Gasto, ItemPorciones, Ingrediente } from '../types.ts';

export interface DatosExportacion {
  restaurante: string;
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  reporte: ReporteData;
  ventas: Venta[];
  gastos: Gasto[];
  porciones: ItemPorciones[];
  ingredientes: Ingrediente[];
  generadoPor?: string;
}

// ---------- Utilidades ----------
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const pesos = (n: number | null | undefined) => COP.format(Number(n) || 0);
const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

function fechaLarga(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
export function textoPeriodo(desde: string, hasta: string) {
  return desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde)} al ${fechaLarga(hasta)}`;
}
function fechaHora(v?: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' }).format(d);
}
/** "Mesa 3", "Para llevar" o "Domicilio" sin repetir la palabra mesa. */
function donde(v: Venta) {
  if (v.mesa) return /^mesa/i.test(v.mesa) ? v.mesa : `Mesa ${v.mesa}`;
  return cap(v.tipo_pedido);
}
const ahora = () => new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date());
const nombreArchivo = (d: DatosExportacion, ext: string) => `reporte_${d.desde}${d.hasta !== d.desde ? '_a_' + d.hasta : ''}.${ext}`;
const entradas = (o?: Record<string, number>) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
const sumar = (o?: Record<string, number>) => Object.values(o || {}).reduce((a, c) => a + (Number(c) || 0), 0);
const pct = (v: number, total: number) => (total > 0 ? v / total : 0);

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ingresos por producto calculados desde el detalle (el reporte solo trae unidades). */
function ingresosPorProducto(ventas: Venta[]) {
  const m: Record<string, number> = {};
  ventas.forEach((v) => (m[v.plato] = (m[v.plato] || 0) + (Number(v.total) || 0)));
  return m;
}

/** Asados: porciones enteras y medias vendidas (la media cuenta como 0,5 porción). */
export function carnesPorPresentacion(ventas: Venta[]) {
  const m: Record<string, { enteras: number; medias: number; ingresos: number }> = {};
  ventas
    .filter((v) => v.categoria === 'asados' || v.tamano_porcion === 'media' || /asado/i.test(v.plato))
    .forEach((v) => {
      const k = v.plato;
      m[k] ??= { enteras: 0, medias: 0, ingresos: 0 };
      const c = Number(v.cantidad) || 0;
      if (v.tamano_porcion === 'media') m[k].medias += c;
      else m[k].enteras += c;
      m[k].ingresos += Number(v.total) || 0;
    });
  return Object.entries(m)
    .map(([plato, x]) => ({ plato, ...x, equivalente: x.enteras + x.medias * 0.5 }))
    .sort((a, b) => b.equivalente - a.equivalente);
}

function estadoPorcion(p: ItemPorciones) {
  if (p.total <= 0) return 'Agotado';
  if (p.minimo > 0 && p.total <= p.minimo) return 'Pedir';
  return 'OK';
}
function estadoInsumo(i: Ingrediente) {
  if (i.stock <= 0) return 'Agotado';
  if (i.stock_minimo > 0 && i.stock < i.stock_minimo) return 'Bajo mínimo';
  if (i.stock_minimo > 0 && i.stock < i.stock_minimo * 1.5) return 'Por agotarse';
  return 'OK';
}

// ---------- Detalle desde la base ----------
function diaSiguiente(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Ventas cobradas (por fecha de pago, hora Colombia) y gastos del periodo. */
export async function obtenerDetalle(desde: string, hasta: string, token: string): Promise<{ ventas: Venta[]; gastos: Gasto[] }> {
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const ini = encodeURIComponent(`${desde}T00:00:00-05:00`);
  const fin = encodeURIComponent(`${diaSiguiente(hasta)}T00:00:00-05:00`);
  const camposV = 'id_operacion,fecha,plato,categoria,cantidad,precio_unitario,total,tipo_pedido,mesa,tamano_porcion,metodo_pago,pago_estado,registrado_por,cobrado_por,comanda_id,created_at,pagado_en';
  const [rv, rg] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/ventas?select=${camposV}&pago_estado=eq.pagado&pagado_en=gte.${ini}&pagado_en=lt.${fin}&order=pagado_en.asc&limit=5000`, { headers: h }),
    fetch(`${SUPABASE_URL}/rest/v1/gastos?select=id_operacion,fecha,concepto,categoria,valor,metodo_pago,responsable,estado&anulado=eq.false&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc&limit=5000`, { headers: h }),
  ]);
  if (!rv.ok || !rg.ok) throw new Error('No se pudo leer el detalle del periodo.');
  return { ventas: await rv.json(), gastos: await rg.json() };
}

/** En modo demo: filtra lo que hay en el navegador. */
export function detalleLocal(desde: string, hasta: string, ventas: Venta[], gastos: Gasto[]) {
  const dentro = (f?: string) => {
    const d = String(f || '').slice(0, 10);
    return d >= desde && d <= hasta;
  };
  return {
    ventas: ventas.filter((v) => v.pago_estado !== 'pendiente' && v.pago_estado !== 'anulado' && dentro(v.fecha || v.created_at)),
    gastos: gastos.filter((g) => dentro(g.fecha)),
  };
}

// ---------- Excel ----------
export async function exportarExcel(d: DatosExportacion) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = d.restaurante;
  wb.created = new Date();
  const r = d.reporte;
  const FMT = '"$" #,##0;[Red]-"$" #,##0';
  const OSCURO = 'FF1B1F2A';
  const SUAVE = 'FFF3F1EC';

  type Hoja = ReturnType<typeof wb.addWorksheet>;
  const encabezado = (ws: Hoja, fila: number, cols: number) => {
    const row = ws.getRow(fila);
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OSCURO } };
      cell.alignment = { vertical: 'middle' };
    }
    row.height = 20;
  };
  const titulo = (ws: Hoja, texto: string, cols: number) => {
    ws.mergeCells(1, 1, 1, cols);
    ws.getCell(1, 1).value = `${d.restaurante} · ${texto}`;
    ws.getCell(1, 1).font = { bold: true, size: 14 };
    ws.mergeCells(2, 1, 2, cols);
    ws.getCell(2, 1).value = `Periodo: ${textoPeriodo(d.desde, d.hasta)}   ·   Generado: ${ahora()}`;
    ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF5A6170' } };
  };
  /** Tabla con encabezado oscuro, filas alternas y fila de total con fórmula. */
  const tabla = (ws: Hoja, filaIni: number, cab: string[], filas: (string | number | Date | null)[][], formatos: (string | null)[], totales: number[] = []) => {
    ws.getRow(filaIni).values = cab;
    encabezado(ws, filaIni, cab.length);
    filas.forEach((f, i) => {
      const row = ws.getRow(filaIni + 1 + i);
      row.values = f;
      formatos.forEach((fmt, c) => fmt && (row.getCell(c + 1).numFmt = fmt));
      if (i % 2 === 1) for (let c = 1; c <= cab.length; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUAVE } };
    });
    const filaFin = filaIni + filas.length;
    if (totales.length && filas.length) {
      const row = ws.getRow(filaFin + 1);
      row.getCell(1).value = 'Total';
      totales.forEach((c) => {
        const letra = ws.getColumn(c).letter;
        row.getCell(c).value = { formula: `SUM(${letra}${filaIni + 1}:${letra}${filaFin})` };
        row.getCell(c).numFmt = formatos[c - 1] || '#,##0';
      });
      row.font = { bold: true };
      row.eachCell((cell) => (cell.border = { top: { style: 'thin' } }));
      return filaFin + 1;
    }
    return filaFin;
  };

  // Hoja 1: Resumen
  const res = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  res.columns = [{ width: 34 }, { width: 18 }, { width: 12 }, { width: 4 }, { width: 30 }, { width: 18 }, { width: 12 }];
  titulo(res, 'Reporte de ventas y gastos', 7);
  const kpis: [string, number, string][] = [
    ['Ingresos (ventas cobradas)', r.total_ventas, FMT],
    ['Gastos pagados', r.total_gastos, FMT],
    ['Balance (ingresos − gastos)', r.balance, FMT],
    ['Pedidos cobrados', r.numero_ventas, '#,##0'],
    ['Ticket promedio', r.numero_ventas ? r.total_ventas / r.numero_ventas : 0, FMT],
    ['Gastos pendientes de pago', r.gastos_pendientes ?? 0, FMT],
    ['Compras del periodo', r.total_compras ?? 0, FMT],
  ];
  res.getRow(4).values = ['Indicador', 'Valor'];
  encabezado(res, 4, 2);
  kpis.forEach(([k, v, f], i) => {
    const row = res.getRow(5 + i);
    row.values = [k, v];
    row.getCell(2).numFmt = f;
    if (k.startsWith('Balance')) row.font = { bold: true, color: { argb: v >= 0 ? 'FF0F7B4A' : 'FFC0262D' } };
  });
  // Desgloses con participación
  let fila = 5 + kpis.length + 2;
  const desglose = (col: number, filaIni: number, nombre: string, o?: Record<string, number>) => {
    const total = sumar(o);
    const filas = entradas(o).map(([k, v]) => [cap(k), v, pct(v, total)]);
    const cab = [nombre, 'Valor', '%'];
    const hoja = res;
    hoja.getRow(filaIni).getCell(col).value = cab[0];
    hoja.getRow(filaIni).getCell(col + 1).value = cab[1];
    hoja.getRow(filaIni).getCell(col + 2).value = cab[2];
    [0, 1, 2].forEach((i) => {
      const c = hoja.getRow(filaIni).getCell(col + i);
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OSCURO } };
    });
    filas.forEach((f, i) => {
      const row = hoja.getRow(filaIni + 1 + i);
      row.getCell(col).value = f[0] as string;
      row.getCell(col + 1).value = f[1] as number;
      row.getCell(col + 1).numFmt = FMT;
      row.getCell(col + 2).value = f[2] as number;
      row.getCell(col + 2).numFmt = '0%';
    });
    if (!filas.length) hoja.getRow(filaIni + 1).getCell(col).value = 'Sin datos';
    return filaIni + Math.max(filas.length, 1) + 2;
  };
  const a = desglose(1, fila, 'Medio de pago', r.ventas_por_metodo);
  const b = desglose(5, fila, 'Modalidad', r.ventas_por_modalidad);
  fila = Math.max(a, b);
  desglose(1, fila, 'Categoría de venta', r.ventas_por_categoria);
  desglose(5, fila, 'Categoría de gasto', r.gastos_por_categoria);

  // Hoja 2: Productos
  const prod = wb.addWorksheet('Productos', { views: [{ state: 'frozen', ySplit: 4 }] });
  prod.columns = [{ width: 38 }, { width: 14 }, { width: 18 }, { width: 12 }];
  titulo(prod, 'Productos vendidos', 4);
  const ing = ingresosPorProducto(d.ventas);
  const totalIng = sumar(ing);
  const filasProd = entradas(r.unidades_por_plato).map(([p, u]) => [cap(p), u, ing[p] ?? null, ing[p] ? pct(ing[p], totalIng) : null]);
  tabla(prod, 4, ['Producto', 'Unidades', 'Ingresos', '% ingresos'], filasProd, [null, '#,##0', FMT, '0%'], [2, 3]);

  // Hoja 3: Ventas (detalle)
  const ven = wb.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 4 }] });
  ven.columns = [{ width: 17 }, { width: 13 }, { width: 10 }, { width: 34 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 22 }, { width: 22 }];
  titulo(ven, 'Detalle de ventas cobradas', 10);
  const filasV = d.ventas.map((v) => [
    fechaHora((v as Venta & { pagado_en?: string }).pagado_en || v.created_at || v.fecha),
    cap(v.tipo_pedido), v.mesa || '', cap(v.plato) + (v.tamano_porcion === 'media' ? ' (media)' : ''),
    Number(v.cantidad) || 0, Number(v.precio_unitario) || null, Number(v.total) || 0, cap(String(v.metodo_pago || '')),
    v.registrado_por || '', v.cobrado_por || '',
  ]);
  const finV = tabla(ven, 4, ['Fecha y hora', 'Modalidad', 'Mesa', 'Producto', 'Cantidad', 'Precio unit.', 'Total', 'Medio', 'Registró', 'Cobró'], filasV, [null, null, null, null, '#,##0', FMT, FMT, null, null, null], [5, 7]);
  if (filasV.length) ven.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filasV.length, column: 10 } };
  else ven.getCell(5, 1).value = 'Sin ventas cobradas en el periodo.';
  void finV;

  // Hoja 4: Gastos (detalle)
  const gas = wb.addWorksheet('Gastos', { views: [{ state: 'frozen', ySplit: 4 }] });
  gas.columns = [{ width: 13 }, { width: 38 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 13 }, { width: 22 }];
  titulo(gas, 'Detalle de gastos', 7);
  const filasG = d.gastos.map((g) => [g.fecha, g.concepto, cap(String(g.categoria)), Number(g.valor) || 0, cap(String(g.metodo_pago || '')), cap(g.estado || ''), g.responsable || '']);
  tabla(gas, 4, ['Fecha', 'Concepto', 'Categoría', 'Valor', 'Medio', 'Estado', 'Responsable'], filasG, [null, null, null, FMT, null, null, null], [4]);
  if (filasG.length) gas.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filasG.length, column: 7 } };
  else gas.getCell(5, 1).value = 'Sin gastos en el periodo.';

  // Hoja 5: Carnes por porción (planilla + ventas por presentación)
  const car = wb.addWorksheet('Carnes (porciones)', { views: [{ showGridLines: false }] });
  car.columns = [{ width: 32 }, { width: 13 }, { width: 12 }, { width: 17 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 13 }];
  titulo(car, 'Carnes por porción', 8);
  car.getCell(3, 1).value = 'Planilla de porciones (estado actual)';
  car.getCell(3, 1).font = { bold: true, color: { argb: 'FFC2571B' } };
  const filasP = d.porciones.map((p) => [cap(p.item), cap(p.grupo), p.existente, p.entradas, p.ventas, p.total, p.minimo || null, estadoPorcion(p)]);
  let fC = tabla(car, 4, ['Corte / plato', 'Grupo', 'Existente', 'Entradas', 'Ventas', 'Total', 'Mínimo', 'Estado'], filasP, [null, null, '#,##0', '#,##0', '#,##0', '#,##0', '#,##0', null], [3, 4, 5, 6]);
  for (let i = 0; i < filasP.length; i++) {
    const c = car.getCell(5 + i, 8);
    if (c.value !== 'OK') c.font = { bold: true, color: { argb: 'FFC0262D' } };
  }
  if (!filasP.length) car.getCell(5, 1).value = 'Sin planilla de porciones cargada.';
  fC += 3;
  car.getCell(fC, 1).value = 'Asados vendidos en el periodo por presentación (media = 0,5 porción)';
  car.getCell(fC, 1).font = { bold: true, color: { argb: 'FFC2571B' } };
  const carnes = carnesPorPresentacion(d.ventas);
  tabla(car, fC + 1, ['Plato', 'Enteras', 'Medias', 'Porciones equiv.', 'Ingresos'],
    carnes.map((c) => [cap(c.plato), c.enteras, c.medias, c.equivalente, c.ingresos]), [null, '#,##0', '#,##0', '#,##0.0', FMT], [2, 3, 4, 5]);
  if (!carnes.length) car.getCell(fC + 2, 1).value = 'Sin asados vendidos en el periodo.';

  // Hoja 6: Inventario de insumos completo
  const inv = wb.addWorksheet('Inventario', { views: [{ state: 'frozen', ySplit: 4 }] });
  inv.columns = [{ width: 30 }, { width: 22 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 10 }, { width: 14 }];
  titulo(inv, 'Inventario de insumos', 7);
  const orden: Record<string, number> = { Agotado: 0, 'Bajo mínimo': 1, 'Por agotarse': 2, OK: 3 };
  const filasI = [...d.ingredientes]
    .sort((x, y) => orden[estadoInsumo(x)] - orden[estadoInsumo(y)] || x.ingrediente.localeCompare(y.ingrediente))
    .map((i) => [cap(i.ingrediente), cap(i.tipo_insumo || ''), i.stock, i.stock_minimo, Math.max(0, i.stock_minimo - i.stock) || null, i.unidad, estadoInsumo(i)]);
  tabla(inv, 4, ['Insumo', 'Tipo', 'Existencia', 'Mínimo', 'Faltante', 'Unidad', 'Estado'], filasI, [null, null, '#,##0.0#', '#,##0.0#', '#,##0.0#', null, null]);
  filasI.forEach((f, i) => {
    if (f[6] !== 'OK') inv.getCell(5 + i, 7).font = { bold: true, color: { argb: f[6] === 'Por agotarse' ? 'FFB45309' : 'FFC0262D' } };
  });
  if (filasI.length) inv.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filasI.length, column: 7 } };
  else inv.getCell(5, 1).value = 'Sin insumos registrados.';

  const buf = await wb.xlsx.writeBuffer();
  descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo(d, 'xlsx'));
}

// ---------- PDF ----------
export async function exportarPDF(d: DatosExportacion) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const r = d.reporte;
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const OSCURO: [number, number, number] = [27, 31, 42];
  const ACENTO: [number, number, number] = [194, 87, 27];
  const GRIS: [number, number, number] = [90, 97, 112];

  // Encabezado
  doc.setFillColor(...OSCURO);
  doc.rect(0, 0, W, 86, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(d.restaurante, M, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Reporte de ventas y gastos', M, 58);
  doc.text(`Periodo: ${textoPeriodo(d.desde, d.hasta)}`, W - M, 38, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`Generado: ${ahora()}${d.generadoPor ? ' · ' + d.generadoPor : ''}`, W - M, 58, { align: 'right' });

  // Indicadores
  const kpis: [string, string, [number, number, number]][] = [
    ['Ingresos', pesos(r.total_ventas), [42, 120, 214]],
    ['Gastos', pesos(r.total_gastos), [235, 104, 52]],
    ['Balance', pesos(r.balance), r.balance >= 0 ? [15, 123, 74] : [192, 38, 45]],
    ['Pedidos', String(r.numero_ventas), OSCURO],
  ];
  const kw = (W - 2 * M - 3 * 10) / 4;
  kpis.forEach(([k, v, color], i) => {
    const x = M + i * (kw + 10);
    doc.setFillColor(246, 244, 239);
    doc.roundedRect(x, 104, kw, 62, 6, 6, 'F');
    doc.setTextColor(...GRIS);
    doc.setFontSize(9);
    doc.text(k.toUpperCase(), x + 12, 124);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(v, x + 12, 150);
    doc.setFont('helvetica', 'normal');
  });
  doc.setTextColor(...GRIS);
  doc.setFontSize(8.5);
  const extra = [
    r.numero_ventas ? `Ticket promedio: ${pesos(r.total_ventas / r.numero_ventas)}` : '',
    r.gastos_pendientes ? `Gastos pendientes de pago: ${pesos(r.gastos_pendientes)}` : '',
    r.total_compras ? `Compras: ${pesos(r.total_compras)}` : '',
  ].filter(Boolean).join('   ·   ');
  if (extra) doc.text(extra, M, 184);

  let y = 200;
  const estilo = {
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: [225, 221, 212] as [number, number, number], lineWidth: 0.5 },
    headStyles: { fillColor: OSCURO, textColor: 255, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [249, 248, 245] as [number, number, number] },
    footStyles: { fillColor: [240, 237, 230] as [number, number, number], textColor: OSCURO, fontStyle: 'bold' as const },
    margin: { left: M, right: M },
  };
  const seccion = (t: string) => {
    if (y > doc.internal.pageSize.getHeight() - 90) {
      doc.addPage();
      y = 50;
    }
    doc.setTextColor(...ACENTO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(t, M, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
  };
  const tras = () => ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || y) + 22;

  // Desgloses lado a lado
  const mitad = (W - 2 * M - 16) / 2;
  const desglose = (o: Record<string, number> | undefined, titulo: string, x: number, startY: number) => {
    const total = sumar(o);
    const body = entradas(o).map(([k, v]) => [cap(k), pesos(v), `${Math.round(pct(v, total) * 100)}%`]);
    autoTable(doc, {
      ...estilo, startY, tableWidth: mitad, margin: { left: x, right: M },
      head: [[titulo, 'Valor', '%']],
      body: body.length ? body : [['Sin datos', '', '']],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', cellWidth: 36 } },
    });
    return tras();
  };
  seccion('Cómo entró el dinero');
  y = Math.max(desglose(r.ventas_por_metodo, 'Medio de pago', M, y), desglose(r.ventas_por_modalidad, 'Modalidad', M + mitad + 16, y));
  seccion('Ventas y gastos por categoría');
  y = Math.max(desglose(r.ventas_por_categoria, 'Categoría de venta', M, y), desglose(r.gastos_por_categoria, 'Categoría de gasto', M + mitad + 16, y));

  // Productos
  const ing = ingresosPorProducto(d.ventas);
  const prods = entradas(r.unidades_por_plato);
  if (prods.length) {
    seccion('Productos vendidos');
    autoTable(doc, {
      ...estilo, startY: y,
      head: [['Producto', 'Unidades', 'Ingresos']],
      body: prods.map(([p, u]) => [cap(p), String(u), ing[p] ? pesos(ing[p]) : '—']),
      foot: [['Total', String(prods.reduce((s, [, u]) => s + u, 0)), pesos(sumar(ing))]],
      columnStyles: { 1: { halign: 'right', cellWidth: 70 }, 2: { halign: 'right', cellWidth: 100 } },
    });
    y = tras();
  }

  // Carnes por porción
  const carnes = carnesPorPresentacion(d.ventas);
  if (carnes.length) {
    seccion('Asados vendidos por presentación (media = 0,5 porción)');
    autoTable(doc, {
      ...estilo, startY: y,
      head: [['Plato', 'Enteras', 'Medias', 'Porciones equiv.', 'Ingresos']],
      body: carnes.map((c) => [cap(c.plato), String(c.enteras), String(c.medias), c.equivalente.toLocaleString('es-CO'), pesos(c.ingresos)]),
      foot: [['Total', String(carnes.reduce((s, c) => s + c.enteras, 0)), String(carnes.reduce((s, c) => s + c.medias, 0)),
        carnes.reduce((s, c) => s + c.equivalente, 0).toLocaleString('es-CO'), pesos(carnes.reduce((s, c) => s + c.ingresos, 0))]],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    y = tras();
  }
  if (d.porciones.length) {
    seccion('Planilla de porciones (estado actual)');
    autoTable(doc, {
      ...estilo, startY: y,
      head: [['Corte / plato', 'Existente', 'Entradas', 'Ventas', 'Total', 'Estado']],
      body: d.porciones.map((p) => [cap(p.item), String(p.existente), String(p.entradas), String(p.ventas), String(p.total), estadoPorcion(p)]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'center' } },
      didParseCell: (h) => {
        if (h.section === 'body' && h.column.index === 5 && h.cell.raw !== 'OK') h.cell.styles.textColor = [192, 38, 45];
      },
    });
    y = tras();
  }

  // Inventario bajo
  const bajos = r.ingredientes_bajo_minimo || [];
  if (bajos.length) {
    seccion('Insumos bajo el mínimo');
    autoTable(doc, {
      ...estilo, startY: y,
      head: [['Insumo', 'Existencia', 'Mínimo', 'Faltante']],
      body: bajos.map((i) => [cap(i.ingrediente), `${i.stock} ${i.unidad}`, `${i.stock_minimo} ${i.unidad}`, `${Math.max(0, i.stock_minimo - i.stock)} ${i.unidad}`]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', textColor: [192, 38, 45] } },
    });
    y = tras();
  }

  // Gastos detalle
  if (d.gastos.length) {
    seccion('Detalle de gastos');
    autoTable(doc, {
      ...estilo, startY: y,
      head: [['Fecha', 'Concepto', 'Categoría', 'Estado', 'Valor']],
      body: d.gastos.map((g) => [g.fecha, g.concepto, cap(String(g.categoria)), cap(g.estado || ''), pesos(g.valor)]),
      foot: [['Total registrado', '', '', d.gastos.some((g) => g.estado === 'pendiente') ? 'Incluye pendientes' : '', pesos(d.gastos.reduce((s, g) => s + (Number(g.valor) || 0), 0))]],
      columnStyles: { 0: { cellWidth: 62 }, 4: { halign: 'right', cellWidth: 80 } },
    });
    y = tras();
  }

  // Ventas detalle
  if (d.ventas.length) {
    seccion(`Detalle de ventas cobradas (${d.ventas.length})`);
    autoTable(doc, {
      ...estilo, startY: y,
      styles: { ...estilo.styles, fontSize: 7.5, cellPadding: 3 },
      head: [['Fecha y hora', 'Modalidad', 'Producto', 'Cant.', 'Medio', 'Total']],
      body: d.ventas.map((v) => [
        fechaHora((v as Venta & { pagado_en?: string }).pagado_en || v.created_at || v.fecha),
        donde(v), cap(v.plato) + (v.tamano_porcion === 'media' ? ' (media)' : ''), String(v.cantidad), cap(String(v.metodo_pago || '')), pesos(v.total),
      ]),
      foot: [['Total', '', '', String(d.ventas.reduce((s, v) => s + (Number(v.cantidad) || 0), 0)), '', pesos(d.ventas.reduce((s, v) => s + (Number(v.total) || 0), 0))]],
      columnStyles: { 0: { cellWidth: 78 }, 3: { halign: 'right', cellWidth: 34 }, 5: { halign: 'right', cellWidth: 72 } },
    });
  }

  // Pie de página
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(225, 221, 212);
    doc.line(M, H - 32, W - M, H - 32);
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`${d.restaurante} · ${textoPeriodo(d.desde, d.hasta)}`, M, H - 18);
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 18, { align: 'right' });
  }

  doc.save(nombreArchivo(d, 'pdf'));
}
