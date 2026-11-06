# Auditoría del sistema — 5 de noviembre de 2026

**Alcance:**
- Sitio publicado `restaurante-2-af79.vercel.app`, revisado **sin iniciar sesión**. No se escriben contraseñas en un sitio de producción.
- App corriendo en local (`localhost:3000`) con las credenciales de prueba que entregó el equipo.
- Código fuente: compilación, tipos y dependencias.
- Base de datos Supabase: permisos, RLS y los avisos de seguridad del propio Supabase.

**No se hicieron escrituras de prueba en la base real**, para no meter ventas falsas.

## Resumen

| # | Hallazgo | Gravedad | Comprobado |
|---|---|---|---|
| 1 | **Cualquiera puede escribir en la base sin iniciar sesión.** Las funciones `registrar_venta`, `registrar_gasto`, `ajustar_inventario` y `crear_ingrediente` se pueden ejecutar con la llave pública, que está en el JavaScript del sitio | 🔴 Crítica | Avisos de Supabase y revisión de permisos (`anon` = sí) |
| 2 | **Cualquiera puede leer las ventas sin iniciar sesión** con la función `reporte` | 🔴 Crítica | Probado: sin login devolvió las 2 ventas del 28/10 por $56.000 |
| 3 | **El login no verifica la contraseña** de `admin@` y `gerencia@restaurante.com`: entra cualquier clave de 4 caracteres o más | 🔴 Crítica | Probado en local con la clave inventada "zzzz" ✅ entró |
| 4 | **El panel muestra datos de ejemplo, no los reales.** Como el login falso usa la llave pública, Supabase devuelve listas vacías y la app muestra en silencio los datos guardados en el navegador ($234.000 de ventas que no existen) | 🔴 Crítica | Probado: la base real tiene 2 ventas y 6 ingredientes; el panel muestra otros |
| 5 | **Las operaciones que fallan se "guardan" solo en el navegador** y la app dice "registrado con éxito". Cada computador termina con datos distintos | 🟠 Alta | Revisión de código (`DataContext.tsx`, bloques `catch {}`) |
| 6 | Los correos maestros (`admin@`, `gerencia@`) se ven en el código público del sitio | 🟠 Alta | JavaScript publicado |
| 7 | El webhook del chat de n8n no pide autenticación | 🟠 Alta | Configuración (no se envió ningún mensaje) |
| 8 | Las funciones antiguas no fijan `search_path` | 🟡 Media | Avisos de Supabase |
| 9 | La protección contra contraseñas filtradas de Supabase Auth está apagada | 🟡 Media | Avisos de Supabase |
| 10 | Queda `@google/genai` en las dependencias y una URL de ejemplo (`su-instancia.app.n8n.cloud`) en el código | 🟢 Baja | Código publicado |

## Estado de las correcciones

| # | Estado |
|---|---|
| 1, 2, 8 | ✅ **Corregido el 2026-11-05** (`supabase/migrations/003_cerrar_rpc_anonimas.sql`). Comprobado con la llave pública: `reporte` → 401 *permission denied*; ninguna función con privilegios queda ejecutable por `anon` |
| 1b (nuevo) | ⚠️ Las 5 funciones antiguas todavía no revisan `es_autorizado()`. Un usuario que **se registre por su cuenta** en Supabase Auth podría usarlas. Hay que desactivar el registro abierto (Auth › Sign In / Providers › *Allow new users to sign up*) o agregar el chequeo `es_autorizado() OR auth.role() = 'service_role'` |
| 3–7, 9, 10 | Pendientes |

**Efecto en n8n:** todo workflow que llame a Supabase con la llave pública ahora recibe 401. Hay que usar la credencial **service_role** (también para los workflows de `n8n/`). La función `proyeccion` que usa la herramienta MCP `proyeccion_mes` **no existe** en la base real; hay que crearla o quitar esa herramienta.

## Lo que está bien
- `tsc` sin errores, `npm run build` exitoso y `npm audit` con **0 vulnerabilidades**.
- Las 6 pestañas cargan sin errores en la consola.
- Las tablas tienen RLS. Leerlas directamente sin estar autorizado devuelve vacío, comprobado con la llave pública.
- Las funciones nuevas (cobro, caja, compras, mermas, PIN) **sí exigen un usuario autorizado** y pasaron todas las pruebas.
- El sitio usa HTTPS con HSTS y no expone la llave service_role ni llaves de Gemini.

## Correcciones propuestas

**1 y 2. Cerrar la base de datos.** Una línea de SQL:
```sql
REVOKE EXECUTE ON FUNCTION public.registrar_venta(text,text,integer,text), public.registrar_gasto(text,text,text,numeric),
  public.ajustar_inventario(text,numeric,text), public.crear_ingrediente(text,text,numeric,numeric), public.reporte(text)
  FROM PUBLIC, anon;
```
⚠️ **Antes de aplicarla:** si el workflow actual de n8n (luchofriaz123) llama estas funciones con la llave pública, dejará de funcionar. Hay que cambiarle la credencial a la llave service_role.

**3 a 6. Login real.** Quitar el atajo de los correos maestros y usar solo Supabase Auth con los correos de `usuarios_autorizados`. Si la base no responde, mostrar un error claro y no los datos de ejemplo. Si se quiere un modo demo, que diga **"MODO DEMO"** en grande.

**7.** Agregar un encabezado secreto (*Header Auth*) al webhook de n8n y que el panel lo envíe.

**8 y 9.** `ALTER FUNCTION … SET search_path = public` en las 4 funciones antiguas y activar la protección contra contraseñas filtradas en Supabase › Auth.
