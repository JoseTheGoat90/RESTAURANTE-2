-- 011: acceso al asistente (n8n) para cualquier cuenta con cargo activo.
-- Antes n8n validaba con es_autorizado(), que solo mira la lista antigua usuarios_autorizados,
-- y rechazaba (401) las cuentas creadas con el registro (migración 010).
-- No se amplía es_autorizado() porque también abre por completo tablas antiguas
-- (pedidos, empleados, proveedores, secciones, pedido_items).
-- El nodo "Verificar sesion" del flujo de n8n llama ahora a rpc/tiene_acceso.

CREATE OR REPLACE FUNCTION public.tiene_acceso()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select public.rol_actual() is not null;
$$;
REVOKE ALL ON FUNCTION public.tiene_acceso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiene_acceso() TO authenticated, service_role;
