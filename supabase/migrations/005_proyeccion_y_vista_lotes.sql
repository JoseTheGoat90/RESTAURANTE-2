-- 004: función proyeccion (la pestaña de reportes la pedía y no existía)
--      y la vista lotes_en_riesgo respeta los permisos de quien consulta.

-- La vista se ejecutaba con permisos del dueño: cualquier cuenta registrada podía leer los lotes.
ALTER VIEW public.lotes_en_riesgo SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.proyeccion()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy   DATE := (now() AT TIME ZONE 'America/Bogota')::date;
  v_ini   DATE := date_trunc('month', v_hoy)::date;
  v_dias_mes INT := EXTRACT(DAY FROM (v_ini + INTERVAL '1 month' - INTERVAL '1 day'))::int;
  v_trans INT := EXTRACT(DAY FROM v_hoy)::int;
  v_ventas NUMERIC; v_gastos NUMERIC; v_anterior NUMERIC; v_dias_hist INT;
BEGIN
  PERFORM public._exigir_rol(ARRAY['admin']);

  SELECT COALESCE(SUM(total),0) INTO v_ventas FROM ventas
   WHERE fecha BETWEEN v_ini AND v_hoy AND COALESCE(estado,'') NOT IN ('anulado','anulada','cancelado','cancelada');

  SELECT COALESCE(SUM(valor),0) INTO v_gastos FROM gastos
   WHERE fecha BETWEEN v_ini AND v_hoy AND NOT COALESCE(anulado,false);

  SELECT COALESCE(SUM(total),0) INTO v_anterior FROM ventas
   WHERE fecha BETWEEN (v_ini - INTERVAL '1 year')::date AND ((v_ini - INTERVAL '1 year') + INTERVAL '1 month' - INTERVAL '1 day')::date
     AND COALESCE(estado,'') NOT IN ('anulado','anulada','cancelado','cancelada');

  SELECT COUNT(DISTINCT fecha) INTO v_dias_hist FROM ventas;

  RETURN jsonb_build_object(
    'mes', to_char(v_ini, 'YYYY-MM'),
    'dias_transcurridos', v_trans,
    'dias_del_mes', v_dias_mes,
    'ventas_mes_actual', v_ventas,
    'gastos_mes_actual', v_gastos,
    'proyeccion_ventas_mes', ROUND(v_ventas / v_trans * v_dias_mes),
    'proyeccion_gastos_mes', ROUND(v_gastos / v_trans * v_dias_mes),
    'ventas_mismo_mes_anio_anterior', v_anterior,
    'dias_con_ventas_en_historial', v_dias_hist,
    -- con menos de 2 semanas de historial la proyección es solo orientativa
    'confiable', v_dias_hist >= 14,
    'baja_rotacion', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('plato', p.nombre, 'unidades_60_dias', COALESCE(u.unidades,0)) ORDER BY COALESCE(u.unidades,0))
      FROM productos p
      LEFT JOIN (SELECT plato, SUM(cantidad) unidades FROM ventas
                  WHERE fecha > v_hoy - 60 AND COALESCE(estado,'') NOT IN ('anulado','anulada','cancelado','cancelada')
                  GROUP BY plato) u ON lower(u.plato) = lower(p.nombre)
      WHERE COALESCE(p.activo, true) AND COALESCE(u.unidades,0) < 3
    ), '[]'::jsonb)
  );
END $function$;

REVOKE ALL ON FUNCTION public.proyeccion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proyeccion() TO authenticated, service_role;
