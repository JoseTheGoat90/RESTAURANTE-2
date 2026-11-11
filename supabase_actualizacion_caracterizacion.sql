-- ==============================================================================
-- RESTAURANTE · ACTUALIZACIÓN SEGÚN CARACTERIZACIÓN OFICIAL
-- Script SQL para Supabase (Nuevas columnas, precios oficiales e insumos)
-- ==============================================================================

-- 1. ADICIÓN DE COLUMNAS A TABLAS EXISTENTES
-- Soporte para tamaño de porción en ventas (Media vs Entera en Asados)
ALTER TABLE public.ventas 
  ADD COLUMN IF NOT EXISTS tamano_porcion TEXT CHECK (tamano_porcion IN ('media', 'entera')),
  ADD COLUMN IF NOT EXISTS tipo_pedido TEXT DEFAULT 'mesa' CHECK (tipo_pedido IN ('mesa', 'domicilio', 'llevar')),
  ADD COLUMN IF NOT EXISTS mesa TEXT,
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS acompanamiento TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT;

-- Soporte para responsable y periodo en la tabla de gastos
ALTER TABLE public.gastos 
  ADD COLUMN IF NOT EXISTS responsable TEXT DEFAULT 'Administrador',
  ADD COLUMN IF NOT EXISTS periodo TEXT,
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pagado' CHECK (estado IN ('pagado', 'pendiente'));

-- Soporte para tipo de insumo oficial en ingredientes
ALTER TABLE public.ingredientes
  ADD COLUMN IF NOT EXISTS tipo_insumo TEXT DEFAULT 'carnes_proteinas';

-- 2. LIMPIEZA Y ACTUALIZACIÓN DE PRODUCTOS / RECETAS CON PRECIOS OFICIALES

-- Asados (con precio base entera o media)
INSERT INTO public.recetas (plato, ingrediente, cantidad, precio)
VALUES 
  ('Asado Carne de Res', 'carne de res', 1, 22000),
  ('Asado Lomo de Cerdo', 'lomo de cerdo', 1, 20000),
  ('Asado Pechuga a la Plancha', 'pechuga', 1, 20000),
  ('Asado Chuleta de Cerdo', 'chuleta', 1, 20000)
ON CONFLICT DO NOTHING;

-- Almuerzos y Sopas
INSERT INTO public.recetas (plato, ingrediente, cantidad, precio)
VALUES 
  ('Almuerzo Corriente', 'arroz', 1, 13000),
  ('Almuerzo Seco', 'arroz', 1, 11000),
  ('Sopa de Mondongo', 'carne de res', 1, 15000),
  ('Ajiaco Santafereño', 'pollo para sopas/guisar', 1, 15000),
  ('Mote de Queso', 'queso', 1, 15000),
  ('Sopa de Costilla de Res', 'costillas de res', 1, 15000),
  ('Sopa de Jarrete', 'jarrete grueso', 1, 15000)
ON CONFLICT DO NOTHING;

-- Bebidas
INSERT INTO public.recetas (plato, ingrediente, cantidad, precio)
VALUES 
  ('Gaseosa Postobon Personal', 'bolsas de domicilio', 0, 3500),
  ('Gaseosa Coca-Cola Personal', 'bolsas de domicilio', 0, 3500),
  ('Coca-Cola 1.5L', 'bolsas de domicilio', 0, 7000),
  ('Agua Presentacion 1', 'bolsas de domicilio', 0, 1000),
  ('Agua Presentacion 2', 'bolsas de domicilio', 0, 2000)
ON CONFLICT DO NOTHING;

-- 3. INSUMOS OFICIALES SEGÚN CATEGORÍAS DEL DOCUMENTO
INSERT INTO public.ingredientes (ingrediente, unidad, stock, stock_minimo, tipo_insumo)
VALUES
  -- Granos, legumbres y pastas
  ('arroz', 'lb', 80, 20, 'granos_legumbres'),
  ('lentejas', 'lb', 35, 10, 'granos_legumbres'),
  ('frijoles', 'lb', 35, 10, 'granos_legumbres'),
  ('pastas', 'lb', 25, 8, 'granos_legumbres'),

  -- Tubérculos, plátanos y otros vegetales
  ('yuca', 'lb', 50, 15, 'tuberculos_vegetales'),
  ('platano', 'unidad', 90, 25, 'tuberculos_vegetales'),
  ('papa', 'lb', 70, 20, 'tuberculos_vegetales'),
  ('aji dulce', 'lb', 15, 5, 'tuberculos_vegetales'),
  ('pimenton', 'lb', 18, 5, 'tuberculos_vegetales'),
  ('cilantro', 'unidad', 30, 10, 'tuberculos_vegetales'),
  ('apio', 'unidad', 20, 6, 'tuberculos_vegetales'),

  -- Verduras y hortalizas
  ('lechuga', 'unidad', 30, 8, 'verduras_hortalizas'),
  ('tomate', 'lb', 40, 12, 'verduras_hortalizas'),
  ('repollo', 'unidad', 20, 6, 'verduras_hortalizas'),
  ('zanahoria', 'lb', 30, 10, 'verduras_hortalizas'),
  ('pepino', 'lb', 25, 8, 'verduras_hortalizas'),

  -- Carnes y proteínas
  ('jarrete grueso', 'lb', 40, 12, 'carnes_proteinas'),
  ('carne molida', 'lb', 35, 10, 'carnes_proteinas'),
  ('chicharron', 'lb', 30, 10, 'carnes_proteinas'),
  ('carne salada', 'lb', 25, 8, 'carnes_proteinas'),
  ('bondiola de cerdo', 'lb', 30, 10, 'carnes_proteinas'),
  ('pollo para sopas/guisar', 'lb', 45, 15, 'carnes_proteinas'),
  ('costillas de res', 'lb', 40, 12, 'carnes_proteinas'),
  ('costillas de cerdo', 'lb', 35, 10, 'carnes_proteinas'),
  ('alitas de pollo', 'lb', 30, 10, 'carnes_proteinas'),
  ('lomo de cerdo', 'lb', 45, 15, 'carnes_proteinas'),
  ('pechuga', 'lb', 50, 15, 'carnes_proteinas'),
  ('carne de res', 'lb', 55, 18, 'carnes_proteinas'),
  ('chuleta', 'lb', 35, 10, 'carnes_proteinas'),

  -- Otros ingredientes
  ('queso', 'lb', 30, 10, 'otro'),
  ('huevos', 'unidad', 120, 30, 'otro'),
  ('bollo', 'unidad', 60, 20, 'otro'),
  ('patacon', 'unidad', 80, 25, 'otro'),

  -- Salsas, condimentos y aceites
  ('salsa para carne', 'unidad', 15, 4, 'salsas_condimentos'),
  ('salsa BBQ', 'unidad', 15, 4, 'salsas_condimentos'),
  ('vinagre', 'unidad', 10, 3, 'salsas_condimentos'),
  ('sal', 'lb', 40, 10, 'salsas_condimentos'),
  ('aceite vegetal', 'unidad', 25, 6, 'salsas_condimentos'),
  ('salsas de la casa', 'unidad', 20, 5, 'salsas_condimentos'),

  -- Desechables y cubiertos
  ('cubiertos desechables', 'unidad', 300, 80, 'desechables'),
  ('empaque termico para sopa', 'unidad', 200, 50, 'desechables'),
  ('empaque para secos', 'unidad', 250, 60, 'desechables'),
  ('bolsas de domicilio', 'unidad', 200, 50, 'desechables')
ON CONFLICT (ingrediente) DO UPDATE SET
  tipo_insumo = EXCLUDED.tipo_insumo,
  unidad = EXCLUDED.unidad;

-- 4. FUNCIÓN RPC REGISTRAR VENTA ACTUALIZADA CON PORCIÓN Y TIPO DE PEDIDO
CREATE OR REPLACE FUNCTION public.registrar_venta(
    p_plato TEXT,
    p_cantidad INTEGER DEFAULT 1,
    p_tipo_pedido TEXT DEFAULT 'mesa',
    p_mesa TEXT DEFAULT NULL,
    p_metodo_pago TEXT DEFAULT 'efectivo',
    p_acompanamiento TEXT DEFAULT NULL,
    p_notas TEXT DEFAULT NULL,
    p_tamano_porcion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id_operacion TEXT;
    v_precio_base NUMERIC(12, 2);
    v_total NUMERIC(12, 2);
    v_rec RECORD;
    v_stock_actual NUMERIC(12, 2);
    v_descuento_proporcional NUMERIC(12, 3);
BEGIN
    IF p_cantidad <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'mensaje', 'La cantidad debe ser mayor a cero');
    END IF;

    -- Obtener precio base registrado
    SELECT precio INTO v_precio_base FROM public.recetas WHERE LOWER(TRIM(plato)) = LOWER(TRIM(p_plato)) LIMIT 1;
    IF v_precio_base IS NULL THEN
        v_precio_base := 15000;
    END IF;

    -- Aplicar reglas según documento oficial
    IF LOWER(p_plato) LIKE '%asado%' THEN
        IF p_tamano_porcion = 'media' THEN
            IF LOWER(p_plato) LIKE '%res%' THEN
                v_precio_base := 15000;
            ELSE
                v_precio_base := 14000;
            END IF;
        ELSE
            IF LOWER(p_plato) LIKE '%res%' THEN
                v_precio_base := 22000;
            ELSE
                v_precio_base := 20000;
            END IF;
        END IF;
    ELSIF LOWER(p_plato) LIKE '%corriente%' THEN
        IF p_tipo_pedido IN ('llevar', 'domicilio') THEN
            v_precio_base := 14000;
        ELSE
            v_precio_base := 13000;
        END IF;
    ELSIF LOWER(p_plato) LIKE '%seco%' THEN
        IF p_tipo_pedido IN ('llevar', 'domicilio') THEN
            v_precio_base := 12000;
        ELSE
            v_precio_base := 11000;
        END IF;
    ELSIF LOWER(p_plato) LIKE '%sopa%' OR LOWER(p_plato) LIKE '%mondongo%' OR LOWER(p_plato) LIKE '%ajiaco%' OR LOWER(p_plato) LIKE '%mote%' THEN
        IF p_tipo_pedido IN ('llevar', 'domicilio') THEN
            v_precio_base := 16000;
        ELSE
            v_precio_base := 15000;
        END IF;
    END IF;

    v_total := v_precio_base * p_cantidad;
    v_id_operacion := 'ven-' || floor(extract(epoch from now()) * 1000)::text;

    -- Descontar insumos con factor de escala si es media porción
    v_descuento_proporcional := CASE WHEN p_tamano_porcion = 'media' THEN 0.6 ELSE 1.0 END;

    FOR v_rec IN 
        SELECT ingrediente, cantidad 
        FROM public.recetas 
        WHERE LOWER(TRIM(plato)) = LOWER(TRIM(p_plato))
    LOOP
        SELECT stock INTO v_stock_actual FROM public.ingredientes WHERE ingrediente = v_rec.ingrediente FOR UPDATE;
        IF v_stock_actual IS NOT NULL THEN
            UPDATE public.ingredientes
            SET stock = GREATEST(0, stock - (v_rec.cantidad * p_cantidad * v_descuento_proporcional))
            WHERE ingrediente = v_rec.ingrediente;

            INSERT INTO public.movimientos_inventario (ingrediente, delta, motivo, referencia)
            VALUES (
                v_rec.ingrediente,
                -(v_rec.cantidad * p_cantidad * v_descuento_proporcional),
                'Venta ' || p_plato || ' (' || COALESCE(p_tamano_porcion, 'entera') || ')',
                v_id_operacion
            );
        END IF;
    END LOOP;

    -- Descuento automático de desechables si es para llevar o domicilio
    IF p_tipo_pedido IN ('llevar', 'domicilio') THEN
        IF LOWER(p_plato) LIKE '%sopa%' THEN
            UPDATE public.ingredientes SET stock = GREATEST(0, stock - p_cantidad) WHERE ingrediente = 'empaque termico para sopa';
        ELSE
            UPDATE public.ingredientes SET stock = GREATEST(0, stock - p_cantidad) WHERE ingrediente = 'empaque para secos';
        END IF;
        UPDATE public.ingredientes SET stock = GREATEST(0, stock - p_cantidad) WHERE ingrediente = 'cubiertos desechables';
        UPDATE public.ingredientes SET stock = GREATEST(0, stock - 1) WHERE ingrediente = 'bolsas de domicilio';
    END IF;

    -- Registrar venta
    INSERT INTO public.ventas (id_operacion, fecha, plato, cantidad, total, estado, tamano_porcion, tipo_pedido, mesa, metodo_pago, acompanamiento, notas)
    VALUES (v_id_operacion, CURRENT_DATE, p_plato, p_cantidad, v_total, 'pagado', p_tamano_porcion, p_tipo_pedido, p_mesa, p_metodo_pago, p_acompanamiento, p_notas);

    RETURN jsonb_build_object(
        'ok', true,
        'id_operacion', v_id_operacion,
        'plato', p_plato,
        'total', v_total,
        'mensaje', 'Venta registrada con éxito'
    );
END;
$$;
