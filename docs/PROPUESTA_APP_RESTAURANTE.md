# Propuesta: sistema de gestión y control para restaurantes

> **Idea central:** que el dueño deje de *hacer* y pase a *controlar*. Cada rol hace su parte con el menor número de toques posible, el sistema conecta lo que pasa entre los roles y avisa solo cuando algo se sale de lo normal.

---

## 1. Lo que hacen los sistemas que de verdad funcionan

Revisé software comercial (Toast, Lightspeed, SambaPOS, Siigo POS Gastrobar, SoftRestaurant, MarginEdge, Restaurant365, Xenia, SafetyCulture) y guías de operación. Lo que tienen en común:

| Lo que hacen | Por qué importa | Lo copiamos |
|---|---|---|
| **El menú se configura por secciones**, con **modificadores** (sin cebolla, término, tamaño) y cada sección se envía a una **estación** (cocina, parrilla, bar) | Sirve igual para un asadero, una cafetería o un bar, porque solo cambia la configuración | ✅ |
| **Pantalla de cocina (KDS)** en lugar de comandas en papel, con tiempo por pedido y un toque (o una tecla, el "bump") para marcarlo listo | El cocinero tiene las manos ocupadas y no puede escribir | ✅ |
| **"86"**: marcar un plato como agotado con un toque, y desaparece del menú del mesero | Evita vender lo que no hay | ✅ (además automático por stock) |
| **Descuento de inventario por receta** (SambaPOS descuenta los gramos de cada receta al vender) | Es lo que pidió el docente | ✅ ya existe |
| **Costo teórico frente a real (variance)**: lo que *debió* gastarse según recetas y ventas, comparado con lo que realmente se gastó según el conteo físico | Es "donde los restaurantes pierden plata sin verla": mermas, porciones grandes, robo | ✅ clave |
| **Checklists digitales por rol y turno**: apertura, cierre, limpieza, temperaturas. Con hora, responsable, ítems obligatorios y alerta si no se hacen | Es lo que le da libertad al dueño: ya no tiene que estar presente para saber si se hizo | ✅ clave |
| **Apertura y cierre de caja con arqueo** | Es el control de dinero más básico | ✅ |
| Facturación electrónica DIAN, nómina, reservas, multi-sede | Son necesarios en producción, pero se salen del alcance académico | ❌ fuera de alcance (se menciona como trabajo futuro) |

---

## 2. Cómo funciona un restaurante: roles y qué necesita cada uno

| Rol | Dispositivo | Qué hace en el sistema | Principio de diseño |
|---|---|---|---|
| **Mesero** | Su celular | Abre la mesa, agrega productos con sus modificadores y nota, envía a cocina y ve cuándo el plato está listo | 3 toques por producto. Los agotados aparecen en gris |
| **Cocinero** | Tablet fija en la pared | Ve los pedidos de su estación con su tiempo y lo marca **LISTO** con un toque grande, o con una tecla de un teclado numérico USB barato que funciona como "bump bar". Puede marcar un plato como agotado (86) | **Manos ocupadas:** botones enormes, colores (verde, amarillo después de 10 min, rojo después de 20), sonido cuando llega un pedido y **cero escritura** |
| **Cajero** | PC o tablet de caja | Abre la caja con la base, cobra (efectivo, Nequi, transferencia o tarjeta) y la cierra con **arqueo ciego**: cuenta el dinero sin ver cuánto "debería" haber | La diferencia de caja la ve el dueño, no el cajero |
| **Encargado / Admin** | PC o celular | Registra las compras (suben el stock y generan el gasto), registra mermas, hace el conteo físico semanal y configura el menú | Todo se elige de listas y nada se escribe dos veces (lo pidió el docente) |
| **Todos** | El dispositivo de su puesto | Completan **su** checklist del turno | Ítems sí/no, un número (temperatura) o una foto |
| **Dueño** | Celular | **Solo controla:** tablero con semáforos, alertas por Telegram y el asistente asesor | Si todo está en verde, no tiene que hacer nada |

**Acceso:** en los dispositivos compartidos (cocina y caja), cada empleado entra con un **PIN de 4 dígitos**. Cada acción queda registrada con quién la hizo. El dueño y el admin entran con correo y contraseña reales (Supabase Auth). Así se corrige el login falso actual.

---

## 3. Módulos de la app

### 3.1 Configuración (para adaptarse a cualquier restaurante)
- **Restaurante:** nombre, logo, moneda, horario, zona horaria.
- **Secciones del menú:** nombre, orden, ícono y **estación de destino** (Cocina, Parrilla, Bar, Postres).
- **Productos:** nombre, sección, precio, foto, disponible o agotado.
- **Variantes y modificadores:** "¼ de pollo / ½ / entero" (cada variante con **su propia receta**) y extras con costo ("+ queso").
- **Ingredientes:** unidad, **costo unitario**, stock mínimo y **stock ideal** (con él se arma la lista de compras).
- **Recetas:** ingredientes por producto o variante. **El sistema calcula el costo del plato, el margen y el food cost %.**
- **Mesas y zonas:** salón, terraza, barra, domicilio, para llevar.
- **Empleados y roles** con su PIN.
- **Plantillas de checklist** por rol y turno.
- **Destinatarios de las alertas por Telegram.**

### 3.2 Operación del día
1. **Apertura:** el checklist de apertura y la apertura de caja con la base.
2. **Pedidos:** mesero → cocina (KDS por estación) → listo → mesero entrega → caja cobra.
3. **Descuento automático de inventario** al enviar a cocina, según la receta, con su movimiento: "−150 g pollo · venta PED‑000123".
4. **86 automático:** si no alcanza el stock para la receta de un plato, el plato se marca agotado solo.
5. **Compras:** proveedor + ingrediente + cantidad + valor. Suben el stock, actualizan el costo promedio y generan el gasto, todo en un solo paso.
6. **Mermas:** ingrediente, cantidad y motivo (vencido, quemado, se cayó, cortesía).
7. **Quejas e incidencias:** mesa o plato, tipo de problema y nota.
8. **Cierre:** el checklist de cierre y el cierre de caja con arqueo ciego.

### 3.3 Control (lo que ve el dueño)
- **Tablero con semáforos:** ventas de hoy frente al mismo día de la semana anterior, caja cuadrada o descuadrada, checklists cumplidos, ingredientes bajo el mínimo, tiempo promedio de cocina y quejas.
- **Costo y margen por plato:** qué deja plata y qué no (análisis de menú: platos estrella, "caballos de trabajo", rompecabezas y perros).
- **Variance semanal:** consumo teórico (ventas × receta) frente al real (conteo inicial + compras − conteo final), con la diferencia en pesos por ingrediente.
- **Gastos fijos y variables**, con el **punto de equilibrio** ("este mes necesitas vender $X; vas en $Y").
- **Proyección del mes** comparada con el mismo mes del año anterior, y los platos de baja rotación para promocionar (lo pidió el docente; ya existe).

### 3.4 Checklists (lo que más le da libertad al dueño)
Plantillas listas para empezar, editables por el restaurante:

| Checklist | Rol | Hora límite | Ejemplos de ítems |
|---|---|---|---|
| Apertura de cocina | Cocina | 10:30 | Gas y extractor encendidos · temperatura de la nevera ≤ 4 °C (número) · mise en place lista · fechas de vencimiento revisadas |
| Apertura de salón | Mesero | 11:00 | Mesas limpias y montadas · baños revisados · menú y QR en su lugar |
| Apertura de caja | Caja | 11:00 | Base contada · datáfono cargado · cambio disponible |
| Limpieza a mitad de turno | Cocina | 16:00 | Superficies desinfectadas · trampa de grasa revisada |
| Cierre de cocina | Cocina | 22:30 | Alimentos rotulados y guardados · freidora apagada · temperatura de la nevera (número) · foto de la cocina limpia |
| Cierre de caja | Caja | 23:00 | Arqueo · reporte impreso · caja fuerte |
| Conteo semanal | Encargado | Lunes 10:00 | Conteo de los ~15 insumos más costosos |

Cada ítem puede ser **sí/no**, **número con rango** (si la nevera marca más de 4 °C, se genera una alerta) o **foto**. Al terminar queda registrado con hora y responsable.

---

## 4. Automatización: qué hace la base de datos, qué hace n8n y qué hace MCP

### 4.1 Supabase (automático e instantáneo, la fuente de verdad)
- Trigger al enviar a cocina: descuenta la receta y registra el movimiento.
- Trigger por stock: marca o desmarca el 86 de los platos afectados.
- Trigger por compra: sube el stock, recalcula el costo promedio y crea el gasto.
- Funciones de cálculo: reporte, proyección, costo por plato, variance, punto de equilibrio y cumplimiento de checklists.

### 4.2 n8n (automatizaciones programadas y mensajes)
| Workflow | Cuándo | Qué hace |
|---|---|---|
| Cierre diario | 11 p. m. | Resumen por Telegram al dueño ✅ (ya creado) |
| Respaldo | 11:30 p. m. | Copia en Google Sheets ✅ (ya creado) |
| **Lista de compras sugerida** | 7 a. m. | (stock ideal − stock actual), ajustado al consumo promedio de ese día de la semana, enviada al encargado |
| **Checklist vencido** | Cada 15 min | Si pasó la hora límite y el checklist no está hecho, avisa al encargado |
| **Alerta de caja** | Al cerrar la caja | Si la diferencia supera el umbral (por ejemplo $10.000), avisa al dueño |
| **Alerta de temperatura** | Al registrarla | Si sale del rango, avisa de inmediato |
| **Recordatorio del conteo** | Lunes | Recuerda el conteo físico y, al terminarlo, envía el variance |
| **Informe mensual con IA** | Día 1 de cada mes | El agente usa las herramientas MCP y redacta un informe: lo que pasó, por qué y qué hacer |

### 4.3 MCP: el asesor (solo lectura, más acciones de bajo riesgo)
Es el servidor MCP en n8n. Lo usan cuatro clientes:
1. **El asistente del panel** (Gemini Flash‑Lite).
2. **Un bot de Telegram para preguntar:** el dueño escribe "¿cómo vamos hoy?" desde cualquier lugar.
3. **El informe mensual automático** (n8n usa las mismas herramientas).
4. **Claude Desktop** del dueño, para la demo de interoperabilidad.

**Herramientas de consulta:** las 7 actuales más `costo_margen_platos`, `variance_inventario`, `cumplimiento_checklists`, `cierres_caja`, `quejas_periodo`, `tiempos_cocina` y `punto_equilibrio`.

**Acciones permitidas** (concretas, reversibles y sin tocar dinero ni stock):
- `enviar_resumen_telegram`: solo a los destinatarios ya registrados.
- `crear_borrador_lista_compras`: queda como **borrador**, y el encargado la aprueba en la app.
- `sugerir_promocion`: guarda una sugerencia que el dueño acepta o descarta.

**Nunca:** registrar ventas o gastos, cambiar el stock, cambiar precios ni borrar nada.

Preguntas que el asesor resuelve bien:
- "¿Qué plato me deja más margen y cuál debería subir de precio?"
- "¿Por qué se perdieron $180.000 de pollo esta semana?" (variance + mermas + movimientos)
- "¿Qué checklists se están saltando y en qué turno?"
- "¿Cuánto me falta para el punto de equilibrio este mes?"
- "Con lo que hay, ¿cuántas hamburguesas alcanzo a hacer el sábado?"

---

## 5. Cómo esto cumple las indicaciones del docente

| Indicación | Cómo se cumple |
|---|---|
| No pasar el papel a la pantalla tal cual; quitar trabajo | Todo se elige de listas, compra en un solo paso, KDS sin escritura, PIN |
| Buscador o lista con opción de agregar | Conceptos, ingredientes, proveedores y productos con autocompletar y botón "+ nuevo" |
| Venta ligada al inventario | Trigger por receta, por variante (¼ o ½ pollo) |
| Movimientos con motivo y unidad | Kardex con motivo, referencia, unidad y responsable |
| Reporte, extracto y análisis predictivo | Reporte diario y mensual, proyección contra el año anterior, costo por producto, baja rotación con sugerencia de promoción |
| Asistente conversacional, no un bot de menús | Agente MCP en lenguaje natural |
| IA de bajo costo por consumo | Gemini Flash‑Lite en n8n |
| Entre más datos, mejor | Tiempos de cocina, checklists, quejas, mermas y arqueos: todo queda registrado y se puede analizar |

---

## 6. Modelo de datos (resumen)

```
restaurante(nombre, logo, moneda, zona_horaria)
secciones(id, nombre, orden, estacion)            estaciones(id, nombre)
productos(id, seccion_id, nombre, precio, foto, disponible, agotado_auto)
variantes(id, producto_id, nombre, precio_extra)  modificadores(id, producto_id, nombre, precio_extra)
ingredientes(id, nombre, unidad, costo_unitario, stock, stock_minimo, stock_ideal)
recetas(producto_id|variante_id, ingrediente_id, cantidad)
mesas(id, nombre, zona)
empleados(id, nombre, rol, pin_hash, activo)
pedidos(id, mesa_id, mesero_id, estado, abierto_en, cerrado_en)
pedido_items(id, pedido_id, producto_id, variante_id, modificadores, nota, estado, enviado_en, listo_en)
pagos(id, pedido_id, metodo, valor, caja_id)
cajas(id, cajero_id, base, abierta_en, cerrada_en, esperado, contado, diferencia)
proveedores(id, nombre, telefono)
compras(id, proveedor_id, fecha, total)           compra_items(compra_id, ingrediente_id, cantidad, valor)
movimientos_inventario(ingrediente_id, delta, motivo, referencia, empleado_id, creado_en)
conteos(id, fecha, empleado_id)                   conteo_items(conteo_id, ingrediente_id, cantidad_real, cantidad_teorica)
gastos(id, fecha, concepto_id, valor, tipo: fijo|variable)   conceptos_gasto(id, nombre, categoria, tipo)
checklist_plantillas(id, nombre, rol, hora_limite, dias)   checklist_items(plantilla_id, texto, tipo, min, max, obligatorio)
checklist_ejecuciones(id, plantilla_id, empleado_id, fecha, completado_en)   checklist_respuestas(ejecucion_id, item_id, valor, foto_url)
quejas(id, pedido_id, tipo, nota, creado_en)
destinatarios_reportes(...)  sugerencias_ia(id, tipo, contenido, estado: pendiente|aceptada|descartada)
```

---

## 7. Plan por fases (realista para el semestre)

| Fase | Entregable | Valor |
|---|---|---|
| **1. Base configurable** | Configuración del restaurante, secciones y estaciones, productos y variantes, ingredientes con costo, recetas con costo y margen, empleados con PIN y login real del admin | Se adapta a cualquier restaurante |
| **2. Flujo operativo** | Mesero (celular) → KDS cocina → caja con apertura y cierre, descuento automático, 86 automático, compras en un solo paso, mermas | Elimina el papel |
| **3. Checklists** | Plantillas, ejecución por rol, alertas de vencimiento y de temperatura | Le da libertad al dueño |
| **4. Control e IA** | Tablero con semáforos, variance, punto de equilibrio, servidor MCP ampliado, informe mensual con IA, lista de compras matutina | Control y asesoría |
| Futuro | Facturación electrónica DIAN, domicilios, multi-sede, reservas | — |

**Recomendación:** las fases 1 y 2 son el corazón y lo que más se ve en la demo. La fase 3 es barata y muy valorada. La fase 4 es la que muestra n8n, IA y MCP, que es lo que evalúa la asignatura.

---

## Fuentes consultadas
- [Restaurant365: costo real vs teórico](https://www.restaurant365.com/blog/closing-the-gap-between-actual-and-theoretical-food-costs) · [MarginEdge: guía de costo real vs teórico](https://www.marginedge.com/blog/a-restaurant-operators-guide-to-actual-vs-theoretical-food-costs-and-usage) · [Altametrics: variance](https://altametrics.com/inventory-management-for-restaurants/theoretical-vs-actual.html) · [Supy: food cost variance](https://supy.io/blog/what-is-food-cost-variance-and-how-to-control-it)
- [Xenia: checklist de cierre](https://www.xenia.team/articles/restaurant-closing-checklist) · [Xenia: checklist de apertura](https://www.xenia.team/daily-ops/restaurant-opening-checklist) · [SafetyCulture: line check digital](https://safetyculture.com/library/hospitality/123-digital-line-check-jgkfujc7t2hdbokf) · [Taqtics: plantillas](https://taqtics.co/checklists/restaurant-checklist-templates/)
- [Restaurant Revolution: KDS (bump, recall, modificadores, 86)](https://restaurant-revolution-docs-dev.pages.dev/staff/kds/overview) · [Epson TrueOrder bump bar](https://files.support.epson.com/pdf/pos/kds/111-56-qum-007_r3.40_trueorder_kds_bump_bar_kb1700-quick_user_manual.pdf) · [Bank of America: rutas KDS](https://merchanthelp.bankofamerica.com/Kitchen-Display-Solution-Setup)
- [Siigo: software para restaurantes](https://www.siigo.com/blog/software-para-restaurantes) · [Siigo: sistemas de comandas](https://www.siigo.com/blog/tecnologia-innovacion/sistema-comandas-top-software/) · [SambaPOS](https://www.comparasoftware.com/sambapos) · [Klikit: POS en Colombia 2026](https://klikit.io/en/learn/best-restaurant-pos-colombia-2026)
- [Guideflow: software de inventario 2026](https://www.guideflow.com/blog/kitchen-inventory-software) · [Rankite: software de cocina comparado](https://rankite.com/blog/best-kitchen-management-software)

> Nota: buena parte de las fuentes son de los propios proveedores. Sirven para conocer las prácticas del sector, pero sus cifras y promesas comerciales no se tomaron como verdad.
