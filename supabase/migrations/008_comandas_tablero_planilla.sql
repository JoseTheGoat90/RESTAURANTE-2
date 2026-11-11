-- 008: comandas (varios productos por pedido), cobro por mesa, tablero del dueño
--      e historial diario de la planilla de porciones.
-- Reutiliza registrar_venta / actualizar_estado_venta de la 004: mismas reglas de precio,
-- permisos e inventario. Una comanda es un grupo de ventas con el mismo comanda_id.

ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS comanda_id text;
CREATE INDEX IF NOT EXISTS ventas_comanda_idx ON public.ventas (comanda_id);
ALTER TABLE public.comprobantes_pago ADD COLUMN IF NOT EXISTS comanda_id text;

-- 1. Registrar una comanda completa en UNA transacción: si un producto falla, no se registra nada.
--    p_items: [{"plato","cantidad","tamano_porcion","acompanamiento","con_ensalada","con_salsas","notas"}]
--    p_lote: identificador único de este envío (evita duplicados si se pulsa dos veces).
--    p_comanda_id: para AGREGAR productos a una comanda ya abierta (misma mesa).
--    Siempre pasa por preparación; las bebidas (estación bar) quedan entregadas de una vez.
CREATE OR REPLACE FUNCTION public.registrar_comanda(
  p_lote text, p_items jsonb, p_tipo_pedido text DEFAULT 'mesa', p_mesa text DEFAULT NULL,
  p_cliente text DEFAULT NULL, p_direccion text DEFAULT NULL, p_telefono text DEFAULT NULL,
  p_notas text DEFAULT NULL, p_cobrar boolean DEFAULT false, p_metodo_pago text DEFAULT 'efectivo',
  p_comanda_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_comanda TEXT := COALESCE(NULLIF(p_comanda_id, ''), p_lote);
  v_it JSONB; v_i INT := 0; v_id TEXT; v_r JSONB; v_total NUMERIC := 0; v_avisos TEXT[] := '{}';
  v_v RECORD;
  e_tipo TEXT; e_mesa TEXT; e_cliente TEXT; e_dir TEXT; e_tel TEXT;
BEGIN
  PERFORM _exigir_rol(ARRAY['mesera','domicilios']);
  IF COALESCE(p_lote, '') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta el identificador del pedido.'); END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'El pedido no tiene productos.');
  END IF;
  IF EXISTS (SELECT 1 FROM ventas WHERE id_operacion = p_lote || '-1') THEN
    RETURN jsonb_build_object('ok', true, 'duplicada', true, 'comanda_id', v_comanda, 'mensaje', 'Este pedido ya estaba registrado (no se duplicó).');
  END IF;
  IF p_comanda_id IS NOT NULL THEN
    SELECT tipo_pedido, mesa, cliente, direccion_domicilio, telefono_contacto INTO e_tipo, e_mesa, e_cliente, e_dir, e_tel
      FROM ventas WHERE comanda_id = p_comanda_id AND estado <> 'cancelado' LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La comanda a la que quieres agregar ya no está abierta.'); END IF;
  END IF;
  IF p_cobrar AND rol_actual() <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Solo caja puede cobrar. Envía el pedido y caja lo cobra.');
  END IF;
  IF COALESCE(p_tipo_pedido, 'mesa') = 'domicilio' AND p_comanda_id IS NULL AND COALESCE(TRIM(p_direccion), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta la dirección del domicilio.');
  END IF;

  BEGIN
    FOR v_it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_i := v_i + 1;
      v_id := p_lote || '-' || v_i;
      v_r := registrar_venta(
        p_id => v_id,
        p_plato => v_it->>'plato',
        p_cantidad => COALESCE((v_it->>'cantidad')::int, 1),
        p_estado => 'nuevo',
        p_tipo_pedido => COALESCE(e_tipo, NULLIF(p_tipo_pedido, ''), 'mesa'),
        p_mesa => COALESCE(e_mesa, p_mesa),
        p_tamano_porcion => NULLIF(v_it->>'tamano_porcion', ''),
        p_acompanamiento => NULLIF(v_it->>'acompanamiento', ''),
        p_con_ensalada => COALESCE((v_it->>'con_ensalada')::boolean, true),
        p_con_salsas => COALESCE((v_it->>'con_salsas')::boolean, true),
        p_direccion => COALESCE(e_dir, p_direccion),
        p_telefono => COALESCE(e_tel, p_telefono),
        p_metodo_pago => p_metodo_pago,
        p_cliente => COALESCE(e_cliente, p_cliente),
        p_notas => NULLIF(CONCAT_WS(' · ', NULLIF(v_it->>'notas', ''), NULLIF(p_notas, '')), ''));
      IF NOT COALESCE((v_r->>'ok')::boolean, false) THEN
        RAISE EXCEPTION '%', COALESCE(v_r->>'mensaje', 'No se pudo registrar ' || (v_it->>'plato'));
      END IF;
      IF v_r ? 'alertas' AND jsonb_typeof(v_r->'alertas') = 'array' THEN
        SELECT v_avisos || COALESCE(array_agg(x), '{}') INTO v_avisos FROM jsonb_array_elements_text(v_r->'alertas') x;
      END IF;
      UPDATE ventas SET comanda_id = v_comanda WHERE id_operacion = v_id RETURNING * INTO v_v;
      v_total := v_total + v_v.total;
      IF v_v.estacion = 'bar' THEN
        UPDATE ventas SET estado = 'entregado', actualizado_en = now() WHERE id_operacion = v_id;
      END IF;
      IF p_cobrar THEN
        v_r := actualizar_estado_venta(v_id, 'pagado', p_metodo_pago);
        IF NOT COALESCE((v_r->>'ok')::boolean, false) THEN RAISE EXCEPTION '%', v_r->>'mensaje'; END IF;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'No se registró el pedido: ' || SQLERRM);
  END;

  PERFORM _auditar('registrar', 'comanda', v_comanda, jsonb_build_object('lote', p_lote, 'productos', v_i, 'total', v_total, 'cobrada', p_cobrar));
  RETURN jsonb_build_object('ok', true, 'comanda_id', v_comanda, 'total', v_total, 'avisos', to_jsonb(v_avisos),
    'mensaje', CASE WHEN p_comanda_id IS NOT NULL THEN 'Se agregaron ' ELSE 'Pedido enviado: ' END || v_i || ' producto(s) por $'
               || to_char(v_total, 'FM999G999G999') || CASE WHEN p_cobrar THEN ' (cobrado).' ELSE '. Pendiente de cobro.' END);
END $$;

-- 2. Comandas abiertas: sin cobrar o sin entregar (últimas 24 h). Para meseras, domicilios y caja.
CREATE OR REPLACE FUNCTION public.comandas_abiertas()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol TEXT := rol_actual();
BEGIN
  PERFORM _exigir_rol(ARRAY['mesera','domicilios']);
  RETURN COALESCE((
    SELECT jsonb_agg(c ORDER BY c->>'desde')
    FROM (
      SELECT jsonb_build_object(
        'comanda_id', COALESCE(v.comanda_id, v.id_operacion),
        'tipo_pedido', MIN(v.tipo_pedido), 'mesa', MIN(v.mesa), 'cliente', MIN(v.cliente),
        'direccion', MIN(v.direccion_domicilio), 'telefono', MIN(v.telefono_contacto), 'domiciliario', MIN(v.domiciliario),
        'desde', MIN(v.created_at), 'registrado_por', MIN(v.registrado_por),
        'total', SUM(v.total) FILTER (WHERE v.estado <> 'cancelado'),
        'por_cobrar', COALESCE(SUM(v.total) FILTER (WHERE v.estado <> 'cancelado' AND v.pago_estado <> 'pagado'), 0),
        'items', jsonb_agg(jsonb_build_object('id', v.id_operacion, 'plato', v.plato, 'cantidad', v.cantidad, 'total', v.total,
                   'estado', v.estado, 'pago_estado', v.pago_estado, 'tamano_porcion', v.tamano_porcion, 'notas', v.notas,
                   'estacion', v.estacion) ORDER BY v.id_operacion)
      ) AS c
      FROM ventas v
      WHERE v.created_at > now() - INTERVAL '24 hours'
        AND (v_rol <> 'domicilios' OR v.tipo_pedido = 'domicilio')
      GROUP BY COALESCE(v.comanda_id, v.id_operacion)
      HAVING bool_or(v.estado <> 'cancelado' AND (v.pago_estado <> 'pagado' OR v.estado NOT IN ('entregado')))
    ) t
  ), '[]'::jsonb);
END $$;

-- 3. Cobrar toda la comanda (mesa) de una vez: solo caja.
CREATE OR REPLACE FUNCTION public.cobrar_comanda(p_comanda_id text, p_metodo_pago text DEFAULT 'efectivo')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v RECORD; v_r JSONB; v_total NUMERIC := 0; v_n INT := 0;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  BEGIN
    FOR v IN SELECT * FROM ventas WHERE COALESCE(comanda_id, id_operacion) = p_comanda_id
               AND estado <> 'cancelado' AND pago_estado <> 'pagado' ORDER BY id_operacion LOOP
      v_r := actualizar_estado_venta(v.id_operacion, 'pagado', p_metodo_pago);
      IF NOT COALESCE((v_r->>'ok')::boolean, false) THEN RAISE EXCEPTION '%', v_r->>'mensaje'; END IF;
      v_total := v_total + v.total; v_n := v_n + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'No se cobró: ' || SQLERRM);
  END;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Esta comanda no tiene nada pendiente de cobro.'); END IF;
  RETURN jsonb_build_object('ok', true, 'total', v_total,
    'mensaje', 'Cobrado $' || to_char(v_total, 'FM999G999G999') || ' (' || v_n || ' producto(s), ' || p_metodo_pago || ').'
               || CASE WHEN _caja_abierta() IS NULL THEN ' Ojo: no hay caja abierta.' ELSE '' END);
END $$;

-- 4. Cambiar el estado de toda la comanda (p. ej. la mesera marca "entregado").
CREATE OR REPLACE FUNCTION public.estado_comanda(p_comanda_id text, p_estado text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v RECORD; v_r JSONB; v_n INT := 0; v_err TEXT;
BEGIN
  PERFORM _exigir_rol(ARRAY['cocina','parrilla','mesera','domicilios','domiciliario']);
  IF p_estado = 'pagado' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Para cobrar usa cobrar_comanda.'); END IF;
  FOR v IN SELECT * FROM ventas WHERE COALESCE(comanda_id, id_operacion) = p_comanda_id
             AND estado NOT IN ('cancelado', p_estado) AND NOT (p_estado <> 'cancelado' AND estado = 'entregado') LOOP
    v_r := actualizar_estado_venta(v.id_operacion, p_estado);
    IF COALESCE((v_r->>'ok')::boolean, false) THEN v_n := v_n + 1; ELSE v_err := v_r->>'mensaje'; END IF;
  END LOOP;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', COALESCE(v_err, 'No había productos para actualizar.')); END IF;
  RETURN jsonb_build_object('ok', true, 'mensaje', v_n || ' producto(s) → "' || replace(p_estado, '_', ' ') || '".' || COALESCE(' ' || v_err, ''));
END $$;

-- 5. El comprobante también puede ir a una comanda completa (se compara con su total).
CREATE OR REPLACE FUNCTION public.adjuntar_comprobante(p_venta_id text, p_foto_path text, p_metodo text DEFAULT 'nequi',
  p_monto numeric DEFAULT NULL, p_referencia text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_venta TEXT; v_comanda TEXT; v_total NUMERIC; v_otro TEXT; v_coincide BOOLEAN;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  SELECT id_operacion, comanda_id, total INTO v_venta, v_comanda, v_total FROM ventas WHERE id_operacion = p_venta_id;
  IF v_venta IS NULL THEN
    SELECT MIN(id_operacion), p_venta_id, SUM(total) FILTER (WHERE estado <> 'cancelado') INTO v_venta, v_comanda, v_total
      FROM ventas WHERE comanda_id = p_venta_id;
  ELSE
    v_comanda := NULL; -- comprobante de una sola venta
  END IF;
  IF v_venta IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Venta o comanda no encontrada.'); END IF;
  IF COALESCE(TRIM(p_foto_path), '') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta la foto del comprobante.'); END IF;
  IF COALESCE(TRIM(p_referencia), '') <> '' THEN
    SELECT COALESCE(comanda_id, pedido_id) INTO v_otro FROM comprobantes_pago WHERE LOWER(TRIM(referencia)) = LOWER(TRIM(p_referencia));
    IF v_otro IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'mensaje', 'Esa referencia ya se usó en el pedido ' || v_otro || '. Puede ser una captura vieja.');
    END IF;
  END IF;
  v_coincide := CASE WHEN p_monto IS NULL THEN NULL ELSE ABS(p_monto - v_total) < 1 END;
  INSERT INTO comprobantes_pago (pedido_id, comanda_id, metodo, foto_path, monto, referencia, coincide, registrado_por)
  VALUES (v_venta, v_comanda, COALESCE(NULLIF(p_metodo, ''), 'nequi'), p_foto_path, p_monto, NULLIF(TRIM(p_referencia), ''), v_coincide, _usuario_actual());
  PERFORM _auditar('registrar', 'comprobante', p_venta_id, jsonb_build_object('monto', p_monto, 'referencia', p_referencia, 'coincide', v_coincide));
  RETURN jsonb_build_object('ok', true, 'coincide', v_coincide,
    'mensaje', CASE WHEN v_coincide = false THEN 'Comprobante guardado, pero el monto ($' || to_char(p_monto, 'FM999G999G999')
                    || ') no coincide con la cuenta ($' || to_char(v_total, 'FM999G999G999') || ').'
               ELSE 'Comprobante guardado.' END);
END $$;

-- 6. Planilla de porciones: cada cierre guarda la foto del día (EXISTENTE / ENTRADA / VENTAS / TOTAL)
CREATE TABLE IF NOT EXISTS public.porciones_cierres (
  id bigserial PRIMARY KEY,
  fecha date NOT NULL,
  periodo_desde date,
  item text NOT NULL,
  existente numeric NOT NULL,
  entradas numeric NOT NULL,
  ventas numeric NOT NULL,
  total numeric NOT NULL,
  cerrado_por text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS porciones_cierres_fecha_idx ON public.porciones_cierres (fecha DESC);
ALTER TABLE public.porciones_cierres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leer_personal ON public.porciones_cierres;
CREATE POLICY leer_personal ON public.porciones_cierres FOR SELECT TO authenticated USING (rol_actual() IS NOT NULL);
REVOKE INSERT, UPDATE, DELETE ON public.porciones_cierres FROM authenticated, anon;
GRANT SELECT ON public.porciones_cierres TO authenticated;

CREATE OR REPLACE FUNCTION public.cerrar_periodo_porciones()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v RECORD; v_n INT := 0; v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  FOR v IN SELECT * FROM inventario_porciones FOR UPDATE LOOP
    INSERT INTO porciones_cierres (fecha, periodo_desde, item, existente, entradas, ventas, total, cerrado_por)
    VALUES (v_hoy, v.periodo_desde, v.item, v.existente, v.entradas, v.ventas, v.total, _usuario_actual());
    INSERT INTO movimientos_porciones (item, tipo, cantidad, total_anterior, total_nuevo, motivo, referencia, usuario)
    VALUES (v.item, 'cierre', v.total, v.total, v.total,
            'Cierre de periodo (existente ' || v.existente || ' + entradas ' || v.entradas || ' − ventas ' || v.ventas || ')', 'CIERRE', _usuario_actual());
    UPDATE inventario_porciones SET existente = v.total, entradas = 0, ventas = 0, periodo_desde = v_hoy WHERE item = v.item;
    v_n := v_n + 1;
  END LOOP;
  PERFORM _auditar('cerrar_periodo', 'porciones', NULL, jsonb_build_object('items', v_n));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Planilla del día cerrada para ' || v_n || ' productos. El TOTAL pasa a EXISTENTE de mañana.');
END $$;

-- 7. Tablero del dueño: todo lo que hay que mirar, calculado en la base en una sola llamada.
CREATE OR REPLACE FUNCTION public.tablero()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date;
  v_ini_mes DATE := date_trunc('month', (now() AT TIME ZONE 'America/Bogota'))::date;
  v_dias_mes INT := EXTRACT(DAY FROM (date_trunc('month', (now() AT TIME ZONE 'America/Bogota')) + INTERVAL '1 month - 1 day'))::int;
  v_hora_ahora TIME := (now() AT TIME ZONE 'America/Bogota')::time;
  v_ing_hoy NUMERIC; v_ing_sem NUMERIC; v_ing_mes NUMERIC; v_gas_mes NUMERIC; v_fijos_mes NUMERIC; v_gas_hoy NUMERIC;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);

  SELECT COALESCE(SUM(total), 0) INTO v_ing_hoy FROM ventas
   WHERE pago_estado = 'pagado' AND (pagado_en AT TIME ZONE 'America/Bogota')::date = v_hoy;
  -- mismo día de la semana pasada, hasta la misma hora (comparación justa)
  SELECT COALESCE(SUM(total), 0) INTO v_ing_sem FROM ventas
   WHERE pago_estado = 'pagado' AND (pagado_en AT TIME ZONE 'America/Bogota')::date = v_hoy - 7
     AND (pagado_en AT TIME ZONE 'America/Bogota')::time <= v_hora_ahora;
  SELECT COALESCE(SUM(total), 0) INTO v_ing_mes FROM ventas
   WHERE pago_estado = 'pagado' AND (pagado_en AT TIME ZONE 'America/Bogota')::date >= v_ini_mes;
  SELECT COALESCE(SUM(valor), 0), COALESCE(SUM(valor) FILTER (WHERE tipo = 'fijo'), 0) INTO v_gas_mes, v_fijos_mes
    FROM gastos WHERE fecha >= v_ini_mes AND NOT COALESCE(anulado, false);
  SELECT COALESCE(SUM(valor), 0) INTO v_gas_hoy FROM gastos WHERE fecha = v_hoy AND NOT COALESCE(anulado, false);

  RETURN jsonb_build_object(
    'generado', to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI'),
    'hoy', jsonb_build_object(
      'ingresos', v_ing_hoy,
      'ingresos_semana_pasada', v_ing_sem,
      'variacion_pct', CASE WHEN v_ing_sem > 0 THEN ROUND((v_ing_hoy - v_ing_sem) / v_ing_sem * 100) END,
      'gastos', v_gas_hoy,
      'por_cobrar', (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE estado <> 'cancelado' AND pago_estado <> 'pagado' AND created_at > now() - INTERVAL '24 hours'),
      'pedidos', (SELECT COUNT(DISTINCT COALESCE(comanda_id, id_operacion)) FROM ventas WHERE fecha = v_hoy AND estado <> 'cancelado'),
      'ticket_promedio', (SELECT ROUND(AVG(t)) FROM (SELECT SUM(total) t FROM ventas WHERE pago_estado = 'pagado'
                            AND (pagado_en AT TIME ZONE 'America/Bogota')::date = v_hoy GROUP BY COALESCE(comanda_id, id_operacion)) x),
      'por_hora', COALESCE((SELECT jsonb_agg(jsonb_build_object('hora', h, 'ingresos', s) ORDER BY h) FROM (
                    SELECT EXTRACT(HOUR FROM pagado_en AT TIME ZONE 'America/Bogota')::int h, SUM(total) s FROM ventas
                    WHERE pago_estado = 'pagado' AND (pagado_en AT TIME ZONE 'America/Bogota')::date = v_hoy GROUP BY 1) x), '[]'::jsonb),
      'por_modalidad', COALESCE((SELECT jsonb_object_agg(k, s) FROM (SELECT COALESCE(tipo_pedido, 'mesa') k, SUM(total) s FROM ventas
                    WHERE pago_estado = 'pagado' AND (pagado_en AT TIME ZONE 'America/Bogota')::date = v_hoy GROUP BY 1) x), '{}'::jsonb),
      'por_medio', COALESCE((SELECT jsonb_object_agg(k, s) FROM (SELECT COALESCE(metodo_pago, 'efectivo') k, SUM(total) s FROM ventas
                    WHERE pago_estado = 'pagado' AND (pagado_en AT TIME ZONE 'America/Bogota')::date = v_hoy GROUP BY 1) x), '{}'::jsonb)
    ),
    'mes', jsonb_build_object(
      'ingresos', v_ing_mes, 'gastos', v_gas_mes, 'gastos_fijos', v_fijos_mes,
      'balance', v_ing_mes - v_gas_mes,
      'dias_transcurridos', EXTRACT(DAY FROM v_hoy)::int, 'dias_del_mes', v_dias_mes,
      'proyeccion_ingresos', ROUND(v_ing_mes / EXTRACT(DAY FROM v_hoy) * v_dias_mes),
      'proyeccion_gastos', ROUND(v_gas_mes / EXTRACT(DAY FROM v_hoy) * v_dias_mes),
      -- cuánto de los gastos del mes ya cubren los ingresos (100 % = punto de equilibrio)
      'cobertura_gastos_pct', CASE WHEN v_gas_mes > 0 THEN ROUND(v_ing_mes / v_gas_mes * 100) END,
      'dias_con_ventas', (SELECT COUNT(DISTINCT fecha) FROM ventas WHERE pago_estado = 'pagado'),
      'gastos_por_categoria', COALESCE((SELECT jsonb_agg(jsonb_build_object('categoria', categoria, 'valor', s) ORDER BY s DESC) FROM (
                    SELECT categoria, SUM(valor) s FROM gastos WHERE fecha >= v_ini_mes AND NOT COALESCE(anulado, false) GROUP BY 1) x), '[]'::jsonb),
      'gastos_pendientes', (SELECT jsonb_build_object('n', COUNT(*), 'valor', COALESCE(SUM(valor), 0)) FROM gastos
                    WHERE estado = 'pendiente' AND NOT COALESCE(anulado, false))
    ),
    'serie_14_dias', (SELECT jsonb_agg(jsonb_build_object('fecha', d,
                        'ingresos', (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE pago_estado = 'pagado' AND (pagado_en AT TIME ZONE 'America/Bogota')::date = d),
                        'gastos', (SELECT COALESCE(SUM(valor), 0) FROM gastos WHERE fecha = d AND NOT COALESCE(anulado, false))) ORDER BY d)
                      FROM generate_series(v_hoy - 13, v_hoy, INTERVAL '1 day') g(d0), LATERAL (SELECT d0::date d) dd),
    'top_productos_7_dias', COALESCE((SELECT jsonb_agg(jsonb_build_object('plato', plato, 'unidades', u, 'ingresos', s) ORDER BY u DESC) FROM (
                    SELECT plato, SUM(cantidad) u, SUM(total) s FROM ventas WHERE estado <> 'cancelado' AND fecha > v_hoy - 7
                    GROUP BY 1 ORDER BY 2 DESC LIMIT 6) x), '[]'::jsonb),
    'operacion', jsonb_build_object(
      'pedidos_activos', COALESCE((SELECT jsonb_object_agg(estado, n) FROM (SELECT estado, COUNT(DISTINCT COALESCE(comanda_id, id_operacion)) n
                    FROM ventas WHERE estado IN ('nuevo','en_cocina','listo','en_camino') AND created_at > now() - INTERVAL '24 hours' GROUP BY 1) x), '{}'::jsonb),
      'caja', caja_actual(),
      'checklists', (SELECT jsonb_build_object('total', COUNT(*), 'hechos', COUNT(*) FILTER (WHERE (c->>'hecho')::boolean),
                       'vencidos', COUNT(*) FILTER (WHERE (c->>'vencido')::boolean), 'alertas', COALESCE(SUM((c->>'alertas')::int), 0))
                     FROM jsonb_array_elements(checklists_hoy()) c)
    ),
    'alertas', jsonb_build_object(
      'insumos_bajos', COALESCE((SELECT jsonb_agg(jsonb_build_object('item', ingrediente, 'stock', stock, 'minimo', stock_minimo, 'unidad', unidad) ORDER BY stock / NULLIF(stock_minimo, 0))
                    FROM ingredientes WHERE stock_minimo > 0 AND stock <= stock_minimo), '[]'::jsonb),
      'porciones_bajas', COALESCE((SELECT jsonb_agg(jsonb_build_object('item', item, 'total', total, 'minimo', minimo))
                    FROM inventario_porciones WHERE activo AND minimo > 0 AND total <= minimo), '[]'::jsonb),
      'faltantes', (SELECT COUNT(*) FROM reportes_faltantes WHERE NOT atendido),
      'dinero_en_riesgo', (vencimientos(2)->>'dinero_en_riesgo')::numeric,
      'agotados_menu', COALESCE((SELECT jsonb_agg(nombre) FROM productos WHERE activo AND NOT disponible), '[]'::jsonb)
    )
  );
END $$;

REVOKE ALL ON FUNCTION public.registrar_comanda(text, jsonb, text, text, text, text, text, text, boolean, text, text),
  public.comandas_abiertas(), public.cobrar_comanda(text, text), public.estado_comanda(text, text), public.tablero()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_comanda(text, jsonb, text, text, text, text, text, text, boolean, text, text),
  public.comandas_abiertas(), public.cobrar_comanda(text, text), public.estado_comanda(text, text), public.tablero()
  TO authenticated, service_role;

-- 8. Configuración del restaurante (nombre, mesas): la leen todos los cargos, la edita administración.
DROP POLICY IF EXISTS autorizados_todo ON public.restaurante_config;
DROP POLICY IF EXISTS leer_personal ON public.restaurante_config;
CREATE POLICY leer_personal ON public.restaurante_config FOR SELECT TO authenticated USING (rol_actual() IS NOT NULL);
REVOKE INSERT, UPDATE, DELETE ON public.restaurante_config FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.guardar_config(p_nombre text, p_num_mesas int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF COALESCE(TRIM(p_nombre), '') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Escribe el nombre del restaurante.'); END IF;
  IF p_num_mesas IS NULL OR p_num_mesas < 1 OR p_num_mesas > 100 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Número de mesas entre 1 y 100.'); END IF;
  UPDATE restaurante_config SET nombre = TRIM(p_nombre), num_mesas = p_num_mesas, updated_at = now() WHERE id = 1;
  IF NOT FOUND THEN INSERT INTO restaurante_config (id, nombre, num_mesas) VALUES (1, TRIM(p_nombre), p_num_mesas); END IF;
  PERFORM _auditar('guardar', 'config', NULL, jsonb_build_object('nombre', p_nombre, 'mesas', p_num_mesas));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Configuración guardada: ' || TRIM(p_nombre) || ', ' || p_num_mesas || ' mesas.');
END $$;
REVOKE ALL ON FUNCTION public.guardar_config(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_config(text, int) TO authenticated, service_role;
