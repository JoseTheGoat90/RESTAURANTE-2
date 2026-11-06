# Reportes por Telegram (n8n)

## Importante: Telegram no envía a "números"
Un bot de Telegram **no puede escribirle a un número de teléfono**. Solo puede escribirle a un `chat_id`, y ese chat existe únicamente cuando la persona **abre el bot y le envía /start**. El flujo queda así:

1. El dueño o el admin abre el bot y escribe `/start`.
2. El bot le responde con su `chat_id`.
3. Ese `chat_id` se registra en la tabla `destinatarios_reportes`.
4. Desde ese momento, todas las noches a las 11 p. m. recibe el cierre del día.

## Configuración (unos 15 minutos)
1. En Telegram, abre **@BotFather**, envía `/newbot`, ponle nombre y copia el **token**.
2. En Supabase, ejecuta `supabase_telegram.sql` desde el SQL Editor.
3. En n8n, crea dos credenciales:
   - **Telegram API**: el token del bot.
   - **Supabase API**: la URL del proyecto y la **service_role key** (Supabase › Settings › API). Esta llave nunca va en el frontend.
4. En n8n, importa `reportes_telegram.json` (*Import from file*) y asigna las credenciales a cada nodo.
5. Activa el workflow, escríbele `/start` al bot, registra tu `chat_id` y prueba con **Execute workflow**.

> Nota: el disparador de Telegram necesita que n8n sea accesible por HTTPS. Si lo corres en Docker en tu computador, usa un túnel (`n8n start --tunnel`, ngrok o Cloudflare Tunnel).

## Contenido del reporte
Número de ventas y total, gastos, balance, top 5 de platos, gastos por categoría e ingredientes bajo el mínimo (la lista de compras).
