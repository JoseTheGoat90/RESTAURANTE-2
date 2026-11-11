# Informe de implementación: sistema de gestión del restaurante

Fecha: 2026-11-11. Rama: `claude/upbeat-feynman-ojy0ac`.

> **Estado:** la migración `supabase/migrations/004_caja_ventas_inventario.sql` **todavía no está aplicada** en la base de producción. Se probó completa en un PostgreSQL 16 local que replica el esquema (setup + migraciones 002, 003 y 004). Hasta aplicarla, la app publicada sigue con la base anterior y **la nueva versión del frontend no debe desplegarse antes de la migración**.

## 1. Qué se implementó

### Base de datos (migración 004)
| Módulo | Tablas / columnas | Funciones (RPC) |
|---|---|---|
| Usuarios y roles | `perfiles` (correo, nombre, cargo, activo) | `rol_actual`, `mi_perfil`, `guardar_perfil`, `listar_domiciliarios` |
| Auditoría | `auditoria`; `movimientos_inventario` + usuario, existencia anterior/nueva, tipo | registro automático en cada operación |
| Inventario general | `ingredientes` + categoría, proveedor, último movimiento/responsable, activo | `guardar_ingrediente`, `crear_ingrediente`, `ajustar_inventario` (motivo obligatorio, no deja negativo), `reportar_faltante` |
| Porciones (asados y ejecutivos) | `inventario_porciones` (existente, entradas, ventas, **total calculado** = existente + entradas − ventas), `movimientos_porciones` | `registrar_porciones`, `guardar_item_porciones`, `cerrar_periodo_porciones` |
| Catálogo | `productos` + categoría, presentación, unidad, precio mesa/entera, precio llevar, precio media, disponible | `guardar_producto` |
| Recetas / consumos | `consumos_producto` (producto, variante, inventario general **o** porciones, cantidad) | `guardar_consumo` |
| Ventas y pedidos | `ventas` + categoría, precio unitario (histórico), modalidad, presentación, cliente, dirección, teléfono, medio de pago, estado de pago, caja, quién registró/cobró, domiciliario, estación | `registrar_venta`, `actualizar_estado_venta` (preparación, entrega, cobro, cancelación), `asignar_domiciliario`, `consultar_pedidos` |
| Compras | `compras` (id único enlazado al gasto y al movimiento) | `registrar_compra` (inventario general o porciones; un solo gasto por compra) |
| Gastos | `gastos` + medio de pago, responsable, estado, periodo, soporte, caja, compra | `registrar_gasto`, `marcar_gasto_pagado` |
| Caja | `cajas` (ya existía) | `abrir_caja`, `caja_actual`, `cerrar_caja` (arqueo: base + efectivo − salidas en efectivo) |
| Reportes | — | `reporte_periodo(desde, hasta)`, `reporte(fecha)` |

**Reglas que aplica el servidor (no solo la pantalla):**
- El precio lo decide la base según producto, modalidad (mesa / para llevar / domicilio) y presentación (media / entera). Se guarda el precio unitario de cada venta, así que cambiar un precio no altera el historial.
- Un producto sin precio no se puede vender: la base responde "no tiene precio configurado".
- Una venta o compra con el mismo identificador no se registra dos veces. Un pedido cobrado no se cobra de nuevo.
- El ingreso solo cuenta cuando la venta está cobrada (`pago_estado = pagado`), no por cambiar de estado de preparación.
- Cancelar un pedido **antes de prepararlo** devuelve el inventario descontado. Si ya estaba en preparación, el consumo queda como pérdida. Administración puede anular una venta cobrada y decidir si devuelve el inventario (por ejemplo, si se registró por error).
- Cada consumo va a **un** inventario (general o porciones), así no se descuenta dos veces la misma mercancía.
- Las tablas ya no se pueden modificar directamente: toda escritura pasa por las funciones.

### Permisos por cargo (validados en la base)
| Cargo | Puede | No puede |
|---|---|---|
| Administrador / cajero | Todo: ventas, cobro, caja, gastos, compras, inventarios, precios, reportes, empleados | — |
| Cocina | Ver pedidos de cocina, ver todo el inventario y las porciones, marcar "en preparación" / "listo", reportar faltantes | Precios, gastos, caja, reportes, cobrar |
| Parrilla | Igual que cocina, con los pedidos de parrilla (asados) | Igual que cocina |
| Mesera | Tomar pedidos (quedan pendientes de cobro), ver precios e inventario, marcar entregado, cancelar si no se ha empezado a preparar | Cobrar, gastos, reportes |
| Encargado de domicilios | Tomar domicilios con cliente, dirección y teléfono, asignar domiciliario, ver el estado | Cobrar, gastos, reportes |
| Domiciliario | Ver **solo sus** domicilios y marcar "en camino" / "entregado" | Inventario, gastos, reportes, otros pedidos |

Un correo que ya estaba autorizado y aún no tiene perfil se trata como administrador, para que los administradores actuales no pierdan el acceso.

### Frontend (sin cambiar el diseño)
- **Inicio de sesión:** consulta el cargo del usuario y rechaza cuentas inactivas o sin acceso.
- **Navegación:** cada cargo ve solo sus pestañas (la base lo vuelve a validar).
- **Vender:**
  - El menú sale de la tabla `productos`.
  - Se agregaron las variantes corriente especial con mondongo, con ajiaco y con mote de queso, que reemplazan a las sopas sueltas.
  - Se agregó el selector de medio de pago y el nombre del cliente en domicilios.
  - La vista previa de descuentos muestra los consumos configurados en vez de cantidades fijas.
  - Las comandas muestran botones según el cargo: Preparar, Listo, Despachar, Entregado, Cobrar y Cancelar. También se puede asignar el domiciliario.
- **Inventario:**
  - Nueva tabla de asados y ejecutivos por porciones (Existente, Entrada, Ventas, Total) con sus movimientos.
  - Al sumar se puede indicar el valor y el proveedor: eso registra una compra con su gasto.
  - Cocina y parrilla reportan faltantes sin mover existencias.
  - El kardex muestra quién hizo cada movimiento y la existencia antes y después.
  - Se agregaron las unidades l, ml, bolsa y botella y las categorías bebidas y aseo.
- **Resumen:** tarjeta de caja para abrirla con la base y cerrarla con el arqueo.
- **Gastos:** "marcar pagado" ahora se guarda en la base.
- **Reportes:**
  - Rango de fechas (desde y hasta), exportación a Excel (CSV) y PDF (imprimir).
  - El balance se llama "ingresos − gastos" y aclara que no equivale a utilidad neta contable.
  - El resumen del día solo cuenta ventas cobradas y gastos pagados.

## 2. Pruebas ejecutadas (base local, script en la sesión)
| # | Prueba | Resultado |
|---|---|---|
| 1 | Compra de 25 kg de arroz por $87.500, enviada dos veces | Existencia 25, costo $3.500/kg, **1 solo gasto** (categoría compras). La segunda vez: "no se duplicó" ✅ |
| 2 | 10 existentes + 8 entrada − 5 ventas de carne de res | Total = **13** ✅ |
| 3 | Asado de res porción media | $15.000, una porción descontada ✅ |
| 4 | Corriente para llevar / en mesa | $14.000 / $13.000 ✅ |
| 5 | Corriente especial con mondongo para llevar | $16.000, se identifica la variante ✅ |
| 6 | Coca-Cola personal (Nequi) | $3.500, existencia 24 → 23 ✅ |
| 7 | Energía, agua, gas, internet (servicios) y vigilancia (seguridad) | Servicios $640.000, seguridad $200.000 ✅ |
| 8 | Cocinera | Ve 52 insumos y 11 productos de porciones, reporta faltante. **No** puede cambiar precios, comprar ni ver reportes; ve 0 gastos y 0 cajas ✅ |
| 9 | Domicilio: encargado registra → asigna → domiciliario | El domiciliario ve 1 pedido (el suyo) y 0 gastos, marca en camino y entregado, no puede tocar otros pedidos ni cobrar. Caja cobra una vez; el segundo cobro se rechaza ✅ |
| 10 | Reporte del día | Ingresos $173.500 y gastos $927.500, iguales a la suma manual. Desglose por categoría, modalidad y medio de pago ✅ |
| 11 | Persistencia | Datos leídos desde una conexión nueva: 13 ventas, 6 gastos, 1 compra, 37 registros de auditoría ✅ (falta probar cerrar sesión e ingresar con la base real) |
| 12 | Cancelaciones | Pendiente → se devuelve la porción (12 → 13). En preparación → no se devuelve (pérdida). Venta cobrada anulada por error → se devuelve la bebida y el pago queda "anulado" ✅ |
| — | Seguridad | Un usuario no autorizado no ve ni registra nada. `UPDATE` directo a `ventas` → permiso denegado ✅ |

También se comprobó que la app compila (`tsc` y `vite build`) y que en modo demo cargan Resumen, Vender e Inventario (corriente para llevar = $14.000).

## 3. Lo que falta o necesita información del restaurante
1. **Aplicar la migración 004** en Supabase (hacer antes una copia de seguridad) y luego desplegar el frontend.
2. **Cuentas de los 13 empleados:** crear cada cuenta en Supabase (Authentication → Add user) y asignar su cargo con `guardar_perfil(correo, nombre, cargo)`. Pendiente de verificar con la base real: que los empleados nuevos también queden en `usuarios_autorizados` si las políticas antiguas lo exigen.
3. **Consumos / recetas:** no se inventaron cantidades. Para que las ventas descuenten inventario, administración debe configurar con `guardar_consumo`:
   - cuántas porciones descuenta un asado medio y uno entero;
   - qué ejecutivo usa cada almuerzo;
   - las cantidades de arroz, ensalada, etc.;
   - los desechables por modalidad.

   Solo las bebidas quedaron configuradas (1 unidad por venta).
4. **Unidades y mínimos:** los insumos iniciales quedaron con unidad "por definir" y mínimo 0. Se completan con `guardar_ingrediente`.
5. **Pantallas de administración** para productos, precios, recetas y empleados: las funciones existen en la base, pero todavía no tienen pantalla.
6. Sin pantalla todavía: historial de auditoría, lista de faltantes reportados, compras de porciones, gastos recurrentes y soportes (foto o archivo).
7. El módulo de proyección de Reportes conserva supuestos fijos de la versión anterior (ventas mínimas de $300.000 diarias). Conviene revisarlo.
8. **n8n / MCP:** las herramientas deben llamar a estas mismas funciones con la llave de servicio. Las RPC respetan los permisos, pero la llave de servicio actúa como administrador, así que debe guardarse solo en n8n.
