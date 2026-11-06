-- =====================================================================
-- 003 · Cerrar las funciones antiguas al acceso sin login
-- APLICADA en Supabase el 2026-11-05 (hallazgos 1, 2 y 8 de la auditoría).
-- Antes: con la llave pública cualquiera podía registrar ventas/gastos,
-- ajustar inventario, crear ingredientes y leer el reporte de ventas.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.registrar_venta(text,text,integer,text), public.registrar_gasto(text,text,text,numeric),
  public.ajustar_inventario(text,numeric,text), public.crear_ingrediente(text,text,numeric,numeric), public.reporte(text),
  public.es_autorizado()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta(text,text,integer,text), public.registrar_gasto(text,text,text,numeric),
  public.ajustar_inventario(text,numeric,text), public.crear_ingrediente(text,text,numeric,numeric), public.reporte(text),
  public.es_autorizado()
  TO authenticated, service_role;
ALTER FUNCTION public.registrar_gasto(text,text,text,numeric) SET search_path = public;
ALTER FUNCTION public.ajustar_inventario(text,numeric,text) SET search_path = public;
ALTER FUNCTION public.crear_ingrediente(text,text,numeric,numeric) SET search_path = public;
ALTER FUNCTION public.reporte(text) SET search_path = public;
