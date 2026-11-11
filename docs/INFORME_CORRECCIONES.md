# Informe de correcciones (5 de noviembre de 2026)

## Seguridad
| # | Qué estaba mal | Qué se hizo | Estado |
|---|---|---|---|
| 1 | Cualquiera podía **registrar ventas, gastos y ajustes de inventario** sin iniciar sesión, usando la llave pública que está en el código del sitio | Se cerraron esas funciones al acceso sin login (migración 003) | ✅ Verificado: responde 401 |
| 2 | Cualquiera podía **leer el total de ventas** sin iniciar sesión | Igual que el anterior | ✅ Verificado |
| 3 | El login **aceptaba cualquier contraseña** para `admin@` y `gerencia@restaurante.com`, y esos correos estaban visibles en el código | Se dejó solo el login real con Supabase, que además revisa la lista de usuarios autorizados | ✅ En la web |
| 4 | Funciones antiguas sin `search_path` fijo (aviso de seguridad de Supabase) | Corregido | ✅ |

## Datos
| # | Qué estaba mal | Qué se hizo | Estado |
|---|---|---|---|
| 5 | El panel mostraba **datos de ejemplo como si fueran reales** ($234.000 de ventas que no existían) | Ahora en modo real todo viene de Supabase; los datos de ejemplo solo aparecen en un **modo demo** con aviso amarillo | ✅ En la web |
| 6 | Si algo fallaba, el panel decía **"registrado con éxito" y guardaba solo en el navegador** | Ahora muestra el error real y no guarda nada localmente | ✅ En la web |
| 7 | La función de venta **siempre fallaba**: buscaba la columna `estado`, que no existía en la tabla de ventas | Se creó la columna | ✅ |
| 8 | Si un producto no tenía receta, se **cobraba a $35.000** | Ahora toma el precio real del producto | ✅ |
| 9 | Se podían **duplicar ventas** con el mismo id | Ahora la venta repetida se ignora | ✅ |

## Asistente (n8n)
| # | Qué estaba mal | Qué se hizo | Estado |
|---|---|---|---|
| 10 | La verificación de sesión **rechazaba a usuarios autorizados**, porque leía mal la respuesta de Supabase | Se corrigió la condición del nodo "Sesion autorizada?" | ✅ |
| 11 | El modelo `gemini-3-flash-preview` **fallaba al usar dos herramientas** a la vez | Se cambió a `gemini-2.5-flash` | ✅ Probado en la web |
| 12 | Un error del asistente **cerraba la sesión del panel** | Ahora el error se muestra en el chat | ✅ En la web |

## Accesos
- Se autorizó a `juliogalvis2004@gmail.com`, que tenía cuenta pero no podía entrar.

## Segunda ronda (10 de noviembre de 2026)
| # | Qué estaba mal | Qué se hizo | Estado |
|---|---|---|---|
| 13 | El asistente **ordenaba mal** qué ingrediente estaba más cerca de su mínimo | La base calcula `veces_el_minimo` y `estado` (vista `inventario_estado`, migración 005) y la herramienta recibe la lista ya ordenada | ✅ Verificado en la base; publicado en n8n |
| 14 | La función `proyeccion` no existía, así que la proyección del mes fallaba | Creada (migración 004); solo la puede usar un administrador | ✅ Probada |
| 15 | La vista `lotes_en_riesgo` se saltaba los permisos | Ahora respeta los permisos de quien consulta | ✅ |
| 16 | 38 ingredientes sin stock ni mínimo aparecían como "agotados" | Se marcan como "sin configurar" | ✅ |

Se revisaron todas las funciones: cada una exige un usuario autorizado o con cargo, así que una cuenta recién registrada no puede ver ni modificar nada.

## Tercera ronda: lo que faltaba de la propuesta (10 de noviembre de 2026)
Jose ya había implementado roles, caja, compras, porciones, domicilios y administración (commit `db9c4f7`, migración 004). Esta ronda completa la fase 3 de la propuesta (migración 007):

| Parte de la propuesta | Qué se hizo |
|---|---|
| **Checklists por cargo** | Pestaña *Checklists*. Cada cargo ve solo los suyos; administración ve todos y el % cumplido. Respuestas Sí/No grandes o número con rango; un "No" o un valor fuera de rango cuenta como alerta. Queda quién lo hizo y a qué hora. No se puede repetir en el día ni hacer el de otro cargo. Se agregó "Limpieza de turno". |
| **Vencimientos** | Panel en *Inventario*: lotes que vencen en 7 días con colores (hoy, ≤ 2 días, más) y **dinero en riesgo**. Botón *Se dañó* registra la merma. Administración fija la vida útil de cada insumo (pollo 2 días, arroz 180…), y desde ahí cada compra queda con su fecha. Las ventas ya gastaban primero el lote que vence antes. |
| **Foto del comprobante Nequi** | Al cobrar por Nequi o transferencia se abre la cámara. La foto se comprime y se guarda en el bucket privado `comprobantes`, unida a la venta. La base **rechaza una referencia ya usada** (captura vieja) y marca si el monto no coincide con la cuenta. |
| **Pantalla de cocina** | Pestaña *Cocina*: tarjetas grandes por mesa, **LISTO gigante**, colores por espera (verde, amarillo a los 10 min, rojo a los 20), sonido y voz al entrar un pedido, teclado USB como botonera (1–9 o Enter) y se refresca sola cada 10 s. Botón ***Se acabó***: el plato deja de poder venderse (la base lo bloquea). |

También: las tablas de checklists, lotes y comprobantes usaban el permiso viejo (`es_autorizado`), así que **un empleado con cargo no podía verlas**; ahora usan los cargos. La merma ahora deja usuario y existencias en el kardex.

**Probado:** en la base con usuarios simulados de cocina y administración (dentro de una transacción que se deshizo), y en el navegador en modo demo. **No probado con una cuenta real** ni en un celular o tablet.

## Cuarta ronda: pedidos como mesero, tablero y planilla (10 de noviembre de 2026)
Migración 008. Todo pasa por las mismas funciones de la base (precios, permisos e inventario).

| Qué | Dónde | Cómo funciona |
|---|---|---|
| **Tomar pedido como mesero** | Pestaña *Pedidos* › Nuevo pedido | Se elige Mesa, Para llevar o Domicilio; se toca la mesa (en amarillo, las ocupadas) y luego los productos. Los asados piden porción media o entera, acompañamiento, ensalada y salsas. Cada producto admite una nota para cocina. *Enviar a cocina* registra **toda la comanda en una sola transacción**: si un producto falla no se guarda nada, y tocar dos veces no la duplica. |
| **Mesas abiertas** | *Pedidos* › Mesas abiertas | Cada comanda con el estado de sus productos (Pendiente, Preparando, LISTO, Entregado), *Agregar* más productos a la misma mesa, *Entregado* y **cobrar la mesa completa** (solo caja; con Nequi pide la foto del comprobante). Se actualiza cada 15 s. |
| **Corrección** | — | Antes, una venta cobrada al momento quedaba "entregada" y **no llegaba a cocina**. Ahora siempre pasa por preparación y el cobro va aparte. Las bebidas se entregan de una vez. |
| **Tablero del dueño** | *Resumen* (solo administración) | Ingresos de hoy contra el mismo día de la semana pasada a la misma hora, por cobrar, ticket promedio, gastos, últimos 14 días (ingresos y gastos), ventas por hora, medio de pago y modalidad, más vendidos, gastos por categoría, mes con **proyección de cierre** y % de gastos cubiertos (punto de equilibrio), pedidos activos, checklists y alertas. Se refresca cada 30 s. |
| **Planilla de porciones** | *Inventario* | Mismo formato de la hoja: productos en columnas y EXISTENTE / ENTRADA / VENTAS / TOTAL en filas. Hoy se ve en vivo; *Cerrar el día* guarda la planilla y el TOTAL pasa a EXISTENTE del día siguiente. Los días anteriores quedan debajo. Se puede imprimir. |
| **Configuración** | *Resumen* › Restaurante | Nombre y número de mesas. Productos, precios, recetas y empleados siguen en Administración. |
| **Chatbot** | n8n | Dos herramientas nuevas: `consultar_tablero` (cómo va el negocio, proyecciones, recomendaciones) y `consultar_pedidos_abiertos`. Usan la sesión del usuario, así que respetan su cargo. |

Además: las pestañas Resumen, Gastos, Inventario, Reportes e historial no tenían margen lateral (el contenido quedaba pegado al borde). Ya lo tienen.

**Probado:** flujo completo en la base con cuentas simuladas de mesera, cocina y caja (dentro de una transacción que se deshizo): pedido → no duplica → todo o nada → la mesera no puede cobrar → cocina marca listo → agregar a la mesa → entregado → caja cobra $46.500 una sola vez → tablero. En el navegador, en modo demo: pedido de la Mesa 4, que llegó a cocina como una sola tarjeta. **Falta probarlo con cuentas reales** y el chatbot con las herramientas nuevas.

## Auditoría del 11 de noviembre de 2026
| # | Problema | Gravedad | Corrección |
|---|---|---|---|
| 1 | **El chatbot dejó de usar n8n e IA**: un cambio anterior (`0511e19`) lo reemplazó por respuestas fijas por palabras clave, algunas falsas ("descuenta desechables automáticamente"). El proyecto quedaba sin n8n en uso. | Alta | El chat vuelve a consultar el asistente de n8n con la sesión del usuario. Las respuestas fijas quedan solo en modo demo, marcadas "Modo demo, sin IA". |
| 2 | Una venta **cobrada al momento** (formulario clásico o chatbot) quedaba "entregada" y **nunca llegaba a cocina**. | Alta | La comida pasa por preparación; solo las bebidas se entregan de una vez (migración 009). |
| 3 | La pantalla de cocina tomaba los pedidos de las **últimas 50 ventas**: en un día movido se perdían pedidos. | Alta | Cocina consulta sus propios pedidos activos (hasta 300, últimas 24 h). |
| 4 | "Entregado" en una mesa marcaba también **platos que seguían en cocina**. | Media | Solo cambia lo que ya está listo (o en camino). |
| 5 | No se podían **agregar productos a pedidos antiguos** (sin comanda). | Media | Se buscan por comanda o por id, y quedan unidos. |
| 6 | Las ventas antiguas cobradas **no tenían fecha de pago** y no salían en el tablero. | Media | Se completó con la fecha de creación. |
| 7 | Cocina mostraba **un aviso por cada producto** y agrupaba por mesa sin tener en cuenta la comanda. | Baja | Un aviso por pedido; las tarjetas se agrupan por comanda. |
| 8 | Lectura anónima concedida en `usuarios_autorizados` y `porciones_cierres`, y funciones internas (`_exigir_rol`) que se podían llamar desde fuera. | Baja | Permisos retirados (no exponían datos gracias a RLS, pero sobraban). |
| 9 | Faltaban índices en búsquedas frecuentes. | Baja | Cinco índices nuevos. |

**Verificado:** todas las correcciones de la base se probaron con cuentas simuladas de caja, mesera y cocina (dentro de una transacción que se deshizo). El webhook de n8n responde y rechaza un token falso (401). El chat en modo demo funciona y la app compila.

**Requiere acción en Supabase (no se puede hacer desde código):** activar *Leaked password protection* en Authentication › Settings.

**Sigue pendiente:** probar el chat y las pantallas con cuentas reales; hoy se permite vender sin inventario (solo avisa), y las bebidas tienen existencias en 0.

## Pendiente
- Cargar las porciones iniciales en la planilla y configurar las recetas (cuántas porciones descuenta un asado medio o entero, qué ejecutivo usa cada almuerzo): sin eso las ventas no descuentan porciones.
- Hoy se puede vender aunque falte inventario (sale un aviso). Si el restaurante prefiere bloquearlo, es un cambio pequeño.
- Probar las pantallas nuevas con cuentas reales de cocina y caja, y en una tablet.
- La voz para *decir* "listo mesa 4" (reconocimiento de voz) quedó para después; hoy la voz solo anuncia.
- Lectura automática del comprobante con Gemini (n8n): hoy el cajero escribe monto y referencia.
- **MCP:** el servidor de solo lectura ya está creado en n8n, pero apagado, porque faltan las credenciales. Hay que crearlas a mano.
- Cargar el stock y el mínimo de los 38 ingredientes "sin configurar".
