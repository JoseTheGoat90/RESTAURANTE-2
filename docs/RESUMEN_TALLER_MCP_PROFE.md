# Resumen: taller de MCP del profesor Alexander Toscano

**Video:** "Más allá del chat: cómo el Model Context Protocol (MCP) conecta a los agentes de IA con tus herramientas", Congreso REPETIC, Taller 9. Duración: 1 h 29 min. [YouTube](https://www.youtube.com/watch?v=Kx38arVlyvU)
**Transcripción completa:** `transcripcion_taller_MCP_profe.md`, generada con los subtítulos automáticos de YouTube, así que puede tener errores de palabras.

## Ideas clave (con el minuto donde aparecen)

1. **El problema** (5:38). La IA "encerrada en el chat" gasta muchos tokens leyendo Word, PDF o Excel. Lo que entrega queda en la conversación y hay que copiarlo y pegarlo a mano.
2. **Qué es MCP** (6:51). Un protocolo estándar creado por Anthropic para que **cualquier** IA se comunique con otras herramientas: Word, Excel, Calendar, correo, Blender, bases de datos.
3. **Arquitectura cliente-servidor** (16:18 y 22:03):
   - **Cliente:** la interfaz donde se conversa con la IA (Claude Desktop, Gemini CLI, un IDE como Antigravity o VS Code).
   - **Servidor:** un programa en Python, JavaScript, PHP u otro lenguaje que cumple el estándar MCP y le da a la IA las herramientas.
   - El profe **creó su propio servidor MCP**, pidiéndole a Claude que lo programara, para conectar la IA con Blender.
4. **Dos caminos** (24:23):
   - Para quien programa: crear su propio servidor.
   - Para quien no: usar los conectores que ya existen (Claude › Conectores, ChatGPT › Complementos, Grok).
5. **Persistencia: la idea más importante para nosotros** (31:33 y 32:11). Que la IA guarde los resultados en las herramientas, por ejemplo Google Sheets o Drive, y no en el chat. Así son "persistentes y consistentes en el tiempo". Ejemplo: guardar un reporte cada semana y, 6 meses después, pedirle que analice la tendencia.
6. **Seguridad** (24:54, 35:22 y 41:08):
   - Instalar solo MCP de fuentes confiables, porque un MCP malicioso puede filtrar datos.
   - "Permitir siempre" es peligroso: la IA podría borrar archivos. Mejor "permitir una vez".
   - Usar cuentas personales y no las institucionales, porque esas necesitan aprobación del administrador.
7. **Ahorrar tokens** (48:20 y 50:43):
   - Pedir todo en un solo mensaje bien concreto.
   - Pasar los documentos a Markdown en lugar de PDF con imágenes.
   - MCP también ahorra tokens, porque la IA accede directo a los datos.
8. **Configuración técnica** (1:20:41). En los IDE, los servidores MCP se configuran en un archivo JSON con la propiedad `mcpServers`.
9. **Programar con IA ("vibe coding")** (1:27:22). Siempre con **documentación de soporte**, porque si no la IA pierde el contexto cuando llegan requerimientos nuevos.

## Qué significa para nuestro proyecto

| Lo que dice el profe | Cómo lo aplicamos |
|---|---|
| Crear su propio servidor MCP | **Un servidor MCP propio** con las herramientas del restaurante, que es exactamente lo que él hizo con Blender. Puede ser en n8n o en Node.js |
| La IA debe consultar los datos reales, no inventar | El asesor lee Supabase con herramientas; las cifras salen de la base |
| Persistencia en herramientas, no en el chat | Datos en Supabase, **respaldo diario en Google Sheets** y reportes por Telegram |
| Seguridad: no "permitir siempre" | El asesor es **de solo lectura**; nunca registra ni borra |
| Configurar con JSON `mcpServers` | Conectar **Claude Desktop** a nuestro servidor MCP con ese mismo archivo, para la demo |
| Documentación de soporte | La carpeta `docs/`: propuesta, auditoría, migraciones y este resumen |
