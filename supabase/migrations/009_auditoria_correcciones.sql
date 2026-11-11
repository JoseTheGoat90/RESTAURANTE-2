-- 009: correcciones de la auditoría del 11 de noviembre de 2026.

-- 1. Una venta cobrada al momento (formulario clásico o chatbot) quedaba "entregada" y nunca
--    llegaba a cocina. Ahora la comida pasa por preparación; solo las bebidas (bar) se entregan de una vez.
DO $$
DECLARE d TEXT := pg_get_functiondef('public.registrar_venta'::regproc);
BEGIN
  IF position($x$v_prep := CASE WHEN v_pagado THEN 'entregado' ELSE v_estado END;$x$ IN d) = 0 THEN
    RAISE EXCEPTION 'registrar_venta cambió: revisar la corrección 009.1 a mano';
  END IF;
  d := replace(d, $x$v_prep := CASE WHEN v_pagado THEN 'entregado' ELSE v_estado END;$x$,
                  $x$v_prep := CASE WHEN v_pagado THEN 'nuevo' ELSE v_estado END;$x$);
  d := replace(d, $x$IF NOT v_p.disponible THEN$x$,
                  $x$IF v_pagado AND v_p.estacion = 'bar' THEN v_prep := 'entregado'; END IF;
IF NOT v_p.disponible THEN$x$);
  EXECUTE d;
END $$;

-- 2. "Entregado" solo aplica a lo que ya está listo (o en camino); "listo" solo a lo que está en cocina.
CREATE OR REPLACE FUNCTION public.estado_comanda(p_comanda_id text, p_estado text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v RECORD; v_r JSONB; v_n INT := 0; v_err TEXT;
BEGIN
  PERFORM _exigir_rol(ARRAY['cocina','parrilla','mesera','domicilios','domiciliario']);
  IF p_estado = 'pagado' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Para cobrar usa cobrar_comanda.'); END IF;
  FOR v IN SELECT * FROM ventas WHERE COALESCE(comanda_id, id_operacion) = p_comanda_id
             AND estado <> 'cancelado'
             AND CASE p_estado
                   WHEN 'entregado' THEN estado IN ('listo', 'en_camino')
                   WHEN 'en_camino' THEN estado = 'listo'
                   WHEN 'listo'     THEN estado IN ('nuevo', 'en_cocina')
                   WHEN 'en_cocina' THEN estado = 'nuevo'
                   WHEN 'cancelado' THEN true
                   ELSE false END
  LOOP
    v_r := actualizar_estado_venta(v.id_operacion, p_estado);
    IF COALESCE((v_r->>'ok')::boolean, false) THEN v_n := v_n + 1; ELSE v_err := v_r->>'mensaje'; END IF;
  END LOOP;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', COALESCE(v_err, 'No había productos en un estado que permita ese cambio.')); END IF;
  RETURN jsonb_build_object('ok', true, 'mensaje', v_n || ' producto(s) → "' || replace(p_estado, '_', ' ') || '".' || COALESCE(' ' || v_err, ''));
END $$;

-- 3. Agregar productos a un pedido registrado antes de las comandas (sin comanda_id):
--    se busca por comanda o por id de venta, y el pedido viejo queda unido a la comanda.
DO $$
DECLARE d TEXT := pg_get_functiondef('public.registrar_comanda(text, jsonb, text, text, text, text, text, text, boolean, text, text)'::regprocedure);
BEGIN
  d := replace(d, $x$FROM ventas WHERE comanda_id = p_comanda_id AND estado <> 'cancelado' LIMIT 1;$x$,
                  $x$FROM ventas WHERE COALESCE(comanda_id, id_operacion) = p_comanda_id AND estado <> 'cancelado' LIMIT 1;
    UPDATE ventas SET comanda_id = p_comanda_id WHERE id_operacion = p_comanda_id AND comanda_id IS NULL;$x$);
  EXECUTE d;
END $$;

-- 4. Ventas antiguas cobradas sin fecha de pago: no salían en el tablero ni en los reportes por fecha de cobro.
UPDATE public.ventas SET pagado_en = created_at WHERE pago_estado = 'pagado' AND pagado_en IS NULL;

-- 5. Permisos sobrantes
REVOKE ALL ON public.usuarios_autorizados FROM anon;
REVOKE ALL ON public.porciones_cierres FROM anon;
REVOKE EXECUTE ON FUNCTION public._exigir_rol(text[]), public._exigir_autorizado() FROM authenticated, anon, PUBLIC;

-- 6. Índices para las búsquedas frecuentes (avisos de rendimiento de Supabase)
CREATE INDEX IF NOT EXISTS comprobantes_pedido_idx ON public.comprobantes_pago (pedido_id);
CREATE INDEX IF NOT EXISTS lotes_ingrediente_idx ON public.lotes (ingrediente);
CREATE INDEX IF NOT EXISTS movimientos_ingrediente_idx ON public.movimientos_inventario (ingrediente);
CREATE INDEX IF NOT EXISTS checklist_items_plantilla_idx ON public.checklist_items (plantilla_id);
CREATE INDEX IF NOT EXISTS ventas_created_idx ON public.ventas (created_at DESC);
