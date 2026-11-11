# Inventario de funciones de la app (estado al 2026-11-11)

Objetivo revisado: **registrar productos existentes** (carnes, verduras, desechables…) y **registrar ventas** (almuerzo corriente, seco, asados…) para que la app funcione como **caja**.

Tecnología: React 19 + Vite + Tailwind (frontend), Supabase/PostgreSQL (datos y funciones RPC), n8n (asistente y reportes por Telegram).

Leyenda: ✅ funciona y guarda en la base · ⚠️ existe pero con fallas · 🎭 solo pantalla/modo demo (no guarda) · ❌ no existe en la app

## 1. Pantallas (pestañas)

| Pestaña | Archivo | Qué hace hoy |
|---|---|---|
| Resumen | `src/tabs/ResumenTab.tsx` | Tarjetas del día: ventas, gastos, balance, alertas de stock |
| Vender | `src/tabs/VenderTab.tsx` | Menú, tipo de pedido (mesa/domicilio/llevar), porción media/entera, acompañamiento, comandas |
| Gastos | `src/tabs/GastosTab.tsx` | Registro de gastos por concepto/categoría, pendientes/pagados |
| Inventario | `src/tabs/InventarioTab.tsx` | Lista de insumos, crear insumo, entradas/ajustes, reporte de daños/faltantes |
| Reportes | `src/tabs/ReporteTab.tsx` | Reporte diario y proyección del mes |
| Asistente | `src/tabs/AsistenteTab.tsx` | Chat con agente n8n |

## 2. Funciones del frontend (`src/context/DataContext.tsx` + `src/services/api.ts`)

| Función | Llama a | Estado |
|---|---|---|
| `fetchIngredientes`, `fetchRecetas`, `fetchVentas`, `fetchGastos`, `fetchConceptosGasto`, `fetchMovimientosInventario` | tablas Supabase | ✅ lectura |
| `executeCreateIngredient` (crear producto/insumo) | RPC `crear_ingrediente` | ✅ (pero el `tipo_insumo` —carnes, verduras…— **no se envía**, se pierde) |
| `executeAdjustStock` (entrada / ajuste / merma) | RPC `ajustar_inventario` | ✅ |
| `executeSale` (vender) | RPC `registrar_venta` | ⚠️ **probablemente falla en modo real**: envía `tamano_porcion`, `estado`, `tipo_pedido`, `mesa`, `p_acompanamiento`, `p_precio_unitario`… pero la función en la base (migración 002) solo acepta `p_id, p_plato, p_cantidad, p_estado`. PostgREST rechaza parámetros desconocidos. |
| `executeExpense` (gasto) | RPC `registrar_gasto` | ⚠️ mismo problema: envía `periodo`, `metodo_pago`, `responsable`, `estado` que la función no acepta |
| `updateOrderStatus` (en cocina, en camino, entregado) | — | 🎭 solo cambia la pantalla, se pierde al recargar |
| `updateExpenseStatus` (marcar gasto pagado) | — | 🎭 solo pantalla |
| `addConceptoGasto` | — | 🎭 solo pantalla |
| `generar_reporte` / `rpcReporte` | RPC `reporte` | ✅ |
| `rpcProyeccion` | RPC `proyeccion` | ✅ |
| `consultar_inventario` | cálculo local | ✅ (bajo mínimo) |
| `sendChatMessage` | webhook n8n | ✅ si n8n está activo |
| Descuento de acompañamiento, ensalada, salsas, empaques, cubiertos y bolsa por venta | — | 🎭 **solo en modo demo**; la función real solo descuenta lo que esté en `recetas` |

## 3. Funciones en la base de datos (Supabase)

| Función / tabla | Definida en | ¿La usa la app? |
|---|---|---|
| `registrar_venta(p_id,p_plato,p_cantidad,p_estado)` — precio desde `productos`/`recetas`, descuenta receta y lotes (FEFO) | migración 002 | ⚠️ sí, con parámetros incompatibles |
| `registrar_venta(p_plato,p_cantidad,p_tipo_pedido,…,p_tamano_porcion)` — precios del documento (corriente 13.000/14.000, seco, asado media/entera) | `supabase_actualizacion_caracterizacion.sql` | ❓ versión alternativa; hay dos firmas que se pisan/conviven |
| `registrar_gasto`, `ajustar_inventario`, `crear_ingrediente`, `reporte`, `proyeccion` | `supabase_setup.sql` | ✅ |
| `registrar_compra` (compra + lote + vencimiento + proveedor) | migración 002 | ❌ no conectada a la app |
| `registrar_merma` | migración 002 | ❌ no conectada (la app usa ajuste negativo) |
| `cobrar_pedido` (cobra un pedido a una caja) | migración 002 | ❌ no conectada |
| `cerrar_caja` (arqueo: contado vs. esperado) | migración 002 | ❌ no conectada |
| `guardar_empleado`, `verificar_pin` | migración 002 | ❌ no conectadas |
| Tablas `productos`, `secciones`, `pedidos`, `pedido_items`, `cajas`, `empleados`, `proveedores`, `lotes`, `comprobantes_pago`, `checklist_*` | migración 002 | ❌ la app no las lee |

## 4. Brechas frente al objetivo (productos + ventas + caja)

### Registrar productos existentes
- Ya se pueden crear insumos y ajustar stock. Falta: **guardar la categoría** (`tipo_insumo`: carnes, verduras, granos, desechables…), editar/eliminar insumos, y conectar **compras** (`registrar_compra`) para que la entrada de mercancía quede con proveedor, valor y vencimiento.
- Inventario de **porciones de asados/ejecutivos** (ej. “porciones de res listas”) no existe como tal: hoy la carne se descuenta por receta.

### Registrar ventas (almuerzo corriente, seco, asados…)
- La pantalla está completa, pero hay que **alinear la llamada con la función de la base** (una sola firma de `registrar_venta` que reciba tipo de pedido, porción, acompañamiento y método de pago y calcule el precio en el servidor).
- Que los **descuentos de acompañamiento, ensalada, salsas y empaques** ocurran en la base, no solo en demo.
- Guardar el **estado de la comanda** en la base (`updateOrderStatus`).

### Funcionar como caja
- Falta toda la parte de caja en la interfaz: **abrir caja** (base inicial), registrar **método de pago** por venta (efectivo / Nequi / tarjeta / crédito), **cerrar caja** con arqueo (esperado vs. contado, diferencia) e historial de cierres por cajero. Las funciones `cobrar_pedido` y `cerrar_caja` ya existen en la base y pueden reutilizarse.
- Registrar **qué usuario** hizo cada venta/gasto (hoy no se guarda).

### Usuarios y roles (13 empleados)
- Hoy hay un solo tipo de acceso (login Supabase + `es_autorizado()`). No hay roles admin/cocina/parrilla/mesera/domicilios/domiciliario ni permisos por pestaña.

## 5. Orden recomendado
1. Corregir `registrar_venta` y `registrar_gasto` (firma única + frontend alineado). **Bloqueante**: sin esto la caja no registra en modo real.
2. Caja: abrir / cobrar con método de pago / cerrar con arqueo (reusar `cajas`, `cobrar_pedido`, `cerrar_caja`).
3. Productos: guardar categoría, compras con proveedor, editar insumos.
4. Estado de comandas persistente (cocina, parrilla, domicilios).
5. Roles y permisos por empleado.
