# Análisis crítico y hoja de ruta del sistema

## 1. Lo que pidió el docente (audio del 28/10/2026, reconstruido)

> La transcripción automática está en `transcripcion_docente_raw.txt`. Se hizo con Whisper y el audio tiene ruido, así que algunas frases salieron mal. Este es el resumen corregido:

1. **Normalizar lo que escribe el usuario**, por ejemplo con mayúscula inicial automática.
2. **No pasar el papel a la pantalla tal cual. Hay que quitarle trabajo a la persona.** Para los gastos, en lugar de escribir "compra de pollo" cada vez, que la persona **seleccione o busque** un concepto ya guardado, y que si no existe pueda **agregarlo** a la lista.
3. **Ligar la venta con el inventario mediante recetas.** Si se vende ¼ de pollo, el descuento del inventario tiene que ser automático.
4. **Movimientos de inventario con motivo y unidad.** Por ejemplo: "el azúcar bajó de 300 lb a 250 lb porque se vendieron N postres". Siempre con su unidad (g, kg, lb, unidad…).
5. **Reportes como un extracto mensual** y **análisis predictivo**: proyectar ventas y gastos tomando como referencia el mismo mes del año anterior, calcular el **costo por producto**, estimar el impacto del alza del salario mínimo y detectar **los productos que menos se venden** para promocionarlos. "Entre más datos capturen, mejor".
6. **Asistente conversacional**, no un bot de menús rígidos que hace que el usuario termine peleando con el bot.
7. **Modelo de IA con cobro por consumo.** Recomienda **Gemini Flash‑Lite** vía API dentro de n8n. Él lo usa en su empresa y le cuesta unos **3.000 COP al mes**, frente a los ~20 USD de una suscripción. Comentó que la cuenta institucional de Unicórdoba incluye Gemini/AI Studio gratis. Él usa Claude.

**Buena noticia:** los puntos 2, 3, 4 y 5 ya están parcialmente implementados (`conceptos_gasto`, descuento por receta, `movimientos_inventario`, `proyeccion()` con baja rotación).

## 2. Análisis crítico del programa actual

| # | Problema | Gravedad | Por qué importa |
|---|---|---|---|
| 1 | El login es falso: con `admin@`/`gerencia@` entra cualquier clave de 4 caracteres o más, y el token es la clave pública | Alta | Cualquiera puede registrar o borrar ventas. En la sustentación se va a notar |
| 2 | **No hay roles** (mesero, cocina, caja, admin) | Alta | Un restaurante funciona por roles. El dueño necesita *controlar*, no digitar |
| 3 | **Los ingredientes no tienen costo.** `recetas.precio` es el precio de venta y se repite en cada fila | Alta | No se puede calcular el costo del plato, el margen ni el *food cost*, que es lo que más le importa al dueño |
| 4 | **Comprar no aumenta el inventario.** `registrar_gasto` solo guarda el dinero | Alta | La propuesta dice que la compra actualiza el stock y genera el gasto en un solo paso |
| 5 | No hay **conteo físico** (inventario teórico frente al real) | Media | Así se detectan mermas y robos. Es el "¿cuánto quedó de cada insumo?" |
| 6 | Los gastos no se separan en **fijos y variables** | Media | Sin esa separación no hay punto de equilibrio ni proyección seria |
| 7 | No hay **apertura y cierre de caja** (arqueo) | Media | Es el control diario más básico contra los faltantes |
| 8 | Nombre, productos e imágenes fijos en el código | Media | Cada restaurante debe poder configurarse (lo pediste ahora) |
| 9 | No existe el servidor MCP que promete la propuesta. El chat llama a un webhook | Media | La propuesta lo menciona explícitamente y el docente lo va a evaluar |
| 10 | Quedó `@google/genai` sin usar y restos de la plantilla de AI Studio | Baja | Es limpieza |

**Fortalezas:** la lógica crítica vive en funciones SQL (RPC), así que los cálculos son verificables y la IA no inventa cifras. Además ya existen comandas con estados, reportes y proyección. Es una buena base.

## 3. Cómo se gestiona un restaurante (lo que el sistema debe reflejar)

El dueño gana libertad cuando el sistema convierte la operación en **procesos con responsable y control**:

| Área | Proceso | Rol | Qué controla el dueño |
|---|---|---|---|
| Salón | Tomar pedido y enviarlo a cocina | Mesero | Ventas por mesero, tiempos |
| Cocina | Preparar y marcar "listo". Checklist de limpieza y apertura | Cocinero | Tiempos, mermas, checklist cumplido |
| Caja | Abrir caja con base, cobrar, cerrar y arquear | Cajero | Diferencia entre lo esperado y lo contado |
| Compras | Registrar la compra (sube el stock y genera el gasto) | Admin/Encargado | Precio de compra, proveedor |
| Inventario | Conteo físico semanal de los insumos clave | Encargado | Merma = teórico − real |
| Calidad | Registrar quejas | Cualquiera | Quejas por plato o turno |
| Control | Ver tablero, reportes, alertas | **Dueño** | Ventas, margen, gastos, stock |

Conceptos clave que debes conocer:
- **Costo de receta:** suma de (cantidad × costo unitario) de cada ingrediente.
- **Food cost % = costo del plato / precio de venta.** Lo sano está entre 28 % y 35 %.
- **Gastos fijos** (arriendo, nómina, servicios base) frente a **variables** (insumos, empaques, domicilios).
- **Punto de equilibrio = gastos fijos / (1 − costo variable %).** Responde cuánto hay que vender al mes para no perder.
- **Checklist:** apertura, cierre y limpieza. Son baratos de implementar y muy valorados.

**No hagan:** facturación electrónica, IVA ni nómina completa. Se salen del alcance.

## 4. ¿Dónde va n8n y dónde va MCP?

**Sí es posible dejar el asistente en n8n, y es lo correcto.** Sobre el costo: **n8n Community es gratis si se autoaloja.** Ya tienes Docker instalado:

```bash
docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

Esa versión incluye el **AI Agent**, el **MCP Server Trigger** y el **MCP Client Tool**. Para la demo pública se puede exponer con un túnel (ngrok o Cloudflare Tunnel) o usar la prueba de n8n Cloud solo el día de la presentación.

Arquitectura recomendada:

```
Panel React ──REST/RPC──► Supabase (datos + funciones SQL = fuente de verdad)
     │                          ▲
     └─chat──► n8n Webhook ─► AI Agent (Gemini Flash-Lite)
                                  │ MCP Client Tool
                                  ▼
                     n8n MCP Server Trigger  ◄── Claude Desktop / otro cliente MCP
                      (herramientas: registrar_venta, registrar_gasto,
                       registrar_compra, consultar_inventario,
                       generar_reporte, proyeccion, platos_baja_rotacion)
                                  │
                                  ▼
                           Supabase RPC
```

- **MCP** es el *catálogo de herramientas* del restaurante, expuesto con el MCP Server Trigger de n8n. Cada herramienta llama a una función RPC de Supabase. El agente de n8n lo consume y **cualquier cliente MCP también** (Claude Desktop, por ejemplo). En la demo, el dueño le pregunta a Claude "¿cuánto vendí hoy?" y Claude usa *tus* herramientas. Eso es justo lo que pide la propuesta.
- **n8n** queda como el *motor de automatización*:
  1. El asistente del panel (webhook → agente → herramientas MCP).
  2. El **cierre diario automático** (Schedule a las 11 p. m.): un resumen que llega por Telegram o correo.
  3. **Alerta de stock bajo** con una **lista de compras sugerida**.
  4. **Recordatorio de checklist** y del conteo físico semanal.
  5. El **reporte mensual** con proyección.
- **Supabase** sigue haciendo los cálculos. La IA solo interpreta la pregunta y llama a las herramientas, y nunca inventa números.

## 5. Hoja de ruta priorizada

1. **Configuración del restaurante**: nombre, logo, moneda, productos con categoría y precio, recetas e ingredientes con costo. *(Es lo siguiente.)*
2. **Compras ligadas al inventario**: la función `registrar_compra` sube el stock, guarda el costo unitario y genera el gasto.
3. **Costo y margen por plato**, mostrado en el reporte.
4. **Servidor MCP en n8n** y asistente conectado, con Gemini Flash‑Lite.
5. **Roles reales** con Supabase Auth: mesero, cocina, caja y admin, cada uno con su vista.
6. **Caja**: apertura y cierre con arqueo.
7. **Conteo físico y merma** + **checklists**.
8. **Gastos fijos/variables** + **punto de equilibrio**, y ajustes a la proyección.

Con los puntos 1 a 4 ya cumplen la propuesta y lo que pidió el docente. Del 5 al 8 es lo que hace que se vea como un sistema real.
