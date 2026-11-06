-- =====================================================================
-- 002 · Operación del restaurante
-- APLICADA en Supabase (proyecto nqytcqambzznviybguxf) el 2026-11-05.
-- Configuración, menú por secciones, costos, empleados con PIN,
-- pedidos + cocina + caja, compras con lotes y vencimiento (FEFO),
-- mermas, checklists y comprobantes de pago (Nequi).
-- Solo AGREGA tablas/columnas; no borra datos existentes.
-- =====================================================================

ALTER TABLE public.ventas          ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pagado';
ALTER TABLE public.ingredientes    ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.ingredientes    ADD COLUMN IF NOT EXISTS stock_ideal NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ingredientes    ADD COLUMN IF NOT EXISTS vida_util_dias INT;
ALTER TABLE public.conceptos_gasto ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'variable';
ALTER TABLE public.gastos          ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'variable';

CREATE TABLE IF NOT EXISTS public.restaurante_config (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre      TEXT NOT NULL DEFAULT 'Mi Restaurante',
  eslogan     TEXT NOT NULL DEFAULT 'Panel de gestión',
  logo_url    TEXT,
  color       TEXT NOT NULL DEFAULT '#2563EB',
  num_mesas   INT  NOT NULL DEFAULT 10,
  umbral_caja NUMERIC(12,2) NOT NULL DEFAULT 10000,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.secciones (
  id       BIGSERIAL PRIMARY KEY,
  nombre   TEXT NOT NULL UNIQUE,
  estacion TEXT NOT NULL DEFAULT 'cocina',
  orden    INT  NOT NULL DEFAULT 0,
  activo   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.productos (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  seccion_id  BIGINT REFERENCES public.secciones(id) ON DELETE SET NULL,
  precio      NUMERIC(12,2) NOT NULL DEFAULT 0,
  descripcion TEXT,
  imagen_url  TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_producto_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nombre <> OLD.nombre THEN
    UPDATE public.recetas SET plato = NEW.nombre WHERE LOWER(TRIM(plato)) = LOWER(TRIM(OLD.nombre));
  END IF;
  UPDATE public.recetas SET precio = NEW.precio WHERE LOWER(TRIM(plato)) = LOWER(TRIM(NEW.nombre));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS producto_sync ON public.productos;
CREATE TRIGGER producto_sync AFTER INSERT OR UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.tg_producto_sync();

CREATE TABLE IF NOT EXISTS public.empleados (
  id         BIGSERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  rol        TEXT NOT NULL CHECK (rol IN ('admin','mesero','cocina','caja')),
  pin_hash   TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cajas (
  id              BIGSERIAL PRIMARY KEY,
  estado          TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  base            NUMERIC(12,2) NOT NULL DEFAULT 0,
  abierta_por     TEXT,
  abierta_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_por     TEXT,
  cerrada_en      TIMESTAMPTZ,
  ventas_efectivo NUMERIC(12,2),
  ventas_otros    NUMERIC(12,2),
  esperado        NUMERIC(12,2),
  contado         NUMERIC(12,2),
  diferencia      NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS public.pedidos (
  id            TEXT PRIMARY KEY,
  mesa          TEXT NOT NULL,
  comensales    INT  NOT NULL DEFAULT 1,
  mesero        TEXT,
  estado        TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','pagado','cancelado')),
  nota          TEXT,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago   TEXT,
  caja_id       BIGINT REFERENCES public.cajas(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  pagado_en     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.pedido_items (
  id          BIGSERIAL PRIMARY KEY,
  pedido_id   TEXT NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto    TEXT NOT NULL,
  estacion    TEXT NOT NULL DEFAULT 'cocina',
  cantidad    INT  NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio      NUMERIC(12,2) NOT NULL DEFAULT 0,
  nota        TEXT,
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_cocina','listo','entregado','cancelado')),
  enviado_en  TIMESTAMPTZ,
  listo_en    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_items_estado_idx ON public.pedido_items(estado);

CREATE TABLE IF NOT EXISTS public.proveedores (
  id       BIGSERIAL PRIMARY KEY,
  nombre   TEXT NOT NULL UNIQUE,
  telefono TEXT
);

CREATE TABLE IF NOT EXISTS public.checklist_plantillas (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'cocina',
  hora_limite TIME,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id           BIGSERIAL PRIMARY KEY,
  plantilla_id BIGINT NOT NULL REFERENCES public.checklist_plantillas(id) ON DELETE CASCADE,
  texto        TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'si_no' CHECK (tipo IN ('si_no','numero')),
  minimo       NUMERIC,
  maximo       NUMERIC,
  obligatorio  BOOLEAN NOT NULL DEFAULT TRUE,
  orden        INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.checklist_ejecuciones (
  id            BIGSERIAL PRIMARY KEY,
  plantilla_id  BIGINT NOT NULL REFERENCES public.checklist_plantillas(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
  empleado      TEXT,
  respuestas    JSONB NOT NULL DEFAULT '[]'::jsonb,
  alertas       INT NOT NULL DEFAULT 0,
  completado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lotes (
  id               BIGSERIAL PRIMARY KEY,
  ingrediente      TEXT NOT NULL REFERENCES public.ingredientes(ingrediente) ON UPDATE CASCADE,
  cantidad_inicial NUMERIC(12,3) NOT NULL,
  cantidad_actual  NUMERIC(12,3) NOT NULL,
  costo_unitario   NUMERIC(14,4) NOT NULL DEFAULT 0,
  vence_el         DATE,
  referencia       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lotes_vence_idx ON public.lotes(vence_el) WHERE cantidad_actual > 0;

CREATE TABLE IF NOT EXISTS public.comprobantes_pago (
  id             BIGSERIAL PRIMARY KEY,
  pedido_id      TEXT REFERENCES public.pedidos(id) ON DELETE SET NULL,
  metodo         TEXT NOT NULL DEFAULT 'nequi',
  foto_path      TEXT NOT NULL,          -- ruta en el bucket privado "comprobantes"
  monto          NUMERIC(12,2),          -- confirmado por el cajero
  referencia     TEXT UNIQUE,            -- evita reutilizar una captura
  leido_por_ia   JSONB,                  -- sugerencia de Gemini {monto, referencia, fecha}
  coincide       BOOLEAN,
  registrado_por TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.lotes_en_riesgo WITH (security_invoker = true) AS
SELECT l.id, l.ingrediente, l.cantidad_actual, i.unidad, l.vence_el,
       (l.vence_el - (now() AT TIME ZONE 'America/Bogota')::date) AS dias_restantes,
       ROUND(l.cantidad_actual * l.costo_unitario, 0) AS dinero_en_riesgo
FROM public.lotes l JOIN public.ingredientes i ON i.ingrediente = l.ingrediente
WHERE l.cantidad_actual > 0 AND l.vence_el <= (now() AT TIME ZONE 'America/Bogota')::date + 2
ORDER BY l.vence_el;

-- Seguridad: solo usuarios de usuarios_autorizados
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['restaurante_config','secciones','productos','empleados','cajas','pedidos','pedido_items','proveedores',
                           'checklist_plantillas','checklist_items','checklist_ejecuciones','lotes','comprobantes_pago']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS autorizados_todo ON public.%I', t);
    EXECUTE format('CREATE POLICY autorizados_todo ON public.%I FOR ALL TO authenticated USING (public.es_autorizado()) WITH CHECK (public.es_autorizado())', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
REVOKE ALL ON public.lotes_en_riesgo FROM anon;
REVOKE SELECT ON public.empleados FROM authenticated;
GRANT SELECT (id, nombre, rol, activo, created_at) ON public.empleados TO authenticated;
REVOKE INSERT, UPDATE ON public.empleados FROM authenticated;

DROP POLICY IF EXISTS escribir_recetas ON public.recetas;
CREATE POLICY escribir_recetas ON public.recetas FOR ALL TO authenticated USING (public.es_autorizado()) WITH CHECK (public.es_autorizado());
DROP POLICY IF EXISTS escribir_ingredientes ON public.ingredientes;
CREATE POLICY escribir_ingredientes ON public.ingredientes FOR UPDATE TO authenticated USING (public.es_autorizado()) WITH CHECK (public.es_autorizado());
DROP POLICY IF EXISTS escribir_conceptos ON public.conceptos_gasto;
CREATE POLICY escribir_conceptos ON public.conceptos_gasto FOR ALL TO authenticated USING (public.es_autorizado()) WITH CHECK (public.es_autorizado());

CREATE OR REPLACE FUNCTION public._exigir_autorizado() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.es_autorizado() THEN RAISE EXCEPTION 'No autorizado'; END IF;
END $$;

-- Venta: precio desde productos; descuenta receta del stock y de los lotes (FEFO)
CREATE OR REPLACE FUNCTION public.registrar_venta(p_id text, p_plato text, p_cantidad integer, p_estado text DEFAULT 'pagado')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_precio NUMERIC; v_r RECORD; v_need NUMERIC; v_rest NUMERIC; v_l RECORD; v_take NUMERIC;
BEGIN
  SELECT precio INTO v_precio FROM productos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(p_plato));
  IF v_precio IS NULL THEN
    SELECT precio INTO v_precio FROM recetas WHERE LOWER(TRIM(plato)) = LOWER(TRIM(p_plato)) LIMIT 1;
  END IF;
  IF v_precio IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'El producto "' || p_plato || '" no existe en el menú.');
  END IF;

  INSERT INTO ventas (id_operacion, fecha, plato, cantidad, total, estado, created_at)
  VALUES (p_id, (now() AT TIME ZONE 'America/Bogota')::date, p_plato, p_cantidad, v_precio * p_cantidad, COALESCE(p_estado,'pagado'), now())
  ON CONFLICT (id_operacion) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'mensaje', 'Venta ya registrada (sin duplicar).');
  END IF;

  FOR v_r IN SELECT ingrediente, cantidad FROM recetas WHERE LOWER(TRIM(plato)) = LOWER(TRIM(p_plato)) LOOP
    v_need := v_r.cantidad * p_cantidad;
    UPDATE ingredientes SET stock = GREATEST(0, stock - v_need) WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(v_r.ingrediente));
    v_rest := v_need;
    FOR v_l IN SELECT id, cantidad_actual FROM lotes WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(v_r.ingrediente)) AND cantidad_actual > 0
               ORDER BY vence_el NULLS LAST, created_at FOR UPDATE LOOP
      EXIT WHEN v_rest <= 0;
      v_take := LEAST(v_rest, v_l.cantidad_actual);
      UPDATE lotes SET cantidad_actual = cantidad_actual - v_take WHERE id = v_l.id;
      v_rest := v_rest - v_take;
    END LOOP;
    INSERT INTO movimientos_inventario (ingrediente, delta, motivo, referencia, created_at)
    VALUES (v_r.ingrediente, -v_need, 'Venta (' || p_cantidad || 'x ' || p_plato || ')', p_id, now());
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Venta registrada (' || p_cantidad || 'x ' || p_plato || '). Insumos descontados.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'mensaje', 'Error en venta: ' || SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.guardar_empleado(p_id bigint, p_nombre text, p_rol text, p_pin text, p_activo boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id BIGINT;
BEGIN
  PERFORM _exigir_autorizado();
  IF p_pin IS NOT NULL AND p_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'El PIN debe tener 4 dígitos.');
  END IF;
  IF p_pin IS NOT NULL AND EXISTS (SELECT 1 FROM empleados WHERE activo AND pin_hash = crypt(p_pin, pin_hash) AND id IS DISTINCT FROM p_id) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Ese PIN ya lo usa otro empleado.');
  END IF;
  IF p_id IS NULL THEN
    IF p_pin IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Asigna un PIN.'); END IF;
    INSERT INTO empleados (nombre, rol, pin_hash, activo) VALUES (p_nombre, p_rol, crypt(p_pin, gen_salt('bf')), p_activo) RETURNING id INTO v_id;
  ELSE
    UPDATE empleados SET nombre = p_nombre, rol = p_rol, activo = p_activo,
      pin_hash = CASE WHEN p_pin IS NULL THEN pin_hash ELSE crypt(p_pin, gen_salt('bf')) END
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Empleado guardado.', 'id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.verificar_pin(p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v RECORD;
BEGIN
  PERFORM _exigir_autorizado();
  SELECT id, nombre, rol INTO v FROM empleados WHERE activo AND pin_hash = crypt(p_pin, pin_hash) LIMIT 1;
  IF v.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'PIN incorrecto.'); END IF;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Hola ' || v.nombre, 'id', v.id, 'nombre', v.nombre, 'rol', v.rol);
END $$;

CREATE OR REPLACE FUNCTION public.cobrar_pedido(p_pedido_id text, p_metodo text, p_caja_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_it RECORD; v_res JSONB; v_total NUMERIC := 0; v_estado TEXT;
BEGIN
  PERFORM _exigir_autorizado();
  SELECT estado INTO v_estado FROM pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF v_estado IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Pedido no encontrado.'); END IF;
  IF v_estado <> 'abierto' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El pedido ya está ' || v_estado || '.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM cajas WHERE id = p_caja_id AND estado = 'abierta') THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'No hay una caja abierta.');
  END IF;
  FOR v_it IN SELECT * FROM pedido_items WHERE pedido_id = p_pedido_id AND estado <> 'cancelado' LOOP
    v_res := registrar_venta(p_pedido_id || '-' || v_it.id, v_it.producto, v_it.cantidad, 'pagado');
    IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION '%', v_res->>'mensaje'; END IF;
    v_total := v_total + v_it.precio * v_it.cantidad;
  END LOOP;
  IF v_total = 0 THEN RAISE EXCEPTION 'El pedido no tiene productos.'; END IF;
  UPDATE pedido_items SET estado = 'entregado' WHERE pedido_id = p_pedido_id AND estado <> 'cancelado';
  UPDATE pedidos SET estado = 'pagado', total = v_total, metodo_pago = p_metodo, caja_id = p_caja_id, pagado_en = now() WHERE id = p_pedido_id;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Pedido cobrado. Inventario descontado.', 'total', v_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'mensaje', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.cerrar_caja(p_caja_id bigint, p_contado numeric, p_por text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base NUMERIC; v_ef NUMERIC; v_ot NUMERIC; v_esp NUMERIC;
BEGIN
  PERFORM _exigir_autorizado();
  SELECT base INTO v_base FROM cajas WHERE id = p_caja_id AND estado = 'abierta';
  IF v_base IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La caja no está abierta.'); END IF;
  SELECT COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'efectivo'), 0), COALESCE(SUM(total) FILTER (WHERE metodo_pago <> 'efectivo'), 0)
    INTO v_ef, v_ot FROM pedidos WHERE caja_id = p_caja_id AND estado = 'pagado';
  v_esp := v_base + v_ef;
  UPDATE cajas SET estado = 'cerrada', cerrada_por = p_por, cerrada_en = now(), ventas_efectivo = v_ef, ventas_otros = v_ot,
    esperado = v_esp, contado = p_contado, diferencia = p_contado - v_esp WHERE id = p_caja_id;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Caja cerrada.', 'esperado', v_esp, 'contado', p_contado, 'diferencia', p_contado - v_esp,
    'ventas_efectivo', v_ef, 'ventas_otros', v_ot);
END $$;

-- Compra en un solo paso: stock + costo promedio + gasto + movimiento + lote con vencimiento
CREATE OR REPLACE FUNCTION public.registrar_compra(p_ingrediente text, p_cantidad numeric, p_valor numeric, p_proveedor text DEFAULT NULL, p_por text DEFAULT NULL, p_vence_el date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_nuevo_costo NUMERIC; v_gid TEXT; v_vence DATE; v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  PERFORM _exigir_autorizado();
  IF p_cantidad <= 0 OR p_valor < 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Cantidad y valor deben ser positivos.'); END IF;
  SELECT * INTO v FROM ingredientes WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente)) FOR UPDATE;
  IF v.ingrediente IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Ingrediente no existe.'); END IF;
  v_nuevo_costo := (GREATEST(v.stock,0) * v.costo_unitario + p_valor) / (GREATEST(v.stock,0) + p_cantidad);
  UPDATE ingredientes SET stock = stock + p_cantidad, costo_unitario = ROUND(v_nuevo_costo, 4) WHERE ingrediente = v.ingrediente;
  v_gid := 'G-' || to_char(now() AT TIME ZONE 'America/Bogota', 'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text), 1, 4);
  INSERT INTO gastos (id_operacion, fecha, concepto, categoria, valor, tipo, created_at)
  VALUES (v_gid, v_hoy, 'Compra de ' || v.ingrediente, 'ingredientes', p_valor, 'variable', now());
  INSERT INTO movimientos_inventario (ingrediente, delta, motivo, referencia, created_at)
  VALUES (v.ingrediente, p_cantidad, 'Compra' || COALESCE(' a ' || NULLIF(p_proveedor,''), '') || COALESCE(' · ' || p_por, ''), v_gid, now());
  v_vence := COALESCE(p_vence_el, CASE WHEN v.vida_util_dias IS NOT NULL THEN v_hoy + v.vida_util_dias END);
  INSERT INTO lotes (ingrediente, cantidad_inicial, cantidad_actual, costo_unitario, vence_el, referencia)
  VALUES (v.ingrediente, p_cantidad, p_cantidad, ROUND(p_valor / p_cantidad, 4), v_vence, v_gid);
  IF NULLIF(p_proveedor,'') IS NOT NULL THEN
    INSERT INTO proveedores (nombre) VALUES (p_proveedor) ON CONFLICT (nombre) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Compra registrada: +' || p_cantidad || ' ' || v.unidad || ' de ' || v.ingrediente || '. Gasto creado.',
    'costo_unitario', ROUND(v_nuevo_costo, 4), 'vence_el', v_vence);
END $$;

CREATE OR REPLACE FUNCTION public.registrar_merma(p_ingrediente text, p_cantidad numeric, p_motivo text, p_por text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_rest NUMERIC := p_cantidad; v_l RECORD; v_take NUMERIC;
BEGIN
  PERFORM _exigir_autorizado();
  IF p_cantidad <= 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La cantidad debe ser positiva.'); END IF;
  SELECT * INTO v FROM ingredientes WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente)) FOR UPDATE;
  IF v.ingrediente IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Ingrediente no existe.'); END IF;
  UPDATE ingredientes SET stock = GREATEST(0, stock - p_cantidad) WHERE ingrediente = v.ingrediente;
  FOR v_l IN SELECT id, cantidad_actual FROM lotes WHERE ingrediente = v.ingrediente AND cantidad_actual > 0
             ORDER BY vence_el NULLS LAST, created_at FOR UPDATE LOOP
    EXIT WHEN v_rest <= 0;
    v_take := LEAST(v_rest, v_l.cantidad_actual);
    UPDATE lotes SET cantidad_actual = cantidad_actual - v_take WHERE id = v_l.id;
    v_rest := v_rest - v_take;
  END LOOP;
  INSERT INTO movimientos_inventario (ingrediente, delta, motivo, referencia, created_at)
  VALUES (v.ingrediente, -p_cantidad, 'Merma: ' || p_motivo || COALESCE(' · ' || p_por, ''), 'MERMA', now());
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Merma registrada: −' || p_cantidad || ' ' || v.unidad || ' de ' || v.ingrediente || '.',
    'costo', ROUND(p_cantidad * v.costo_unitario, 0));
END $$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['guardar_empleado(bigint,text,text,text,boolean)','verificar_pin(text)','cobrar_pedido(text,text,bigint)',
                           'cerrar_caja(bigint,numeric,text)','registrar_compra(text,numeric,numeric,text,text,date)',
                           'registrar_merma(text,numeric,text,text)','_exigir_autorizado()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Fotos de comprobantes: bucket privado
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS comprobantes_autorizados ON storage.objects;
CREATE POLICY comprobantes_autorizados ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'comprobantes' AND public.es_autorizado())
  WITH CHECK (bucket_id = 'comprobantes' AND public.es_autorizado());

-- Datos iniciales
INSERT INTO public.restaurante_config (id, nombre, eslogan) VALUES (1, 'Mi Restaurante', 'Panel de gestión') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.secciones (nombre, estacion, orden) VALUES
  ('Platos fuertes', 'cocina', 1), ('Bebidas', 'bar', 2)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.productos (nombre, seccion_id, precio)
SELECT DISTINCT ON (LOWER(TRIM(r.plato))) r.plato,
       (SELECT id FROM public.secciones WHERE nombre = CASE WHEN r.plato ILIKE '%limonada%' OR r.plato ILIKE '%jugo%' OR r.plato ILIKE '%gaseosa%' THEN 'Bebidas' ELSE 'Platos fuertes' END),
       r.precio
FROM public.recetas r
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.checklist_plantillas (nombre, rol, hora_limite)
SELECT * FROM (VALUES ('Apertura de cocina','cocina','10:30'::time), ('Apertura de salón','mesero','11:00'::time),
                      ('Apertura de caja','caja','11:00'::time), ('Cierre de cocina','cocina','22:30'::time)) v(n, r, h)
WHERE NOT EXISTS (SELECT 1 FROM public.checklist_plantillas);

INSERT INTO public.checklist_items (plantilla_id, texto, tipo, minimo, maximo, orden)
SELECT p.id, i.texto, i.tipo, i.mn, i.mx, i.o
FROM public.checklist_plantillas p
JOIN (VALUES
  ('Apertura de cocina', 'Gas y extractor encendidos', 'si_no', NULL::numeric, NULL::numeric, 1),
  ('Apertura de cocina', 'Temperatura de la nevera (°C)', 'numero', 0, 4, 2),
  ('Apertura de cocina', 'Mise en place lista', 'si_no', NULL, NULL, 3),
  ('Apertura de cocina', 'Fechas de vencimiento revisadas', 'si_no', NULL, NULL, 4),
  ('Apertura de salón', 'Mesas limpias y montadas', 'si_no', NULL, NULL, 1),
  ('Apertura de salón', 'Baños revisados y con insumos', 'si_no', NULL, NULL, 2),
  ('Apertura de salón', 'Menú y QR en las mesas', 'si_no', NULL, NULL, 3),
  ('Apertura de caja', 'Base contada', 'si_no', NULL, NULL, 1),
  ('Apertura de caja', 'Datáfono cargado', 'si_no', NULL, NULL, 2),
  ('Apertura de caja', 'Hay cambio suficiente', 'si_no', NULL, NULL, 3),
  ('Cierre de cocina', 'Alimentos rotulados y guardados', 'si_no', NULL, NULL, 1),
  ('Cierre de cocina', 'Freidora y gas apagados', 'si_no', NULL, NULL, 2),
  ('Cierre de cocina', 'Temperatura de la nevera (°C)', 'numero', 0, 4, 3),
  ('Cierre de cocina', 'Superficies y pisos desinfectados', 'si_no', NULL, NULL, 4)
) i(plantilla, texto, tipo, mn, mx, o) ON i.plantilla = p.nombre
WHERE NOT EXISTS (SELECT 1 FROM public.checklist_items);
