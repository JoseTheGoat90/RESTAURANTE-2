-- =====================================================================
-- 004 · Sistema integral: roles, catálogo, porciones, consumos, ventas,
--       pedidos, compras, gastos, caja, reportes y auditoría.
--
-- NO aplicada todavía. Probada en una base local (ver docs/INFORME_IMPLEMENTACION.md).
-- Solo agrega tablas/columnas/datos. Reemplaza funciones manteniendo los
-- parámetros antiguos en el mismo orden (compatibles con n8n y cobrar_pedido).
-- No inventa precios, recetas, cantidades ni existencias: todo lo que el
-- restaurante no ha confirmado queda en 0 / sin precio para que el
-- administrador lo complete.
-- =====================================================================

-- =====================================================================
-- 1. USUARIOS Y ROLES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
  email      TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  rol        TEXT NOT NULL CHECK (rol IN ('admin','cocina','parrilla','mesera','domicilios','domiciliario')),
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public._usuario_actual() RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(LOWER(auth.jwt() ->> 'email'), CASE WHEN auth.role() = 'service_role' THEN 'n8n' END, 'sistema')
$$;

-- Rol del usuario actual. Si el correo está autorizado pero aún no tiene
-- perfil, se trata como administrador (así los administradores actuales
-- siguen funcionando hasta que se les asigne su perfil).
CREATE OR REPLACE FUNCTION public.rol_actual() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol TEXT; v_activo BOOLEAN;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN 'admin'; END IF;
  SELECT rol, activo INTO v_rol, v_activo FROM perfiles WHERE email = LOWER(auth.jwt() ->> 'email');
  IF v_rol IS NOT NULL THEN RETURN CASE WHEN v_activo THEN v_rol END; END IF;
  IF public.es_autorizado() THEN RETURN 'admin'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._exigir_rol(p_roles text[]) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol TEXT := public.rol_actual();
BEGIN
  IF v_rol IS NULL THEN RAISE EXCEPTION 'No autorizado: inicia sesión con una cuenta activa.'; END IF;
  IF NOT (v_rol = 'admin' OR v_rol = ANY (p_roles)) THEN
    RAISE EXCEPTION 'Tu cargo (%) no tiene permiso para esta operación.', v_rol;
  END IF;
END $$;

-- =====================================================================
-- 2. AUDITORÍA
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.auditoria (
  id         BIGSERIAL PRIMARY KEY,
  usuario    TEXT NOT NULL,
  rol        TEXT,
  accion     TEXT NOT NULL,
  entidad    TEXT NOT NULL,
  referencia TEXT,
  detalle    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auditoria_fecha_idx ON public.auditoria(created_at DESC);

CREATE OR REPLACE FUNCTION public._auditar(p_accion text, p_entidad text, p_ref text, p_detalle jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO auditoria (usuario, rol, accion, entidad, referencia, detalle)
  VALUES (_usuario_actual(), rol_actual(), p_accion, p_entidad, p_ref, COALESCE(p_detalle, '{}'::jsonb));
$$;

-- El id anterior ('mov-' + milisegundos) choca cuando una venta genera
-- varios movimientos en el mismo instante.
DO $$
BEGIN
  IF (SELECT is_identity FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name = 'movimientos_inventario' AND column_name = 'id') = 'NO'
     AND (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name = 'movimientos_inventario' AND column_name = 'id') = 'text' THEN
    ALTER TABLE public.movimientos_inventario ALTER COLUMN id SET DEFAULT ('mov-' || gen_random_uuid()::text);
  END IF;
END $$;
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS usuario        TEXT;
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS stock_anterior NUMERIC(12,3);
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS stock_nuevo    NUMERIC(12,3);
ALTER TABLE public.movimientos_inventario ADD COLUMN IF NOT EXISTS tipo           TEXT;
CREATE INDEX IF NOT EXISTS movimientos_ref_idx ON public.movimientos_inventario(referencia);

-- =====================================================================
-- 3. INVENTARIO GENERAL
-- =====================================================================
ALTER TABLE public.ingredientes ADD COLUMN IF NOT EXISTS categoria          TEXT NOT NULL DEFAULT 'otro';
ALTER TABLE public.ingredientes ADD COLUMN IF NOT EXISTS proveedor          TEXT;
ALTER TABLE public.ingredientes ADD COLUMN IF NOT EXISTS ultimo_movimiento  TIMESTAMPTZ;
ALTER TABLE public.ingredientes ADD COLUMN IF NOT EXISTS ultimo_responsable TEXT;
ALTER TABLE public.ingredientes ADD COLUMN IF NOT EXISTS activo             BOOLEAN NOT NULL DEFAULT TRUE;

-- Mueve el stock de un insumo y deja el movimiento completo (antes/después/quién).
-- p_delta negativo = salida. Nunca deja el stock negativo; avisa si faltó.
CREATE OR REPLACE FUNCTION public._mover_stock(p_ingrediente text, p_delta numeric, p_tipo text, p_motivo text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_nuevo NUMERIC; v_rest NUMERIC; v_l RECORD; v_take NUMERIC; v_falto NUMERIC := 0;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN RETURN jsonb_build_object('ok', true); END IF;
  SELECT ingrediente, stock, unidad INTO v FROM ingredientes WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente)) FOR UPDATE;
  IF v.ingrediente IS NULL THEN RETURN jsonb_build_object('ok', false, 'falta', p_ingrediente); END IF;
  v_nuevo := v.stock + p_delta;
  IF v_nuevo < 0 THEN v_falto := -v_nuevo; v_nuevo := 0; END IF;
  UPDATE ingredientes SET stock = v_nuevo, ultimo_movimiento = now(), ultimo_responsable = _usuario_actual() WHERE ingrediente = v.ingrediente;
  IF p_delta < 0 THEN  -- consume lotes por vencimiento (FEFO)
    v_rest := -p_delta;
    FOR v_l IN SELECT id, cantidad_actual FROM lotes WHERE ingrediente = v.ingrediente AND cantidad_actual > 0
               ORDER BY vence_el NULLS LAST, created_at FOR UPDATE LOOP
      EXIT WHEN v_rest <= 0;
      v_take := LEAST(v_rest, v_l.cantidad_actual);
      UPDATE lotes SET cantidad_actual = cantidad_actual - v_take WHERE id = v_l.id;
      v_rest := v_rest - v_take;
    END LOOP;
  END IF;
  INSERT INTO movimientos_inventario (ingrediente, delta, motivo, referencia, created_at, usuario, stock_anterior, stock_nuevo, tipo)
  VALUES (v.ingrediente, p_delta, p_motivo, p_ref, now(), _usuario_actual(), v.stock, v_nuevo, p_tipo);
  RETURN jsonb_build_object('ok', true, 'ingrediente', v.ingrediente, 'faltante', v_falto, 'agotado', v_nuevo = 0, 'unidad', v.unidad);
END $$;

-- Crear o editar un elemento del inventario (no cambia existencias: eso va por movimientos)
CREATE OR REPLACE FUNCTION public.guardar_ingrediente(p_nombre text, p_unidad text, p_minimo numeric, p_categoria text,
  p_costo_unitario numeric DEFAULT NULL, p_proveedor text DEFAULT NULL, p_activo boolean DEFAULT TRUE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nombre TEXT := LOWER(TRIM(p_nombre)); v_existe BOOLEAN;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF COALESCE(v_nombre,'') = '' OR COALESCE(TRIM(p_unidad),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Nombre y unidad son obligatorios.');
  END IF;
  IF COALESCE(p_minimo,0) < 0 OR COALESCE(p_costo_unitario,0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Mínimo y costo no pueden ser negativos.');
  END IF;
  v_existe := EXISTS (SELECT 1 FROM ingredientes WHERE ingrediente = v_nombre);
  INSERT INTO ingredientes (ingrediente, unidad, stock, stock_minimo, categoria, costo_unitario, proveedor, activo)
  VALUES (v_nombre, TRIM(p_unidad), 0, COALESCE(p_minimo,0), COALESCE(NULLIF(p_categoria,''),'otro'), COALESCE(p_costo_unitario,0), p_proveedor, COALESCE(p_activo,TRUE))
  ON CONFLICT (ingrediente) DO UPDATE SET unidad = EXCLUDED.unidad, stock_minimo = EXCLUDED.stock_minimo, categoria = EXCLUDED.categoria,
    costo_unitario = COALESCE(p_costo_unitario, ingredientes.costo_unitario), proveedor = COALESCE(p_proveedor, ingredientes.proveedor),
    activo = EXCLUDED.activo;
  PERFORM _auditar(CASE WHEN v_existe THEN 'editar' ELSE 'crear' END, 'ingrediente', v_nombre,
    jsonb_build_object('unidad', p_unidad, 'minimo', p_minimo, 'categoria', p_categoria, 'costo', p_costo_unitario));
  RETURN jsonb_build_object('ok', true, 'mensaje', CASE WHEN v_existe THEN 'Insumo actualizado.' ELSE 'Insumo "' || v_nombre || '" registrado.' END);
END $$;

-- Compatibilidad: la pantalla de Inventario crea con existencia inicial
DROP FUNCTION IF EXISTS public.crear_ingrediente(text, text, numeric, numeric);
CREATE OR REPLACE FUNCTION public.crear_ingrediente(p_nombre text, p_unidad text, p_stock numeric, p_minimo numeric, p_categoria text DEFAULT 'otro')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nombre TEXT := LOWER(TRIM(p_nombre)); v_res JSONB;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF EXISTS (SELECT 1 FROM ingredientes WHERE ingrediente = v_nombre) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Ya existe "' || v_nombre || '". Registra una entrada o un ajuste.');
  END IF;
  IF COALESCE(p_stock,0) < 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La existencia inicial no puede ser negativa.'); END IF;
  v_res := guardar_ingrediente(p_nombre, p_unidad, p_minimo, p_categoria);
  IF NOT (v_res->>'ok')::boolean THEN RETURN v_res; END IF;
  PERFORM _mover_stock(v_nombre, p_stock, 'inicial', 'Existencia inicial', 'ALTA');
  RETURN v_res;
END $$;

-- Entrada / salida / ajuste manual (motivo obligatorio)
CREATE OR REPLACE FUNCTION public.ajustar_inventario(p_ingrediente text, p_delta numeric, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res JSONB;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF COALESCE(TRIM(p_motivo),'') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El motivo es obligatorio.'); END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La cantidad no puede ser cero.'); END IF;
  IF p_delta < 0 AND (SELECT stock FROM ingredientes WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente))) + p_delta < 0 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'La salida dejaría el inventario en negativo. Revisa la cantidad.');
  END IF;
  v_res := _mover_stock(p_ingrediente, p_delta, CASE WHEN p_delta > 0 THEN 'entrada' ELSE 'salida' END, p_motivo, 'AJUSTE');
  IF NOT (v_res->>'ok')::boolean THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El insumo no existe.'); END IF;
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Inventario de ' || (v_res->>'ingrediente') || ' ajustado (' ||
    CASE WHEN p_delta > 0 THEN '+' ELSE '' END || p_delta || ').' ||
    CASE WHEN (v_res->>'agotado')::boolean THEN ' Quedó AGOTADO.' ELSE '' END);
END $$;

-- Faltantes reportados por cocina/parrilla (no mueve stock; avisa a administración)
CREATE TABLE IF NOT EXISTS public.reportes_faltantes (
  id          BIGSERIAL PRIMARY KEY,
  item        TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'faltante' CHECK (tipo IN ('faltante','agotado','dañado')),
  cantidad    NUMERIC(12,3),
  nota        TEXT,
  reportado_por TEXT NOT NULL,
  atendido    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.reportar_faltante(p_item text, p_tipo text DEFAULT 'faltante', p_cantidad numeric DEFAULT NULL, p_nota text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _exigir_rol(ARRAY['cocina','parrilla','mesera','domicilios']);
  IF COALESCE(TRIM(p_item),'') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Indica el producto.'); END IF;
  INSERT INTO reportes_faltantes (item, tipo, cantidad, nota, reportado_por) VALUES (LOWER(TRIM(p_item)), COALESCE(p_tipo,'faltante'), p_cantidad, p_nota, _usuario_actual());
  PERFORM _auditar('reportar_faltante', 'inventario', p_item, jsonb_build_object('tipo', p_tipo, 'cantidad', p_cantidad, 'nota', p_nota));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Faltante reportado a administración.');
END $$;

-- =====================================================================
-- 4. INVENTARIO DE PORCIONES (asados y ejecutivos) · Total = Existente + Entradas − Ventas
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.inventario_porciones (
  item        TEXT PRIMARY KEY,
  grupo       TEXT NOT NULL DEFAULT 'asado' CHECK (grupo IN ('asado','ejecutivo','otro')),
  existente   NUMERIC(12,2) NOT NULL DEFAULT 0,
  entradas    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ventas      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) GENERATED ALWAYS AS (existente + entradas - ventas) STORED,
  minimo      NUMERIC(12,2) NOT NULL DEFAULT 0,
  periodo_desde DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.movimientos_porciones (
  id             BIGSERIAL PRIMARY KEY,
  item           TEXT NOT NULL REFERENCES public.inventario_porciones(item) ON UPDATE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('existente','entrada','venta','reversion','ajuste','cierre')),
  cantidad       NUMERIC(12,2) NOT NULL,
  total_anterior NUMERIC(12,2),
  total_nuevo    NUMERIC(12,2),
  motivo         TEXT,
  referencia     TEXT,
  usuario        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mov_porciones_item_idx ON public.movimientos_porciones(item, created_at DESC);
CREATE INDEX IF NOT EXISTS mov_porciones_ref_idx ON public.movimientos_porciones(referencia);

-- Movimiento interno de porciones. tipo: existente (fija el existente), entrada, venta, reversion (devuelve una venta), ajuste (±, corrige existente)
CREATE OR REPLACE FUNCTION public._mover_porciones(p_item text, p_tipo text, p_cant numeric, p_motivo text, p_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_nuevo NUMERIC;
BEGIN
  SELECT * INTO v FROM inventario_porciones WHERE LOWER(TRIM(item)) = LOWER(TRIM(p_item)) FOR UPDATE;
  IF v.item IS NULL THEN RETURN jsonb_build_object('ok', false, 'falta', p_item); END IF;
  IF p_tipo = 'existente' THEN UPDATE inventario_porciones SET existente = p_cant, actualizado_en = now() WHERE item = v.item;
  ELSIF p_tipo = 'entrada' THEN UPDATE inventario_porciones SET entradas = entradas + p_cant, actualizado_en = now() WHERE item = v.item;
  ELSIF p_tipo = 'venta' THEN UPDATE inventario_porciones SET ventas = ventas + p_cant, actualizado_en = now() WHERE item = v.item;
  ELSIF p_tipo = 'reversion' THEN UPDATE inventario_porciones SET ventas = ventas - p_cant, actualizado_en = now() WHERE item = v.item;
  ELSIF p_tipo = 'ajuste' THEN UPDATE inventario_porciones SET existente = existente + p_cant, actualizado_en = now() WHERE item = v.item;
  END IF;
  SELECT total INTO v_nuevo FROM inventario_porciones WHERE item = v.item;
  INSERT INTO movimientos_porciones (item, tipo, cantidad, total_anterior, total_nuevo, motivo, referencia, usuario)
  VALUES (v.item, p_tipo, p_cant, v.total, v_nuevo, p_motivo, p_ref, _usuario_actual());
  RETURN jsonb_build_object('ok', true, 'item', v.item, 'total', v_nuevo, 'agotado', v_nuevo <= 0);
END $$;

-- Existente / entrada / ajuste desde la pantalla (solo administración)
CREATE OR REPLACE FUNCTION public.registrar_porciones(p_item text, p_tipo text, p_cantidad numeric, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res JSONB;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF p_tipo NOT IN ('existente','entrada','ajuste') THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Tipo no válido.'); END IF;
  IF p_cantidad IS NULL OR (p_tipo <> 'ajuste' AND p_cantidad < 0) OR (p_tipo = 'entrada' AND p_cantidad = 0) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Cantidad no válida.');
  END IF;
  IF p_tipo = 'ajuste' AND COALESCE(TRIM(p_motivo),'') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El ajuste necesita motivo.'); END IF;
  v_res := _mover_porciones(p_item, p_tipo, p_cantidad, COALESCE(p_motivo, initcap(p_tipo)), UPPER(p_tipo));
  IF NOT (v_res->>'ok')::boolean THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Producto de porciones no existe.'); END IF;
  RETURN jsonb_build_object('ok', true, 'total', v_res->'total', 'mensaje', (v_res->>'item') || ': ' || (v_res->>'total') || ' porciones disponibles.');
END $$;

CREATE OR REPLACE FUNCTION public.guardar_item_porciones(p_item text, p_grupo text DEFAULT 'asado', p_minimo numeric DEFAULT 0, p_activo boolean DEFAULT TRUE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF COALESCE(TRIM(p_item),'') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta el nombre.'); END IF;
  INSERT INTO inventario_porciones (item, grupo, minimo, activo) VALUES (LOWER(TRIM(p_item)), p_grupo, COALESCE(p_minimo,0), COALESCE(p_activo,TRUE))
  ON CONFLICT (item) DO UPDATE SET grupo = EXCLUDED.grupo, minimo = EXCLUDED.minimo, activo = EXCLUDED.activo;
  PERFORM _auditar('guardar', 'porciones', p_item, jsonb_build_object('grupo', p_grupo, 'minimo', p_minimo));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Producto de porciones guardado.');
END $$;

-- Cierre de periodo: el total pasa a ser el existente del siguiente periodo
CREATE OR REPLACE FUNCTION public.cerrar_periodo_porciones()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_n INT := 0;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  FOR v IN SELECT * FROM inventario_porciones FOR UPDATE LOOP
    INSERT INTO movimientos_porciones (item, tipo, cantidad, total_anterior, total_nuevo, motivo, referencia, usuario)
    VALUES (v.item, 'cierre', v.total, v.total, v.total, 'Cierre de periodo (existente ' || v.existente || ' + entradas ' || v.entradas || ' − ventas ' || v.ventas || ')', 'CIERRE', _usuario_actual());
    UPDATE inventario_porciones SET existente = v.total, entradas = 0, ventas = 0, periodo_desde = (now() AT TIME ZONE 'America/Bogota')::date WHERE item = v.item;
    v_n := v_n + 1;
  END LOOP;
  PERFORM _auditar('cerrar_periodo', 'porciones', NULL, jsonb_build_object('items', v_n));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Periodo cerrado para ' || v_n || ' productos.');
END $$;

-- =====================================================================
-- 5. CATÁLOGO DE PRODUCTOS (precios por modalidad / presentación)
-- =====================================================================
ALTER TABLE public.productos ALTER COLUMN precio DROP NOT NULL;
ALTER TABLE public.productos ALTER COLUMN precio DROP DEFAULT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS categoria     TEXT NOT NULL DEFAULT 'almuerzos';
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS presentacion  TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS unidad        TEXT;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_llevar NUMERIC(12,2);   -- almuerzos: para llevar / domicilio
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_media  NUMERIC(12,2);   -- asados: porción media
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS disponible    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS estacion      TEXT NOT NULL DEFAULT 'cocina';
-- El precio de las recetas solo se sincroniza cuando el producto tiene precio
CREATE OR REPLACE FUNCTION public.tg_producto_sync() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nombre <> OLD.nombre THEN
    UPDATE public.recetas SET plato = NEW.nombre WHERE LOWER(TRIM(plato)) = LOWER(TRIM(OLD.nombre));
  END IF;
  IF NEW.precio IS NOT NULL THEN
    UPDATE public.recetas SET precio = NEW.precio WHERE LOWER(TRIM(plato)) = LOWER(TRIM(NEW.nombre));
  END IF;
  RETURN NEW;
END $$;
-- precio = mesa (almuerzos) / porción entera (asados) / precio único (bebidas)

CREATE OR REPLACE FUNCTION public.guardar_producto(p_nombre text, p_categoria text, p_precio numeric,
  p_precio_llevar numeric DEFAULT NULL, p_precio_media numeric DEFAULT NULL, p_presentacion text DEFAULT NULL,
  p_unidad text DEFAULT NULL, p_disponible boolean DEFAULT TRUE, p_activo boolean DEFAULT TRUE, p_estacion text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nombre TEXT := LOWER(TRIM(p_nombre)); v_antes RECORD;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF COALESCE(v_nombre,'') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta el nombre.'); END IF;
  IF LEAST(COALESCE(p_precio,0), COALESCE(p_precio_llevar,0), COALESCE(p_precio_media,0)) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Los precios no pueden ser negativos.');
  END IF;
  SELECT precio, precio_llevar, precio_media INTO v_antes FROM productos WHERE nombre = v_nombre;
  INSERT INTO productos (nombre, categoria, precio, precio_llevar, precio_media, presentacion, unidad, disponible, activo, estacion)
  VALUES (v_nombre, COALESCE(NULLIF(p_categoria,''),'almuerzos'), p_precio, p_precio_llevar, p_precio_media, p_presentacion, p_unidad,
          COALESCE(p_disponible,TRUE), COALESCE(p_activo,TRUE),
          COALESCE(p_estacion, CASE p_categoria WHEN 'asados' THEN 'parrilla' WHEN 'bebidas' THEN 'bar' ELSE 'cocina' END))
  ON CONFLICT (nombre) DO UPDATE SET categoria = EXCLUDED.categoria, precio = EXCLUDED.precio, precio_llevar = EXCLUDED.precio_llevar,
    precio_media = EXCLUDED.precio_media, presentacion = EXCLUDED.presentacion, unidad = EXCLUDED.unidad,
    disponible = EXCLUDED.disponible, activo = EXCLUDED.activo, estacion = EXCLUDED.estacion;
  PERFORM _auditar('guardar', 'producto', v_nombre, jsonb_build_object('antes', to_jsonb(v_antes),
    'precio', p_precio, 'precio_llevar', p_precio_llevar, 'precio_media', p_precio_media, 'activo', p_activo));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Producto "' || v_nombre || '" guardado.');
END $$;

-- =====================================================================
-- 6. CONSUMOS (recetas configurables): qué descuenta cada venta
--    variante NULL = siempre; 'media'/'entera' = presentación del asado;
--    'mesa'/'para_llevar'/'domicilio' = modalidad (p. ej. desechables)
--    tipo 'porcion' descuenta del inventario de porciones; 'ingrediente' del general.
--    Un mismo consumo no puede estar en los dos inventarios (evita doble descuento).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.consumos_producto (
  id        BIGSERIAL PRIMARY KEY,
  producto  TEXT NOT NULL REFERENCES public.productos(nombre) ON UPDATE CASCADE ON DELETE CASCADE,
  variante  TEXT CHECK (variante IN ('media','entera','mesa','para_llevar','domicilio')),
  tipo      TEXT NOT NULL CHECK (tipo IN ('porcion','ingrediente')),
  item      TEXT NOT NULL,
  cantidad  NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  UNIQUE NULLS NOT DISTINCT (producto, variante, item)
);

CREATE OR REPLACE FUNCTION public.guardar_consumo(p_producto text, p_variante text, p_tipo text, p_item text, p_cantidad numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item TEXT := LOWER(TRIM(p_item)); v_prod TEXT := LOWER(TRIM(p_producto)); v_var TEXT := NULLIF(p_variante,'');
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF NOT EXISTS (SELECT 1 FROM productos WHERE nombre = v_prod) THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El producto no existe.'); END IF;
  IF p_tipo = 'porcion' AND NOT EXISTS (SELECT 1 FROM inventario_porciones WHERE item = v_item) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', '"' || v_item || '" no está en el inventario de porciones.');
  END IF;
  IF p_tipo = 'ingrediente' AND NOT EXISTS (SELECT 1 FROM ingredientes WHERE ingrediente = v_item) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', '"' || v_item || '" no está en el inventario general.');
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN  -- cantidad 0 = quitar
    DELETE FROM consumos_producto WHERE producto = v_prod AND variante IS NOT DISTINCT FROM v_var AND item = v_item;
    PERFORM _auditar('quitar', 'consumo', v_prod, jsonb_build_object('variante', v_var, 'item', v_item));
    RETURN jsonb_build_object('ok', true, 'mensaje', 'Consumo eliminado.');
  END IF;
  INSERT INTO consumos_producto (producto, variante, tipo, item, cantidad) VALUES (v_prod, v_var, p_tipo, v_item, p_cantidad)
  ON CONFLICT (producto, variante, item) DO UPDATE SET cantidad = EXCLUDED.cantidad, tipo = EXCLUDED.tipo;
  PERFORM _auditar('guardar', 'consumo', v_prod, jsonb_build_object('variante', v_var, 'tipo', p_tipo, 'item', v_item, 'cantidad', p_cantidad));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Consumo guardado.');
END $$;

-- =====================================================================
-- 7. VENTAS Y PEDIDOS
-- =====================================================================
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS categoria       TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(12,2);
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS tipo_pedido     TEXT NOT NULL DEFAULT 'mesa';
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS mesa            TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS tamano_porcion  TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS acompanamiento  TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS con_ensalada    BOOLEAN;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS con_salsas      BOOLEAN;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS cliente         TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS direccion_domicilio TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS telefono_contacto   TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS notas           TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS metodo_pago     TEXT NOT NULL DEFAULT 'efectivo';
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS pago_estado     TEXT NOT NULL DEFAULT 'pagado';
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS pagado_en       TIMESTAMPTZ;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS caja_id         BIGINT REFERENCES public.cajas(id);
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS registrado_por  TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS cobrado_por     TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS domiciliario    TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS estacion        TEXT;
ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS actualizado_en  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ventas_fecha_idx ON public.ventas(fecha);
CREATE INDEX IF NOT EXISTS ventas_caja_idx ON public.ventas(caja_id);
CREATE INDEX IF NOT EXISTS ventas_estado_idx ON public.ventas(estado);
-- Ventas anteriores a esta migración: estaban cobradas
UPDATE public.ventas SET pago_estado = 'pagado', precio_unitario = COALESCE(precio_unitario, total / NULLIF(cantidad,0)) WHERE pagado_en IS NULL AND pago_estado = 'pagado';

CREATE UNIQUE INDEX IF NOT EXISTS una_caja_abierta ON public.cajas ((estado)) WHERE estado = 'abierta';

CREATE OR REPLACE FUNCTION public._caja_abierta() RETURNS bigint LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM cajas WHERE estado = 'abierta' ORDER BY abierta_en DESC LIMIT 1
$$;

-- Registrar venta / pedido.
--  p_estado: 'pagado' (venta de mostrador cobrada) o estado de preparación ('nuevo','en_cocina').
--  El ingreso solo cuenta cuando pago_estado = 'pagado'.
DROP FUNCTION IF EXISTS public.registrar_venta(text, text, integer, text);
CREATE OR REPLACE FUNCTION public.registrar_venta(
  p_id text, p_plato text, p_cantidad integer, p_estado text DEFAULT 'pagado',
  p_tipo_pedido text DEFAULT 'mesa', p_mesa text DEFAULT NULL, p_tamano_porcion text DEFAULT NULL,
  p_acompanamiento text DEFAULT NULL, p_con_ensalada boolean DEFAULT NULL, p_con_salsas boolean DEFAULT NULL,
  p_direccion text DEFAULT NULL, p_telefono text DEFAULT NULL, p_metodo_pago text DEFAULT 'efectivo',
  p_cliente text DEFAULT NULL, p_notas text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p RECORD; v_precio NUMERIC; v_c RECORD; v_r JSONB; v_alertas TEXT[] := '{}'; v_sin_config BOOLEAN := FALSE;
  v_tipo TEXT := COALESCE(NULLIF(p_tipo_pedido, ''), 'mesa');
  v_estado TEXT := COALESCE(NULLIF(p_estado, ''), 'pagado');
  v_pagado BOOLEAN; v_prep TEXT; v_caja BIGINT; v_motivo TEXT; v_plato TEXT := LOWER(TRIM(p_plato));
  v_pres TEXT;
BEGIN
  PERFORM _exigir_rol(ARRAY['mesera','domicilios']);
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La cantidad debe ser mayor a cero.'); END IF;
  IF v_tipo = 'llevar' THEN v_tipo := 'para_llevar'; END IF;
  IF v_tipo NOT IN ('mesa','domicilio','para_llevar') THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Modalidad no válida.'); END IF;
  IF v_estado NOT IN ('pagado','nuevo','en_cocina') THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Estado inicial no válido.'); END IF;
  IF v_tipo = 'domicilio' AND COALESCE(TRIM(p_direccion),'') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El domicilio necesita dirección.'); END IF;
  v_pagado := v_estado = 'pagado';
  IF v_pagado AND rol_actual() NOT IN ('admin') THEN
    -- solo caja cobra; meseras y domicilios envían el pedido a preparación
    v_pagado := FALSE; v_estado := 'nuevo';
  END IF;
  v_prep := CASE WHEN v_pagado THEN 'entregado' ELSE v_estado END;

  SELECT * INTO v_p FROM productos WHERE nombre = v_plato AND activo;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El producto "' || p_plato || '" no existe o está inactivo.'); END IF;
  IF NOT v_p.disponible THEN RETURN jsonb_build_object('ok', false, 'mensaje', '"' || v_p.nombre || '" no está disponible ahora.'); END IF;

  -- Precio decidido en el servidor
  IF v_p.categoria = 'asados' THEN
    v_pres := COALESCE(NULLIF(p_tamano_porcion,''), 'entera');
    IF v_pres NOT IN ('media','entera') THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Presentación no válida.'); END IF;
    v_precio := CASE WHEN v_pres = 'media' THEN v_p.precio_media ELSE v_p.precio END;
  ELSIF v_tipo IN ('para_llevar','domicilio') AND v_p.precio_llevar IS NOT NULL THEN
    v_precio := v_p.precio_llevar;
  ELSE
    v_precio := v_p.precio;
  END IF;
  IF v_precio IS NULL OR v_precio <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', '"' || v_p.nombre || '" no tiene precio configurado' ||
      CASE WHEN v_pres IS NOT NULL THEN ' para porción ' || v_pres ELSE '' END || '. Pide a administración que lo configure.');
  END IF;

  v_caja := CASE WHEN v_pagado THEN _caja_abierta() END;

  INSERT INTO ventas (id_operacion, fecha, plato, categoria, cantidad, precio_unitario, total, estado, tipo_pedido, mesa, tamano_porcion,
                      acompanamiento, con_ensalada, con_salsas, cliente, direccion_domicilio, telefono_contacto, notas,
                      metodo_pago, pago_estado, pagado_en, caja_id, registrado_por, cobrado_por, estacion, created_at, actualizado_en)
  VALUES (p_id, (now() AT TIME ZONE 'America/Bogota')::date, v_p.nombre, v_p.categoria, p_cantidad, v_precio, v_precio * p_cantidad,
          v_prep, v_tipo, p_mesa, v_pres, p_acompanamiento, p_con_ensalada, p_con_salsas, p_cliente, p_direccion, p_telefono, p_notas,
          COALESCE(NULLIF(p_metodo_pago,''),'efectivo'), CASE WHEN v_pagado THEN 'pagado' ELSE 'pendiente' END,
          CASE WHEN v_pagado THEN now() END, v_caja, _usuario_actual(), CASE WHEN v_pagado THEN _usuario_actual() END,
          v_p.estacion, now(), now())
  ON CONFLICT (id_operacion) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'duplicada', true, 'mensaje', 'Esta venta ya estaba registrada (no se duplicó).'); END IF;

  -- Descuentos configurados
  v_motivo := 'Venta ' || p_cantidad || 'x ' || v_p.nombre || COALESCE(' (' || v_pres || ')', '') || ' · ' || replace(v_tipo, '_', ' ');
  FOR v_c IN SELECT * FROM consumos_producto WHERE producto = v_p.nombre
               AND (variante IS NULL OR variante = v_pres OR variante = v_tipo) LOOP
    IF v_c.tipo = 'porcion' THEN
      v_r := _mover_porciones(v_c.item, 'venta', v_c.cantidad * p_cantidad, v_motivo, p_id);
      IF (v_r->>'ok')::boolean AND (v_r->>'total')::numeric < 0 THEN
        v_alertas := v_alertas || (v_c.item || ' quedó en ' || (v_r->>'total') || ' porciones');
      ELSIF (v_r->>'ok')::boolean AND (v_r->>'agotado')::boolean THEN
        v_alertas := v_alertas || (v_c.item || ' AGOTADO');
      END IF;
    ELSE
      v_r := _mover_stock(v_c.item, -(v_c.cantidad * p_cantidad), 'venta', v_motivo, p_id);
      IF (v_r->>'faltante')::numeric > 0 THEN v_alertas := v_alertas || (v_c.item || ': faltaron ' || (v_r->>'faltante') || ' ' || (v_r->>'unidad'));
      ELSIF (v_r->>'agotado')::boolean THEN v_alertas := v_alertas || (v_c.item || ' AGOTADO'); END IF;
    END IF;
  END LOOP;
  IF NOT FOUND THEN v_sin_config := TRUE; END IF;

  PERFORM _auditar('registrar', 'venta', p_id, jsonb_build_object('producto', v_p.nombre, 'cantidad', p_cantidad, 'total', v_precio * p_cantidad,
    'modalidad', v_tipo, 'presentacion', v_pres, 'pagado', v_pagado));

  RETURN jsonb_build_object('ok', true, 'total', v_precio * p_cantidad, 'precio_unitario', v_precio, 'alertas', to_jsonb(v_alertas),
    'mensaje', CASE WHEN v_pagado THEN 'Venta registrada: ' ELSE 'Pedido enviado a preparación: ' END ||
      p_cantidad || 'x ' || v_p.nombre || COALESCE(' (' || v_pres || ')', '') || ' = $' || to_char(v_precio * p_cantidad, 'FM999G999G999') ||
      CASE WHEN v_pagado AND v_caja IS NULL THEN '. Ojo: no hay caja abierta.' ELSE '.' END ||
      CASE WHEN v_sin_config THEN ' (Sin consumos configurados: no se descontó inventario.)' ELSE '' END ||
      CASE WHEN array_length(v_alertas,1) > 0 THEN ' Alerta: ' || array_to_string(v_alertas, '; ') || '.' ELSE '' END);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'mensaje', SQLERRM);
END $$;

-- Cambiar estado del pedido y/o cobrarlo. Reglas por cargo:
--   cocina/parrilla: en_cocina → listo · domiciliario: solo sus domicilios, en_camino → entregado
--   mesera/domicilios: entregado (mesa) · admin: todo, incluido cobrar y cancelar pagados
-- Cancelar antes de preparación revierte el inventario; después, no (queda como pérdida).
CREATE OR REPLACE FUNCTION public.actualizar_estado_venta(p_id text, p_estado text, p_metodo_pago text DEFAULT NULL, p_motivo text DEFAULT NULL,
  p_devolver_inventario boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_rol TEXT := rol_actual(); v_m RECORD; v_revertido BOOLEAN := FALSE; v_caja BIGINT;
BEGIN
  PERFORM _exigir_rol(ARRAY['cocina','parrilla','mesera','domicilios','domiciliario']);
  SELECT * INTO v FROM ventas WHERE id_operacion = p_id FOR UPDATE;
  IF v.id_operacion IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Pedido no encontrado.'); END IF;
  IF v.estado = 'cancelado' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El pedido ya está cancelado.'); END IF;
  IF p_estado NOT IN ('nuevo','en_cocina','listo','en_camino','entregado','pagado','cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Estado no válido.');
  END IF;

  IF v_rol IN ('cocina','parrilla') AND p_estado NOT IN ('en_cocina','listo') THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Cocina y parrilla solo marcan "en preparación" o "listo".');
  END IF;
  IF v_rol = 'domiciliario' AND (v.domiciliario IS DISTINCT FROM _usuario_actual() OR p_estado NOT IN ('en_camino','entregado')) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Solo puedes actualizar la entrega de tus domicilios asignados.');
  END IF;
  IF v_rol IN ('mesera','domicilios') AND p_estado NOT IN ('en_cocina','listo','en_camino','entregado','cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Solo caja puede registrar el cobro.');
  END IF;
  IF p_estado = 'cancelado' THEN
    IF v.pago_estado = 'pagado' AND v_rol <> 'admin' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Solo administración puede anular una venta cobrada.'); END IF;
    IF v_rol <> 'admin' AND v.estado NOT IN ('nuevo') THEN
      RETURN jsonb_build_object('ok', false, 'mensaje', 'El pedido ya está en preparación: solo administración puede cancelarlo.');
    END IF;
    IF COALESCE(TRIM(p_motivo),'') = '' AND v_rol <> 'admin' THEN p_motivo := 'Cancelado antes de preparar'; END IF;
    -- Sin preparar: se devuelve lo descontado. Administración puede indicarlo
    -- explícitamente (p. ej. venta registrada por error) con p_devolver_inventario.
    IF COALESCE(CASE WHEN v_rol = 'admin' THEN p_devolver_inventario END, v.estado = 'nuevo') THEN
      FOR v_m IN SELECT * FROM movimientos_inventario WHERE referencia = p_id AND delta < 0 LOOP
        PERFORM _mover_stock(v_m.ingrediente, -v_m.delta, 'reversion', 'Reversión: pedido ' || p_id || ' cancelado', p_id || '-REV');
      END LOOP;
      FOR v_m IN SELECT * FROM movimientos_porciones WHERE referencia = p_id AND tipo = 'venta' LOOP
        PERFORM _mover_porciones(v_m.item, 'reversion', v_m.cantidad, 'Reversión: pedido ' || p_id || ' cancelado', p_id || '-REV');
      END LOOP;
      v_revertido := TRUE;
    END IF;
    UPDATE ventas SET estado = 'cancelado', pago_estado = CASE WHEN pago_estado = 'pagado' THEN 'anulado' ELSE 'cancelado' END,
      notas = TRIM(COALESCE(notas,'') || ' · Cancelado: ' || COALESCE(p_motivo,'sin motivo')), actualizado_en = now() WHERE id_operacion = p_id;
    PERFORM _auditar('cancelar', 'venta', p_id, jsonb_build_object('estado_previo', v.estado, 'pago_previo', v.pago_estado,
      'inventario_revertido', v_revertido, 'motivo', p_motivo));
    RETURN jsonb_build_object('ok', true, 'mensaje', 'Pedido cancelado. ' ||
      CASE WHEN v_revertido THEN 'Se devolvió el inventario descontado.' ELSE 'Ya estaba en preparación: el inventario consumido se mantiene como pérdida.' END);
  END IF;

  IF p_estado = 'pagado' THEN
    IF v_rol <> 'admin' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Solo caja puede registrar el cobro.'); END IF;
    IF v.pago_estado = 'pagado' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Este pedido ya estaba cobrado (no se duplica el ingreso).'); END IF;
    v_caja := _caja_abierta();
    UPDATE ventas SET pago_estado = 'pagado', pagado_en = now(), cobrado_por = _usuario_actual(),
      metodo_pago = COALESCE(NULLIF(p_metodo_pago,''), metodo_pago), caja_id = v_caja,
      estado = CASE WHEN estado IN ('nuevo','en_cocina','listo','en_camino') THEN estado ELSE 'entregado' END, actualizado_en = now()
     WHERE id_operacion = p_id;
    PERFORM _auditar('cobrar', 'venta', p_id, jsonb_build_object('total', v.total, 'metodo', COALESCE(p_metodo_pago, v.metodo_pago)));
    RETURN jsonb_build_object('ok', true, 'mensaje', 'Cobro registrado ($' || to_char(v.total, 'FM999G999G999') || ').' ||
      CASE WHEN v_caja IS NULL THEN ' Ojo: no hay caja abierta.' ELSE '' END);
  END IF;

  UPDATE ventas SET estado = p_estado, actualizado_en = now() WHERE id_operacion = p_id;
  PERFORM _auditar('estado', 'venta', p_id, jsonb_build_object('de', v.estado, 'a', p_estado));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Pedido actualizado a "' || replace(p_estado, '_', ' ') || '".');
END $$;

CREATE OR REPLACE FUNCTION public.asignar_domiciliario(p_id text, p_domiciliario text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email TEXT := LOWER(TRIM(p_domiciliario));
BEGIN
  PERFORM _exigir_rol(ARRAY['domicilios']);
  IF NOT EXISTS (SELECT 1 FROM perfiles WHERE email = v_email AND rol = 'domiciliario' AND activo) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Ese domiciliario no existe o está inactivo.');
  END IF;
  UPDATE ventas SET domiciliario = v_email, actualizado_en = now() WHERE id_operacion = p_id AND tipo_pedido = 'domicilio' AND estado <> 'cancelado';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Domicilio no encontrado.'); END IF;
  PERFORM _auditar('asignar', 'domicilio', p_id, jsonb_build_object('domiciliario', v_email));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Domiciliario asignado.');
END $$;

-- Pedidos visibles según cargo (cocina ve cocina, parrilla ve asados, domiciliario sus entregas)
CREATE OR REPLACE FUNCTION public.consultar_pedidos(p_estado text DEFAULT NULL, p_limite int DEFAULT 100)
RETURNS SETOF public.ventas LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol TEXT := rol_actual();
BEGIN
  PERFORM _exigir_rol(ARRAY['cocina','parrilla','mesera','domicilios','domiciliario']);
  RETURN QUERY SELECT * FROM ventas v
   WHERE (p_estado IS NULL OR v.estado = p_estado)
     AND (v_rol <> 'parrilla' OR v.estacion = 'parrilla')
     AND (v_rol <> 'cocina' OR v.estacion = 'cocina')
     AND (v_rol <> 'domiciliario' OR v.domiciliario = _usuario_actual())
     AND (v_rol <> 'domicilios' OR v.tipo_pedido = 'domicilio')
     AND (v_rol = 'admin' OR v.created_at > now() - interval '2 days')
   ORDER BY v.created_at DESC LIMIT LEAST(COALESCE(p_limite,100), 500);
END $$;

-- =====================================================================
-- 8. GASTOS
-- =====================================================================
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS metodo_pago TEXT NOT NULL DEFAULT 'efectivo';
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS responsable TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS estado      TEXT NOT NULL DEFAULT 'pagado';
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS periodo     TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS soporte_url TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS caja_id     BIGINT REFERENCES public.cajas(id);
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS compra_id   TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS pagado_en   TIMESTAMPTZ;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS anulado     BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS gastos_fecha_idx ON public.gastos(fecha);
CREATE UNIQUE INDEX IF NOT EXISTS gastos_compra_unico ON public.gastos(compra_id) WHERE compra_id IS NOT NULL;
ALTER TABLE public.conceptos_gasto ADD COLUMN IF NOT EXISTS recurrente BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.conceptos_gasto DROP CONSTRAINT IF EXISTS conceptos_gasto_categoria_check;
ALTER TABLE public.conceptos_gasto ADD CONSTRAINT conceptos_gasto_categoria_check CHECK (categoria IN
  ('servicios','seguridad','compras','ingredientes','insumos','nomina','aseo','mantenimiento','transporte','reparaciones','otros'));

DROP FUNCTION IF EXISTS public.registrar_gasto(text, text, text, numeric);
CREATE OR REPLACE FUNCTION public.registrar_gasto(
  p_id text, p_concepto text, p_categoria text, p_valor numeric,
  p_metodo_pago text DEFAULT 'efectivo', p_responsable text DEFAULT NULL,
  p_estado text DEFAULT 'pagado', p_periodo text DEFAULT NULL, p_soporte_url text DEFAULT NULL, p_fecha date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caja BIGINT; v_concepto TEXT := LOWER(TRIM(p_concepto)); v_pagado BOOLEAN := COALESCE(p_estado,'pagado') = 'pagado';
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF p_valor IS NULL OR p_valor <= 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El valor debe ser mayor a cero.'); END IF;
  IF COALESCE(v_concepto,'') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Falta la descripción del gasto.'); END IF;
  IF COALESCE(p_estado,'pagado') NOT IN ('pagado','pendiente') THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Estado no válido.'); END IF;
  IF v_pagado AND COALESCE(p_metodo_pago,'efectivo') = 'efectivo' THEN v_caja := _caja_abierta(); END IF;
  INSERT INTO conceptos_gasto (nombre, categoria) VALUES (v_concepto, p_categoria) ON CONFLICT DO NOTHING;
  INSERT INTO gastos (id_operacion, fecha, concepto, categoria, valor, metodo_pago, responsable, estado, periodo, soporte_url, caja_id, pagado_en, created_at)
  VALUES (p_id, COALESCE(p_fecha, (now() AT TIME ZONE 'America/Bogota')::date), v_concepto, p_categoria, p_valor,
          COALESCE(NULLIF(p_metodo_pago,''),'efectivo'), COALESCE(NULLIF(p_responsable,''), _usuario_actual()),
          COALESCE(p_estado,'pagado'), p_periodo, p_soporte_url, v_caja, CASE WHEN v_pagado THEN now() END, now())
  ON CONFLICT (id_operacion) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'duplicada', true, 'mensaje', 'Este gasto ya estaba registrado (no se duplicó).'); END IF;
  PERFORM _auditar('registrar', 'gasto', p_id, jsonb_build_object('concepto', v_concepto, 'categoria', p_categoria, 'valor', p_valor, 'estado', p_estado));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Gasto registrado: ' || v_concepto || ' $' || to_char(p_valor, 'FM999G999G999') ||
    CASE WHEN NOT v_pagado THEN ' (pendiente de pago).' WHEN v_caja IS NOT NULL THEN ' (sale de la caja).' ELSE '.' END);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'mensaje', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.marcar_gasto_pagado(p_id text, p_metodo_pago text DEFAULT 'efectivo')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caja BIGINT;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF COALESCE(p_metodo_pago,'efectivo') = 'efectivo' THEN v_caja := _caja_abierta(); END IF;
  UPDATE gastos SET estado = 'pagado', pagado_en = now(), metodo_pago = COALESCE(NULLIF(p_metodo_pago,''), metodo_pago), caja_id = COALESCE(caja_id, v_caja)
   WHERE id_operacion = p_id AND estado = 'pendiente';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Gasto no encontrado o ya pagado.'); END IF;
  PERFORM _auditar('pagar', 'gasto', p_id, jsonb_build_object('metodo', p_metodo_pago));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Gasto marcado como pagado.');
END $$;

-- =====================================================================
-- 9. COMPRAS (una compra = un gasto + una entrada, enlazados por el mismo id)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.compras (
  id             TEXT PRIMARY KEY,
  fecha          DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
  inventario     TEXT NOT NULL CHECK (inventario IN ('general','porciones')),
  item           TEXT NOT NULL,
  cantidad       NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  unidad         TEXT,
  costo_unitario NUMERIC(14,4) NOT NULL,
  total          NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  proveedor      TEXT,
  metodo_pago    TEXT NOT NULL DEFAULT 'efectivo',
  estado_pago    TEXT NOT NULL DEFAULT 'pagado' CHECK (estado_pago IN ('pagado','pendiente')),
  responsable    TEXT NOT NULL,
  soporte_url    TEXT,
  vence_el       DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP FUNCTION IF EXISTS public.registrar_compra(text, numeric, numeric, text, text, date);
CREATE OR REPLACE FUNCTION public.registrar_compra(
  p_ingrediente text, p_cantidad numeric, p_valor numeric, p_proveedor text DEFAULT NULL, p_por text DEFAULT NULL,
  p_vence_el date DEFAULT NULL, p_id text DEFAULT NULL, p_inventario text DEFAULT 'general',
  p_metodo_pago text DEFAULT 'efectivo', p_estado_pago text DEFAULT 'pagado', p_soporte_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_id TEXT; v_item TEXT; v_unidad TEXT; v_nuevo_costo NUMERIC; v_vence DATE;
  v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date; v_g JSONB; v_inv TEXT := COALESCE(p_inventario,'general');
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF p_cantidad IS NULL OR p_cantidad <= 0 OR p_valor IS NULL OR p_valor < 0 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Cantidad y valor deben ser positivos.');
  END IF;
  v_id := COALESCE(NULLIF(p_id,''), 'C-' || to_char(now() AT TIME ZONE 'America/Bogota', 'YYYYMMDD-HH24MISS') || '-' || substr(md5(random()::text), 1, 5));
  IF EXISTS (SELECT 1 FROM compras WHERE id = v_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicada', true, 'mensaje', 'Esta compra ya estaba registrada (no se duplicó).');
  END IF;

  IF v_inv = 'porciones' THEN
    SELECT item INTO v_item FROM inventario_porciones WHERE item = LOWER(TRIM(p_ingrediente));
    IF v_item IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El producto no está en el inventario de porciones.'); END IF;
    v_unidad := 'porciones';
    PERFORM _mover_porciones(v_item, 'entrada', p_cantidad, 'Compra' || COALESCE(' a ' || NULLIF(p_proveedor,''), ''), v_id);
  ELSE
    SELECT * INTO v FROM ingredientes WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente)) FOR UPDATE;
    IF v.ingrediente IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'El insumo no existe en el inventario.'); END IF;
    v_item := v.ingrediente; v_unidad := v.unidad;
    v_nuevo_costo := (GREATEST(v.stock,0) * v.costo_unitario + p_valor) / (GREATEST(v.stock,0) + p_cantidad);
    UPDATE ingredientes SET costo_unitario = ROUND(v_nuevo_costo, 4), proveedor = COALESCE(NULLIF(p_proveedor,''), proveedor) WHERE ingrediente = v_item;
    PERFORM _mover_stock(v_item, p_cantidad, 'compra', 'Compra' || COALESCE(' a ' || NULLIF(p_proveedor,''), ''), v_id);
    v_vence := COALESCE(p_vence_el, CASE WHEN v.vida_util_dias IS NOT NULL THEN v_hoy + v.vida_util_dias END);
    INSERT INTO lotes (ingrediente, cantidad_inicial, cantidad_actual, costo_unitario, vence_el, referencia)
    VALUES (v_item, p_cantidad, p_cantidad, ROUND(p_valor / p_cantidad, 4), v_vence, v_id);
  END IF;

  INSERT INTO compras (id, inventario, item, cantidad, unidad, costo_unitario, total, proveedor, metodo_pago, estado_pago, responsable, soporte_url, vence_el)
  VALUES (v_id, v_inv, v_item, p_cantidad, v_unidad, ROUND(p_valor / p_cantidad, 4), p_valor, NULLIF(p_proveedor,''),
          COALESCE(NULLIF(p_metodo_pago,''),'efectivo'), COALESCE(p_estado_pago,'pagado'), COALESCE(NULLIF(p_por,''), _usuario_actual()), p_soporte_url, v_vence);
  IF NULLIF(p_proveedor,'') IS NOT NULL THEN INSERT INTO proveedores (nombre) VALUES (p_proveedor) ON CONFLICT (nombre) DO NOTHING; END IF;

  -- El gasto asociado: uno solo por compra (índice único gastos_compra_unico)
  INSERT INTO gastos (id_operacion, fecha, concepto, categoria, valor, tipo, metodo_pago, responsable, estado, compra_id, caja_id, pagado_en, soporte_url, created_at)
  VALUES ('G-' || v_id, v_hoy, 'compra de ' || v_item, 'compras', p_valor, 'variable', COALESCE(NULLIF(p_metodo_pago,''),'efectivo'),
          COALESCE(NULLIF(p_por,''), _usuario_actual()), COALESCE(p_estado_pago,'pagado'), v_id,
          CASE WHEN COALESCE(p_estado_pago,'pagado') = 'pagado' AND COALESCE(p_metodo_pago,'efectivo') = 'efectivo' THEN _caja_abierta() END,
          CASE WHEN COALESCE(p_estado_pago,'pagado') = 'pagado' THEN now() END, p_soporte_url, now());

  PERFORM _auditar('registrar', 'compra', v_id, jsonb_build_object('inventario', v_inv, 'item', v_item, 'cantidad', p_cantidad, 'total', p_valor, 'proveedor', p_proveedor));
  RETURN jsonb_build_object('ok', true, 'compra_id', v_id,
    'mensaje', 'Compra registrada: +' || p_cantidad || ' ' || v_unidad || ' de ' || v_item || ' ($' || to_char(p_valor, 'FM999G999G999') || '). Gasto creado una sola vez.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'mensaje', SQLERRM);
END $$;

-- =====================================================================
-- 10. CAJA
-- =====================================================================
CREATE OR REPLACE FUNCTION public.abrir_caja(p_base numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF p_base IS NULL OR p_base < 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La base no puede ser negativa.'); END IF;
  IF _caja_abierta() IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Ya hay una caja abierta. Ciérrala primero.'); END IF;
  INSERT INTO cajas (estado, base, abierta_por, abierta_en) VALUES ('abierta', p_base, _usuario_actual(), now()) RETURNING id INTO v_id;
  PERFORM _auditar('abrir', 'caja', v_id::text, jsonb_build_object('base', p_base));
  RETURN jsonb_build_object('ok', true, 'caja_id', v_id, 'mensaje', 'Caja abierta con base $' || to_char(p_base, 'FM999G999G999') || '.');
END $$;

CREATE OR REPLACE FUNCTION public.caja_actual()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_ef NUMERIC; v_ot NUMERIC; v_por JSONB; v_gas NUMERIC; v_n INT;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  SELECT * INTO v FROM cajas WHERE id = _caja_abierta();
  IF v.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'efectivo'), 0), COALESCE(SUM(total) FILTER (WHERE metodo_pago <> 'efectivo'), 0), COUNT(*)
    INTO v_ef, v_ot, v_n FROM ventas WHERE caja_id = v.id AND pago_estado = 'pagado';
  SELECT COALESCE(jsonb_object_agg(metodo_pago, t), '{}'::jsonb) INTO v_por
    FROM (SELECT metodo_pago, SUM(total) t FROM ventas WHERE caja_id = v.id AND pago_estado = 'pagado' GROUP BY 1) s;
  SELECT COALESCE(SUM(valor), 0) INTO v_gas FROM gastos WHERE caja_id = v.id AND estado = 'pagado' AND metodo_pago = 'efectivo' AND NOT anulado;
  RETURN jsonb_build_object('id', v.id, 'base', v.base, 'abierta_por', v.abierta_por, 'abierta_en', v.abierta_en,
    'numero_ventas', v_n, 'ventas_efectivo', v_ef, 'ventas_otros', v_ot, 'ventas_por_metodo', v_por,
    'gastos_efectivo', v_gas, 'esperado', v.base + v_ef - v_gas);
END $$;

DROP FUNCTION IF EXISTS public.cerrar_caja(bigint, numeric, text);
CREATE OR REPLACE FUNCTION public.cerrar_caja(p_caja_id bigint, p_contado numeric, p_por text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base NUMERIC; v_ef NUMERIC; v_ot NUMERIC; v_gas NUMERIC; v_esp NUMERIC;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF p_contado IS NULL OR p_contado < 0 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Ingresa el efectivo contado.'); END IF;
  SELECT base INTO v_base FROM cajas WHERE id = p_caja_id AND estado = 'abierta' FOR UPDATE;
  IF v_base IS NULL THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'La caja no está abierta.'); END IF;
  SELECT COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'efectivo'), 0), COALESCE(SUM(total) FILTER (WHERE metodo_pago <> 'efectivo'), 0)
    INTO v_ef, v_ot FROM ventas WHERE caja_id = p_caja_id AND pago_estado = 'pagado';
  SELECT v_ef + COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'efectivo'), 0), v_ot + COALESCE(SUM(total) FILTER (WHERE metodo_pago <> 'efectivo'), 0)
    INTO v_ef, v_ot FROM pedidos WHERE caja_id = p_caja_id AND estado = 'pagado';
  SELECT COALESCE(SUM(valor), 0) INTO v_gas FROM gastos WHERE caja_id = p_caja_id AND estado = 'pagado' AND metodo_pago = 'efectivo' AND NOT anulado;
  v_esp := v_base + v_ef - v_gas;
  UPDATE cajas SET estado = 'cerrada', cerrada_por = COALESCE(NULLIF(p_por,''), _usuario_actual()), cerrada_en = now(),
    ventas_efectivo = v_ef, ventas_otros = v_ot, esperado = v_esp, contado = p_contado, diferencia = p_contado - v_esp WHERE id = p_caja_id;
  PERFORM _auditar('cerrar', 'caja', p_caja_id::text, jsonb_build_object('esperado', v_esp, 'contado', p_contado, 'diferencia', p_contado - v_esp));
  RETURN jsonb_build_object('ok', true, 'esperado', v_esp, 'contado', p_contado, 'diferencia', p_contado - v_esp,
    'ventas_efectivo', v_ef, 'ventas_otros', v_ot, 'gastos_efectivo', v_gas,
    'mensaje', 'Caja cerrada. Esperado $' || to_char(v_esp, 'FM999G999G999') || ', contado $' || to_char(p_contado, 'FM999G999G999') ||
               ', diferencia $' || to_char(p_contado - v_esp, 'FM999G999G990') || '.');
END $$;

-- =====================================================================
-- 11. REPORTES (por día, semana, mes o rango)
-- Ingresos = ventas cobradas. Gastos = gastos pagados (pendientes aparte).
-- Balance = ingresos − gastos registrados (NO es utilidad neta contable).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.reporte_periodo(p_desde date, p_hasta date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ing NUMERIC; v_n INT; v_gas NUMERIC; v_pend NUMERIC; v_comp NUMERIC; r JSONB;
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN RAISE EXCEPTION 'Rango de fechas no válido.'; END IF;
  SELECT COALESCE(SUM(total),0), COUNT(*) INTO v_ing, v_n FROM ventas WHERE pago_estado = 'pagado' AND fecha BETWEEN p_desde AND p_hasta;
  SELECT COALESCE(SUM(valor),0) INTO v_gas FROM gastos WHERE estado = 'pagado' AND NOT anulado AND fecha BETWEEN p_desde AND p_hasta;
  SELECT COALESCE(SUM(valor),0) INTO v_pend FROM gastos WHERE estado = 'pendiente' AND NOT anulado;
  SELECT COALESCE(SUM(total),0) INTO v_comp FROM compras WHERE fecha BETWEEN p_desde AND p_hasta;
  r := jsonb_build_object(
    'periodo', CASE WHEN p_desde = p_hasta THEN p_desde::text ELSE p_desde || ' a ' || p_hasta END,
    'desde', p_desde, 'hasta', p_hasta,
    'numero_ventas', v_n, 'total_ventas', v_ing, 'total_gastos', v_gas, 'balance', v_ing - v_gas,
    'nota_balance', 'Ingresos menos gastos registrados. No equivale a utilidad neta contable.',
    'gastos_pendientes', v_pend, 'total_compras', v_comp,
    'unidades_por_plato', (SELECT COALESCE(jsonb_object_agg(plato, u), '{}') FROM (SELECT plato, SUM(cantidad) u FROM ventas WHERE pago_estado='pagado' AND fecha BETWEEN p_desde AND p_hasta GROUP BY plato ORDER BY 2 DESC) s),
    'ventas_por_categoria', (SELECT COALESCE(jsonb_object_agg(COALESCE(categoria,'sin categoría'), t), '{}') FROM (SELECT categoria, SUM(total) t FROM ventas WHERE pago_estado='pagado' AND fecha BETWEEN p_desde AND p_hasta GROUP BY 1) s),
    'ventas_por_modalidad', (SELECT COALESCE(jsonb_object_agg(tipo_pedido, t), '{}') FROM (SELECT tipo_pedido, SUM(total) t FROM ventas WHERE pago_estado='pagado' AND fecha BETWEEN p_desde AND p_hasta GROUP BY 1) s),
    'ventas_por_metodo', (SELECT COALESCE(jsonb_object_agg(metodo_pago, t), '{}') FROM (SELECT metodo_pago, SUM(total) t FROM ventas WHERE pago_estado='pagado' AND fecha BETWEEN p_desde AND p_hasta GROUP BY 1) s),
    'gastos_por_categoria', (SELECT COALESCE(jsonb_object_agg(categoria, t), '{}') FROM (SELECT categoria, SUM(valor) t FROM gastos WHERE estado='pagado' AND NOT anulado AND fecha BETWEEN p_desde AND p_hasta GROUP BY 1) s),
    'ingredientes_bajo_minimo', (SELECT COALESCE(jsonb_agg(jsonb_build_object('ingrediente', ingrediente, 'stock', stock, 'stock_minimo', stock_minimo, 'unidad', unidad)), '[]')
                                   FROM ingredientes WHERE activo AND stock <= stock_minimo),
    'porciones_bajas', (SELECT COALESCE(jsonb_agg(jsonb_build_object('item', item, 'total', total, 'minimo', minimo)), '[]') FROM inventario_porciones WHERE activo AND total <= minimo),
    'movimientos_inventario', (SELECT COALESCE(jsonb_agg(jsonb_build_object('ingrediente', m.ingrediente, 'delta', m.delta, 'unidad', COALESCE(i.unidad,''), 'motivo', m.motivo, 'fecha', m.created_at, 'usuario', m.usuario)), '[]')
                                 FROM (SELECT * FROM movimientos_inventario ORDER BY created_at DESC LIMIT 20) m LEFT JOIN ingredientes i ON i.ingrediente = m.ingrediente)
  );
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.reporte(p_fecha text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_d DATE;
BEGIN
  BEGIN v_d := NULLIF(TRIM(p_fecha),'')::date; EXCEPTION WHEN OTHERS THEN v_d := NULL; END;
  v_d := COALESCE(v_d, (now() AT TIME ZONE 'America/Bogota')::date);
  RETURN reporte_periodo(v_d, v_d);
END $$;

-- =====================================================================
-- 12. EMPLEADOS (la cuenta se crea en Supabase Auth; aquí se asigna cargo)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.guardar_perfil(p_email text, p_nombre text, p_rol text, p_activo boolean DEFAULT TRUE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email TEXT := LOWER(TRIM(p_email));
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Correo no válido.'); END IF;
  IF p_rol NOT IN ('admin','cocina','parrilla','mesera','domicilios','domiciliario') THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Cargo no válido.'); END IF;
  IF v_email = _usuario_actual() AND (p_rol <> 'admin' OR NOT p_activo) THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'No puedes quitarte tu propio acceso de administrador.');
  END IF;
  INSERT INTO perfiles (email, nombre, rol, activo) VALUES (v_email, TRIM(p_nombre), p_rol, COALESCE(p_activo,TRUE))
  ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre, rol = EXCLUDED.rol, activo = EXCLUDED.activo, updated_at = now();
  PERFORM _auditar('guardar', 'empleado', v_email, jsonb_build_object('rol', p_rol, 'activo', p_activo));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Empleado ' || TRIM(p_nombre) || ' guardado como ' || p_rol || '.');
END $$;

CREATE OR REPLACE FUNCTION public.mi_perfil()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('email', _usuario_actual(), 'rol', rol_actual(),
    'nombre', (SELECT nombre FROM perfiles WHERE email = _usuario_actual()))
$$;

-- =====================================================================
-- 13. SEGURIDAD: lectura por cargo, escritura solo por funciones
-- =====================================================================
ALTER TABLE public.perfiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_porciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_porciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumos_producto    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_faltantes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conceptos_gasto      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT; p RECORD;
  operativas TEXT[] := ARRAY['ingredientes','movimientos_inventario','inventario_porciones','movimientos_porciones','productos','consumos_producto','recetas','reportes_faltantes'];
  financieras TEXT[] := ARRAY['gastos','compras','cajas','auditoria','conceptos_gasto','perfiles'];
BEGIN
  FOREACH t IN ARRAY operativas || financieras || ARRAY['ventas'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
  -- Todo el personal ve inventarios, menú y recetas (cocineras y parrillero incluidos)
  FOREACH t IN ARRAY operativas LOOP
    EXECUTE format('CREATE POLICY leer_personal ON public.%I FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL)', t);
  END LOOP;
  -- Información financiera y administrativa: solo administración
  FOREACH t IN ARRAY financieras LOOP
    EXECUTE format('CREATE POLICY leer_admin ON public.%I FOR SELECT TO authenticated USING (public.rol_actual() = ''admin'')', t);
  END LOOP;
END $$;
-- Ventas: administración todo; el resto solo los pedidos recientes que le tocan (vía consultar_pedidos o esta política)
CREATE POLICY leer_ventas ON public.ventas FOR SELECT TO authenticated USING (
  public.rol_actual() = 'admin'
  OR (public.rol_actual() IN ('cocina','parrilla','mesera','domicilios') AND created_at > now() - interval '2 days')
  OR (public.rol_actual() = 'domiciliario' AND domiciliario = public._usuario_actual())
);
CREATE POLICY leer_mi_perfil ON public.perfiles FOR SELECT TO authenticated USING (email = public._usuario_actual());

-- Funciones: solo usuarios con sesión (y n8n con service_role)
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'rol_actual()', 'mi_perfil()', '_exigir_rol(text[])', '_usuario_actual()',
    'guardar_ingrediente(text,text,numeric,text,numeric,text,boolean)', 'crear_ingrediente(text,text,numeric,numeric,text)',
    'ajustar_inventario(text,numeric,text)', 'reportar_faltante(text,text,numeric,text)',
    'registrar_porciones(text,text,numeric,text)', 'guardar_item_porciones(text,text,numeric,boolean)', 'cerrar_periodo_porciones()',
    'guardar_producto(text,text,numeric,numeric,numeric,text,text,boolean,boolean,text)',
    'guardar_consumo(text,text,text,text,numeric)',
    'registrar_venta(text,text,integer,text,text,text,text,text,boolean,boolean,text,text,text,text,text)',
    'actualizar_estado_venta(text,text,text,text,boolean)', 'asignar_domiciliario(text,text)', 'consultar_pedidos(text,integer)',
    'registrar_gasto(text,text,text,numeric,text,text,text,text,text,date)', 'marcar_gasto_pagado(text,text)',
    'registrar_compra(text,numeric,numeric,text,text,date,text,text,text,text,text)',
    'abrir_caja(numeric)', 'caja_actual()', 'cerrar_caja(bigint,numeric,text)',
    'reporte_periodo(date,date)', 'reporte(text)', 'guardar_perfil(text,text,text,boolean)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
  -- Internas: no se llaman desde la app
  FOREACH f IN ARRAY ARRAY['_mover_stock(text,numeric,text,text,text)', '_mover_porciones(text,text,numeric,text,text)',
                           '_auditar(text,text,text,jsonb)', '_caja_abierta()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- =====================================================================
-- 14. DATOS INICIALES CONFIRMADOS POR EL RESTAURANTE
--     (precios del documento; existencias en 0; unidades "por definir" cuando no se confirmaron)
-- =====================================================================
INSERT INTO public.productos (nombre, categoria, precio, precio_llevar, precio_media, presentacion, unidad, estacion) VALUES
  ('almuerzo corriente',                    'almuerzos', 13000, 14000, NULL, NULL, NULL, 'cocina'),
  ('almuerzo seco',                         'almuerzos', 11000, 12000, NULL, NULL, NULL, 'cocina'),
  ('corriente especial con mondongo',       'almuerzos', 15000, 16000, NULL, NULL, NULL, 'cocina'),
  ('corriente especial con ajiaco',         'almuerzos', 15000, 16000, NULL, NULL, NULL, 'cocina'),
  ('corriente especial con mote de queso',  'almuerzos', 15000, 16000, NULL, NULL, NULL, 'cocina'),
  ('asado de carne de res',                 'asados',    22000, NULL, 15000, NULL, NULL, 'parrilla'),
  ('asado de lomo de cerdo',                'asados',    20000, NULL, 14000, NULL, NULL, 'parrilla'),
  ('asado de pechuga',                      'asados',    20000, NULL, 14000, NULL, NULL, 'parrilla'),
  ('asado de chuleta',                      'asados',    20000, NULL, 14000, NULL, NULL, 'parrilla'),
  ('gaseosa postobón personal',             'bebidas',    3500, NULL, NULL, 'personal', 'unidad', 'bar'),
  ('coca-cola personal',                    'bebidas',    3500, NULL, NULL, 'personal', 'unidad', 'bar'),
  ('coca-cola 1,5 litros',                  'bebidas',    7000, NULL, NULL, '1,5 litros', 'unidad', 'bar'),
  ('agua pequeña',                          'bebidas',    1000, NULL, NULL, 'pequeña', 'unidad', 'bar'),
  ('agua grande',                           'bebidas',    2000, NULL, NULL, 'grande', 'unidad', 'bar')
ON CONFLICT (nombre) DO UPDATE SET categoria = EXCLUDED.categoria, precio = EXCLUDED.precio, precio_llevar = EXCLUDED.precio_llevar,
  precio_media = EXCLUDED.precio_media, presentacion = EXCLUDED.presentacion, unidad = EXCLUDED.unidad, estacion = EXCLUDED.estacion;

-- Productos de prueba anteriores (no son del menú real): se desactivan, no se borran
UPDATE public.productos SET activo = FALSE
 WHERE nombre IN ('arroz con pollo','limonada','pollo frito con papa');

INSERT INTO public.inventario_porciones (item, grupo) VALUES
  ('lomo de cerdo','asado'), ('carne de res','asado'), ('pechuga','asado'), ('costillas','asado'), ('chuleta','asado'),
  ('sobrebarriga','asado'), ('chinchurria','asado'),
  ('ejecutivo de cerdo','ejecutivo'), ('ejecutivo de chuleta','ejecutivo'), ('ejecutivo de pechuga','ejecutivo'), ('ejecutivo de carne de res','ejecutivo')
ON CONFLICT (item) DO NOTHING;

INSERT INTO public.ingredientes (ingrediente, unidad, stock, stock_minimo, categoria) VALUES
  ('arroz','por definir',0,0,'granos_legumbres'), ('lentejas','por definir',0,0,'granos_legumbres'),
  ('fríjoles','por definir',0,0,'granos_legumbres'), ('pastas','por definir',0,0,'granos_legumbres'),
  ('yuca','por definir',0,0,'tuberculos_vegetales'), ('plátano','por definir',0,0,'tuberculos_vegetales'),
  ('papa','por definir',0,0,'tuberculos_vegetales'), ('ají','por definir',0,0,'tuberculos_vegetales'),
  ('pimentón','por definir',0,0,'tuberculos_vegetales'), ('cilantro','por definir',0,0,'tuberculos_vegetales'),
  ('apio','por definir',0,0,'tuberculos_vegetales'),
  ('lechuga','por definir',0,0,'verduras_hortalizas'), ('tomate','por definir',0,0,'verduras_hortalizas'),
  ('repollo','por definir',0,0,'verduras_hortalizas'), ('zanahoria','por definir',0,0,'verduras_hortalizas'),
  ('pepino','por definir',0,0,'verduras_hortalizas'),
  ('jarrete grueso','por definir',0,0,'carnes_proteinas'), ('carne molida','por definir',0,0,'carnes_proteinas'),
  ('chicharrón','por definir',0,0,'carnes_proteinas'), ('carne salada','por definir',0,0,'carnes_proteinas'),
  ('bondiola de cerdo','por definir',0,0,'carnes_proteinas'), ('pollo para sopas','por definir',0,0,'carnes_proteinas'),
  ('pollo para guisar','por definir',0,0,'carnes_proteinas'), ('costillas de res','por definir',0,0,'carnes_proteinas'),
  ('costillas de cerdo','por definir',0,0,'carnes_proteinas'), ('alitas de pollo','por definir',0,0,'carnes_proteinas'),
  ('queso','por definir',0,0,'otros_ingredientes'), ('huevos','unidad',0,0,'otros_ingredientes'),
  ('salsa para carne','por definir',0,0,'salsas_condimentos'), ('salsa bbq','por definir',0,0,'salsas_condimentos'),
  ('vinagre','por definir',0,0,'salsas_condimentos'), ('sal','por definir',0,0,'salsas_condimentos'),
  ('aceite','por definir',0,0,'salsas_condimentos'),
  ('desechables','por definir',0,0,'desechables'), ('cubiertos','por definir',0,0,'desechables'),
  ('gaseosa postobón personal','unidad',0,0,'bebidas'), ('coca-cola personal','unidad',0,0,'bebidas'),
  ('coca-cola 1,5 litros','unidad',0,0,'bebidas'), ('agua pequeña','unidad',0,0,'bebidas'), ('agua grande','unidad',0,0,'bebidas')
ON CONFLICT (ingrediente) DO UPDATE SET categoria = EXCLUDED.categoria WHERE public.ingredientes.categoria = 'otro';

-- Cada bebida descuenta 1 unidad de su propio inventario (dato confirmado: se controlan por unidades)
INSERT INTO public.consumos_producto (producto, variante, tipo, item, cantidad)
SELECT nombre, NULL, 'ingrediente', nombre, 1 FROM public.productos WHERE categoria = 'bebidas' AND activo
ON CONFLICT DO NOTHING;

-- Lista de domiciliarios activos (para asignar entregas)
CREATE OR REPLACE FUNCTION public.listar_domiciliarios()
RETURNS TABLE (email text, nombre text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _exigir_rol(ARRAY['domicilios']);
  RETURN QUERY SELECT p.email, p.nombre FROM perfiles p WHERE p.rol = 'domiciliario' AND p.activo ORDER BY p.nombre;
END $$;
REVOKE ALL ON FUNCTION public.listar_domiciliarios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_domiciliarios() TO authenticated, service_role;

-- Marcar un faltante reportado como atendido
CREATE OR REPLACE FUNCTION public.atender_faltante(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  UPDATE reportes_faltantes SET atendido = TRUE WHERE id = p_id AND NOT atendido;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Reporte no encontrado o ya atendido.'); END IF;
  PERFORM _auditar('atender', 'faltante', p_id::text);
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Faltante marcado como atendido.');
END $$;
REVOKE ALL ON FUNCTION public.atender_faltante(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atender_faltante(bigint) TO authenticated, service_role;
