-- 007: funciones para checklists, vencimientos, comprobantes Nequi y pantalla de cocina.
-- Usa el modelo de cargos de la migración 004 (rol_actual / _exigir_rol).

-- 1. Permisos: las tablas de la 002 usaban es_autorizado(), que solo reconoce la lista
--    de correos autorizados; un empleado con cargo (cocina, mesera…) no podía leerlas.
DROP POLICY IF EXISTS autorizados_todo ON public.checklist_plantillas;
DROP POLICY IF EXISTS autorizados_todo ON public.checklist_items;
DROP POLICY IF EXISTS autorizados_todo ON public.checklist_ejecuciones;
DROP POLICY IF EXISTS autorizados_todo ON public.lotes;
DROP POLICY IF EXISTS autorizados_todo ON public.comprobantes_pago;

CREATE POLICY leer_personal ON public.checklist_plantillas FOR SELECT TO authenticated USING (rol_actual() IS NOT NULL);
CREATE POLICY leer_personal ON public.checklist_items      FOR SELECT TO authenticated USING (rol_actual() IS NOT NULL);
CREATE POLICY leer_admin    ON public.checklist_ejecuciones FOR SELECT TO authenticated USING (rol_actual() = 'admin');
CREATE POLICY leer_personal ON public.lotes                FOR SELECT TO authenticated USING (rol_actual() IS NOT NULL);
CREATE POLICY leer_admin    ON public.comprobantes_pago    FOR SELECT TO authenticated USING (rol_actual() = 'admin');
-- Escritura solo por funciones (igual que el resto de tablas desde la 004)
REVOKE INSERT, UPDATE, DELETE ON public.checklist_plantillas, public.checklist_items, public.checklist_ejecuciones,
  public.lotes, public.comprobantes_pago FROM authenticated, anon;

DROP POLICY IF EXISTS comprobantes_autorizados ON storage.objects;
CREATE POLICY comprobantes_caja_subir ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes' AND public.rol_actual() = 'admin');
CREATE POLICY comprobantes_caja_ver ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprobantes' AND public.rol_actual() = 'admin');

-- 2. Plantillas con los nombres de cargo actuales (+ limpieza de turno, que estaba en la propuesta)
UPDATE public.checklist_plantillas SET rol = 'mesera' WHERE rol = 'mesero';
UPDATE public.checklist_plantillas SET rol = 'admin'  WHERE rol = 'caja';
INSERT INTO public.checklist_plantillas (nombre, rol, hora_limite, activo)
SELECT 'Limpieza de turno', 'cocina', '16:00', true
WHERE NOT EXISTS (SELECT 1 FROM public.checklist_plantillas WHERE nombre = 'Limpieza de turno');
INSERT INTO public.checklist_items (plantilla_id, texto, tipo, minimo, maximo, obligatorio, orden)
SELECT p.id, x.texto, x.tipo, NULL, NULL, true, x.orden
FROM public.checklist_plantillas p,
     (VALUES ('Superficies y mesones limpios', 'si_no', 1), ('Trampa de grasa revisada', 'si_no', 2), ('Pisos trapeados', 'si_no', 3)) AS x(texto, tipo, orden)
WHERE p.nombre = 'Limpieza de turno' AND NOT EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.plantilla_id = p.id);

CREATE UNIQUE INDEX IF NOT EXISTS checklist_ejecucion_unica ON public.checklist_ejecuciones (plantilla_id, fecha);

-- 3. Checklists del día para el cargo actual (administración ve todos)
CREATE OR REPLACE FUNCTION public.checklists_hoy()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol TEXT := rol_actual(); v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date;
        v_ahora TIME := (now() AT TIME ZONE 'America/Bogota')::time;
BEGIN
  IF v_rol IS NULL THEN RAISE EXCEPTION 'No autorizado: inicia sesión con una cuenta activa.'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'rol', p.rol, 'hora_limite', to_char(p.hora_limite, 'HH24:MI'),
      'hecho', e.id IS NOT NULL,
      'hecho_por', e.empleado, 'hecho_a', to_char(e.completado_en AT TIME ZONE 'America/Bogota', 'HH24:MI'),
      'alertas', COALESCE(e.alertas, 0),
      'vencido', e.id IS NULL AND v_ahora > p.hora_limite,
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'texto', i.texto, 'tipo', i.tipo,
                          'minimo', i.minimo, 'maximo', i.maximo, 'obligatorio', i.obligatorio) ORDER BY i.orden)
                         FROM checklist_items i WHERE i.plantilla_id = p.id), '[]'::jsonb),
      'respuestas', e.respuestas
    ) ORDER BY p.hora_limite)
    FROM checklist_plantillas p
    LEFT JOIN checklist_ejecuciones e ON e.plantilla_id = p.id AND e.fecha = v_hoy
    WHERE p.activo AND (v_rol = 'admin' OR p.rol = v_rol)
  ), '[]'::jsonb);
END $$;

-- p_respuestas: {"<id del ítem>": true | false | número}
CREATE OR REPLACE FUNCTION public.guardar_checklist(p_plantilla_id bigint, p_respuestas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol TEXT := rol_actual(); v_p RECORD; v_i RECORD; v_val JSONB; v_alertas INT := 0; v_detalle TEXT[] := '{}';
        v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date; v_num NUMERIC;
BEGIN
  IF v_rol IS NULL THEN RAISE EXCEPTION 'No autorizado: inicia sesión con una cuenta activa.'; END IF;
  SELECT * INTO v_p FROM checklist_plantillas WHERE id = p_plantilla_id AND activo;
  IF v_p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Checklist no encontrado.'); END IF;
  IF v_rol <> 'admin' AND v_p.rol <> v_rol THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Este checklist es de otro cargo.');
  END IF;
  IF EXISTS (SELECT 1 FROM checklist_ejecuciones WHERE plantilla_id = p_plantilla_id AND fecha = v_hoy) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Este checklist ya se completó hoy.');
  END IF;
  FOR v_i IN SELECT * FROM checklist_items WHERE plantilla_id = p_plantilla_id ORDER BY orden LOOP
    v_val := p_respuestas -> v_i.id::text;
    IF v_val IS NULL OR v_val = 'null'::jsonb THEN
      IF v_i.obligatorio THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta responder: ' || v_i.texto); END IF;
      CONTINUE;
    END IF;
    IF v_i.tipo = 'numero' THEN
      BEGIN v_num := (v_val #>> '{}')::numeric;
      EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Escribe un número en: ' || v_i.texto); END;
      IF (v_i.minimo IS NOT NULL AND v_num < v_i.minimo) OR (v_i.maximo IS NOT NULL AND v_num > v_i.maximo) THEN
        v_alertas := v_alertas + 1; v_detalle := v_detalle || (v_i.texto || ': ' || v_num);
      END IF;
    ELSIF v_val = 'false'::jsonb THEN
      v_alertas := v_alertas + 1; v_detalle := v_detalle || (v_i.texto || ': no');
    END IF;
  END LOOP;
  INSERT INTO checklist_ejecuciones (plantilla_id, fecha, empleado, respuestas, alertas, completado_en)
  VALUES (p_plantilla_id, v_hoy, _usuario_actual(), p_respuestas, v_alertas, now());
  PERFORM _auditar('completar', 'checklist', v_p.nombre, jsonb_build_object('alertas', v_alertas, 'detalle', v_detalle));
  RETURN jsonb_build_object('ok', true, 'alertas', v_alertas, 'detalle', v_detalle,
    'mensaje', v_p.nombre || ' completado' || CASE WHEN v_alertas > 0 THEN ' con ' || v_alertas || ' alerta(s): ' || array_to_string(v_detalle, ' · ') ELSE ' sin novedades.' END);
END $$;

-- 4. Vencimientos: lotes con fecha dentro de p_dias (incluye los ya vencidos)
CREATE OR REPLACE FUNCTION public.vencimientos(p_dias int DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF rol_actual() IS NULL THEN RAISE EXCEPTION 'No autorizado: inicia sesión con una cuenta activa.'; END IF;
  RETURN jsonb_build_object(
    'lotes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'ingrediente', l.ingrediente, 'cantidad', l.cantidad_actual,
               'unidad', i.unidad, 'vence_el', l.vence_el, 'dias_restantes', l.vence_el - v_hoy,
               'dinero', ROUND(l.cantidad_actual * COALESCE(l.costo_unitario, i.costo_unitario, 0), 0),
               'referencia', l.referencia) ORDER BY l.vence_el, l.ingrediente)
      FROM lotes l JOIN ingredientes i ON i.ingrediente = l.ingrediente
      WHERE l.cantidad_actual > 0 AND l.vence_el IS NOT NULL AND l.vence_el <= v_hoy + p_dias), '[]'::jsonb),
    'dinero_en_riesgo', COALESCE((
      SELECT ROUND(SUM(l.cantidad_actual * COALESCE(l.costo_unitario, i.costo_unitario, 0)), 0)
      FROM lotes l JOIN ingredientes i ON i.ingrediente = l.ingrediente
      WHERE l.cantidad_actual > 0 AND l.vence_el IS NOT NULL AND l.vence_el <= v_hoy + 2), 0),
    -- con existencias pero sin ningún lote fechado ni vida útil: no se puede avisar
    'sin_fecha', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('ingrediente', i.ingrediente, 'stock', i.stock, 'unidad', i.unidad) ORDER BY i.ingrediente)
      FROM ingredientes i
      WHERE i.stock > 0 AND i.vida_util_dias IS NULL
        AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.ingrediente = i.ingrediente AND l.cantidad_actual > 0 AND l.vence_el IS NOT NULL)), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.fijar_vida_util(p_ingrediente text, p_dias int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ing TEXT;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF p_dias IS NOT NULL AND p_dias <= 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Los días deben ser positivos.'); END IF;
  UPDATE ingredientes SET vida_util_dias = p_dias WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente)) RETURNING ingrediente INTO v_ing;
  IF v_ing IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El insumo no existe.'); END IF;
  -- lotes ya comprados sin fecha: se fechan desde su compra
  UPDATE lotes SET vence_el = (created_at AT TIME ZONE 'America/Bogota')::date + p_dias
   WHERE ingrediente = v_ing AND vence_el IS NULL AND cantidad_actual > 0 AND p_dias IS NOT NULL;
  PERFORM _auditar('guardar', 'vida_util', v_ing, jsonb_build_object('dias', p_dias));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Vida útil de ' || v_ing || ': ' || COALESCE(p_dias::text, 'sin definir') || ' días.');
END $$;

-- 5. Merma con cargos y kardex completo (la de la 002 usaba el permiso viejo y no dejaba usuario)
CREATE OR REPLACE FUNCTION public.registrar_merma(p_ingrediente text, p_cantidad numeric, p_motivo text, p_por text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v RECORD; v_res JSONB;
BEGIN
  PERFORM _exigir_rol(ARRAY['cocina','parrilla']);
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La cantidad debe ser positiva.'); END IF;
  IF COALESCE(TRIM(p_motivo), '') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Indica el motivo (vencido, quemado, se cayó…).'); END IF;
  SELECT * INTO v FROM ingredientes WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente));
  IF v.ingrediente IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El insumo no existe.'); END IF;
  IF p_cantidad > v.stock THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Solo hay ' || v.stock || ' ' || v.unidad || ' de ' || v.ingrediente || '.'); END IF;
  v_res := _mover_stock(v.ingrediente, -p_cantidad, 'merma', 'Merma: ' || p_motivo, 'MERMA-' || to_char(now(), 'YYYYMMDDHH24MISSMS'));
  PERFORM _auditar('registrar', 'merma', v.ingrediente, jsonb_build_object('cantidad', p_cantidad, 'motivo', p_motivo,
    'costo', ROUND(p_cantidad * COALESCE(v.costo_unitario, 0), 0)));
  RETURN jsonb_build_object('ok', true, 'costo', ROUND(p_cantidad * COALESCE(v.costo_unitario, 0), 0),
    'mensaje', 'Merma registrada: −' || p_cantidad || ' ' || v.unidad || ' de ' || v.ingrediente
               || CASE WHEN COALESCE(v.costo_unitario, 0) > 0 THEN ' ($' || to_char(ROUND(p_cantidad * v.costo_unitario, 0), 'FM999G999G999') || ' perdidos).' ELSE '.' END);
END $$;

-- 6. Comprobante de pago (foto Nequi / transferencia) unido a la venta.
--    Desde la 004 los pedidos viven en ventas, no en la tabla pedidos.
ALTER TABLE public.comprobantes_pago DROP CONSTRAINT IF EXISTS comprobantes_pago_pedido_id_fkey;
ALTER TABLE public.comprobantes_pago ADD CONSTRAINT comprobantes_pago_venta_fkey
  FOREIGN KEY (pedido_id) REFERENCES public.ventas(id_operacion) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS comprobante_referencia_unica
  ON public.comprobantes_pago (LOWER(TRIM(referencia))) WHERE COALESCE(TRIM(referencia), '') <> '';

CREATE OR REPLACE FUNCTION public.adjuntar_comprobante(p_venta_id text, p_foto_path text, p_metodo text DEFAULT 'nequi',
  p_monto numeric DEFAULT NULL, p_referencia text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v RECORD; v_otro TEXT; v_coincide BOOLEAN;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  SELECT * INTO v FROM ventas WHERE id_operacion = p_venta_id;
  IF v.id_operacion IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Venta no encontrada.'); END IF;
  IF COALESCE(TRIM(p_foto_path), '') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta la foto del comprobante.'); END IF;
  IF COALESCE(TRIM(p_referencia), '') <> '' THEN
    SELECT pedido_id INTO v_otro FROM comprobantes_pago WHERE LOWER(TRIM(referencia)) = LOWER(TRIM(p_referencia));
    IF v_otro IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'mensaje', 'Esa referencia ya se usó en el pedido ' || v_otro || '. Puede ser una captura vieja.');
    END IF;
  END IF;
  v_coincide := CASE WHEN p_monto IS NULL THEN NULL ELSE ABS(p_monto - v.total) < 1 END;
  INSERT INTO comprobantes_pago (pedido_id, metodo, foto_path, monto, referencia, coincide, registrado_por)
  VALUES (p_venta_id, COALESCE(NULLIF(p_metodo, ''), 'nequi'), p_foto_path, p_monto, NULLIF(TRIM(p_referencia), ''), v_coincide, _usuario_actual());
  PERFORM _auditar('registrar', 'comprobante', p_venta_id, jsonb_build_object('monto', p_monto, 'referencia', p_referencia, 'coincide', v_coincide));
  RETURN jsonb_build_object('ok', true, 'coincide', v_coincide,
    'mensaje', CASE WHEN v_coincide = false THEN 'Comprobante guardado, pero el monto ($' || to_char(p_monto, 'FM999G999G999')
                    || ') no coincide con la cuenta ($' || to_char(v.total, 'FM999G999G999') || ').'
               ELSE 'Comprobante guardado.' END);
END $$;

-- 7. "Se acabó": cocina y parrilla ocultan o devuelven un plato al menú con un toque
CREATE OR REPLACE FUNCTION public.marcar_disponible(p_producto text, p_disponible boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_nombre TEXT;
BEGIN
  PERFORM _exigir_rol(ARRAY['cocina','parrilla']);
  UPDATE productos SET disponible = COALESCE(p_disponible, true) WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(p_producto)) RETURNING nombre INTO v_nombre;
  IF v_nombre IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Producto no encontrado.'); END IF;
  PERFORM _auditar(CASE WHEN p_disponible THEN 'habilitar' ELSE 'agotar' END, 'producto', v_nombre, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'mensaje', CASE WHEN p_disponible THEN v_nombre || ' vuelve al menú.' ELSE v_nombre || ' marcado como agotado.' END);
END $$;

REVOKE ALL ON FUNCTION public.checklists_hoy(), public.guardar_checklist(bigint, jsonb), public.vencimientos(int),
  public.fijar_vida_util(text, int), public.registrar_merma(text, numeric, text, text),
  public.adjuntar_comprobante(text, text, text, numeric, text), public.marcar_disponible(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checklists_hoy(), public.guardar_checklist(bigint, jsonb), public.vencimientos(int),
  public.fijar_vida_util(text, int), public.registrar_merma(text, numeric, text, text),
  public.adjuntar_comprobante(text, text, text, numeric, text), public.marcar_disponible(text, boolean) TO authenticated, service_role;
