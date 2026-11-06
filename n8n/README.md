# Workflows de n8n del restaurante

| Archivo | Qué hace | Riesgo |
|---|---|---|
| `mcp_server_restaurante.json` | **Servidor MCP** con 7 herramientas **de solo lectura**: inventario, recetas, reporte del día, proyección del mes, ventas por periodo, gastos por periodo y kardex de un ingrediente | Ninguno: solo consulta |
| `agente_asesor.json` | **Agente asesor** (Gemini Flash‑Lite) que conversa desde el panel y usa las herramientas MCP para analizar y aconsejar. No registra nada | Ninguno |
| `reportes_telegram.json` | Cierre diario a las 11 p. m. por Telegram (ver `README_TELEGRAM.md`) | Solo envía mensajes |
| `respaldo_google_sheets.json` | **Respaldo diario a las 11:30 p. m.** en Google Sheets: Inventario, Ventas, Gastos, Movimientos y Recetas | Solo escribe en la hoja |

## Qué puede responder el asesor
- "¿Qué tengo que comprar mañana?" Responde con una lista priorizada según lo que está bajo el mínimo y lo que usan los platos más vendidos.
- "¿Cuántas hamburguesas alcanzo a hacer con lo que hay?" Lo calcula con las recetas y el stock.
- "¿Por qué bajó tanto el pollo esta semana?" Revisa el kardex con los motivos.
- "¿Cómo vamos este mes frente al año pasado?" Usa la proyección.
- "¿Qué plato debería promocionar?" Busca los de baja rotación y propone una promoción.

## Instalación
1. **Credenciales en n8n**
   - *Supabase API*: URL del proyecto + **service_role key** (Supabase › Settings › API). La anon key ya no sirve: la base solo responde a usuarios autorizados. Las herramientas del asesor solo hacen consultas, así que no escriben aunque la llave tenga más permisos. Nunca pongas esta llave en el frontend.
   - ⚠️ La herramienta `proyeccion_mes` llama a la función `proyeccion`, que todavía no existe en la base real.
   - *Google Gemini (PaLM) API*: la llave se crea gratis en aistudio.google.com con la cuenta de Unicórdoba.
   - *Google Sheets OAuth2*: para el respaldo.
2. Importa **`mcp_server_restaurante.json`**, asigna la credencial de Supabase a las 7 herramientas y **actívalo**. Copia la *Production URL* del nodo MCP Server.
3. Importa **`agente_asesor.json`**. En el nodo *Herramientas MCP Restaurante*, pega la URL del paso 2 (reemplaza `https://TU-N8N/...`). Asigna la credencial de Gemini y actívalo.
4. En el panel, la URL del chat debe ser la *Production URL* del webhook `panel-chat` (variable `VITE_CHAT_URL`).
5. **Respaldo:** crea un Google Sheet con 5 pestañas llamadas `Inventario`, `Ventas`, `Gastos`, `Movimientos` y `Recetas`. En la fila 1 de cada pestaña van los encabezados:
   - Inventario: `ingrediente, unidad, stock, stock_minimo`
   - Ventas: `id_operacion, fecha, plato, cantidad, total, estado`
   - Gastos: `id_operacion, fecha, concepto, categoria, valor`
   - Movimientos: `id, ingrediente, delta, motivo, referencia, created_at`
   - Recetas: `id, plato, ingrediente, cantidad, precio`

   Después importa `respaldo_google_sheets.json`, pega la URL de la hoja en los 5 nodos *Guardar…* y actívalo. Se usa *append or update* con el id, así que si el respaldo corre dos veces no duplica filas.

## Extra para la sustentación: conectar Claude Desktop al mismo MCP
En `claude_desktop_config.json`:
```json
{ "mcpServers": { "restaurante": { "command": "npx", "args": ["-y", "mcp-remote", "https://TU-N8N/mcp/restaurante-mcp/sse"] } } }
```
Así, dos IAs distintas (Gemini en el panel y Claude en el escritorio) consultan el mismo restaurante con las mismas herramientas.

> Nota: los JSON se generaron para n8n 1.x reciente y no se han probado en una instancia real. Si al importar algún nodo muestra una advertencia de versión, basta con abrirlo y volver a guardarlo.
