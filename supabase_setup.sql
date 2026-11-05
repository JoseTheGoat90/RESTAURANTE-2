-- ==============================================================================
-- RESTAURANTE · PANEL DE GESTIÓN
-- Script SQL Completo para Supabase (Tablas, RPCs, RLS y Datos Iniciales)
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLAS PRINCIPALES

-- 2.1 Ingredientes
CREATE TABLE IF NOT EXISTS public.ingredientes (
    ingrediente TEXT PRIMARY KEY,
    unidad TEXT NOT NULL DEFAULT 'g',
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Recetas (Platos e Insumos requeridos)
CREATE TABLE IF NOT EXISTS public.recetas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plato TEXT NOT NULL,
    ingrediente TEXT NOT NULL REFERENCES public.ingredientes(ingrediente) ON UPDATE CASCADE ON DELETE RESTRICT,
    cantidad NUMERIC(12, 3) NOT NULL DEFAULT 0,
    precio NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 Ventas (Comandas y Facturación)
CREATE TABLE IF NOT EXISTS public.ventas (
    id_operacion TEXT PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    plato TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pagado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 Conceptos Frecuentes de Gasto
CREATE TABLE IF NOT EXISTS public.conceptos_gasto (
    nombre TEXT PRIMARY KEY,
    categoria TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.5 Gastos (Egresos Operativos)
CREATE TABLE IF NOT EXISTS public.gastos (
    id_operacion TEXT PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    concepto TEXT NOT NULL,
    categoria TEXT NOT NULL,
    valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.6 Movimientos de Inventario (Kardex / Auditoría de Bodega)
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
    id TEXT PRIMARY KEY DEFAULT ('mov-' || floor(extract(epoch from now()) * 1000)::text),
    ingrediente TEXT NOT NULL,
    delta NUMERIC(12, 3) NOT NULL,
    motivo TEXT NOT NULL,
    referencia TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. SEGURIDAD Y PERMISOS (ROW LEVEL SECURITY)
-- ==============================================================================

ALTER TABLE public.ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conceptos_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para clave anónima (anon) y usuarios autenticados (authenticated)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir todo ingredientes" ON public.ingredientes;
    CREATE POLICY "Permitir todo ingredientes" ON public.ingredientes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo recetas" ON public.recetas;
    CREATE POLICY "Permitir todo recetas" ON public.recetas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo ventas" ON public.ventas;
    CREATE POLICY "Permitir todo ventas" ON public.ventas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo conceptos_gasto" ON public.conceptos_gasto;
    CREATE POLICY "Permitir todo conceptos_gasto" ON public.conceptos_gasto FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo gastos" ON public.gastos;
    CREATE POLICY "Permitir todo gastos" ON public.gastos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Permitir todo movimientos_inventario" ON public.movimientos_inventario;
    CREATE POLICY "Permitir todo movimientos_inventario" ON public.movimientos_inventario FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
END $$;

-- Otorgar permisos a anon y authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- ==============================================================================
-- 4. PROCEDIMIENTOS RPC (ELIMINAR PREVIOS PARA EVITAR ERROR 42P13)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.ajustar_inventario(text, numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public.ajustar_inventario CASCADE;

DROP FUNCTION IF EXISTS public.registrar_venta(text, text, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_venta(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_venta(text, text, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_venta CASCADE;

DROP FUNCTION IF EXISTS public.registrar_gasto(text, text, text, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_gasto CASCADE;

DROP FUNCTION IF EXISTS public.crear_ingrediente(text, text, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.crear_ingrediente CASCADE;

DROP FUNCTION IF EXISTS public.reporte(date) CASCADE;
DROP FUNCTION IF EXISTS public.reporte(text) CASCADE;
DROP FUNCTION IF EXISTS public.reporte() CASCADE;
DROP FUNCTION IF EXISTS public.reporte CASCADE;

DROP FUNCTION IF EXISTS public.proyeccion() CASCADE;
DROP FUNCTION IF EXISTS public.proyeccion CASCADE;

-- 4.1 RPC: registrar_venta
CREATE OR REPLACE FUNCTION public.registrar_venta(
    p_id TEXT,
    p_plato TEXT,
    p_cantidad INTEGER,
    p_estado TEXT DEFAULT 'pagado'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unit_price NUMERIC;
    v_total NUMERIC;
    v_receta RECORD;
    v_insumo_necesario NUMERIC;
BEGIN
    -- Obtener precio del plato a partir de las recetas
    SELECT precio INTO v_unit_price
    FROM public.recetas
    WHERE LOWER(TRIM(plato)) = LOWER(TRIM(p_plato))
    LIMIT 1;

    IF v_unit_price IS NULL THEN
        v_unit_price := 35000; -- Valor base de contingencia
    END IF;

    v_total := v_unit_price * p_cantidad;

    -- Registrar la venta
    INSERT INTO public.ventas (id_operacion, fecha, plato, cantidad, total, estado, created_at)
    VALUES (p_id, CURRENT_DATE, p_plato, p_cantidad, v_total, COALESCE(p_estado, 'pagado'), timezone('utc'::text, now()))
    ON CONFLICT (id_operacion) DO UPDATE
    SET total = EXCLUDED.total, estado = EXCLUDED.estado;

    -- Deducir ingredientes según la receta culinaria
    FOR v_receta IN
        SELECT ingrediente, cantidad
        FROM public.recetas
        WHERE LOWER(TRIM(plato)) = LOWER(TRIM(p_plato))
    LOOP
        v_insumo_necesario := v_receta.cantidad * p_cantidad;

        UPDATE public.ingredientes
        SET stock = GREATEST(0, stock - v_insumo_necesario)
        WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(v_receta.ingrediente));

        -- Registrar movimiento en kardex
        INSERT INTO public.movimientos_inventario (id, ingrediente, delta, motivo, referencia, created_at)
        VALUES (
            'mov-' || floor(extract(epoch from clock_timestamp()) * 1000)::text || '-' || floor(random() * 1000)::text,
            v_receta.ingrediente,
            -v_insumo_necesario,
            'Venta (' || p_cantidad || 'x ' || p_plato || ')',
            p_id,
            timezone('utc'::text, now())
        );
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Venta registrada con éxito (' || p_cantidad || 'x ' || p_plato || '). Insumos descontados de bodega.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Error en venta: ' || SQLERRM);
END;
$$;

-- 4.2 RPC: registrar_gasto
CREATE OR REPLACE FUNCTION public.registrar_gasto(
    p_id TEXT,
    p_concepto TEXT,
    p_categoria TEXT,
    p_valor NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.gastos (id_operacion, fecha, concepto, categoria, valor, created_at)
    VALUES (p_id, CURRENT_DATE, LOWER(TRIM(p_concepto)), LOWER(TRIM(p_categoria)), p_valor, timezone('utc'::text, now()))
    ON CONFLICT (id_operacion) DO UPDATE
    SET valor = EXCLUDED.valor;

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Gasto registrado con éxito (' || p_concepto || ').'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Error en gasto: ' || SQLERRM);
END;
$$;

-- 4.3 RPC: ajustar_inventario
CREATE OR REPLACE FUNCTION public.ajustar_inventario(
    p_ingrediente TEXT,
    p_delta NUMERIC,
    p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.ingredientes
    SET stock = GREATEST(0, stock + p_delta)
    WHERE LOWER(TRIM(ingrediente)) = LOWER(TRIM(p_ingrediente));

    INSERT INTO public.movimientos_inventario (id, ingrediente, delta, motivo, created_at)
    VALUES (
        'mov-' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
        p_ingrediente,
        p_delta,
        p_motivo,
        timezone('utc'::text, now())
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Inventario de ' || p_ingrediente || ' ajustado (' || (CASE WHEN p_delta > 0 THEN '+' ELSE '' END) || p_delta || ').'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Error en ajuste: ' || SQLERRM);
END;
$$;

-- 4.4 RPC: crear_ingrediente
CREATE OR REPLACE FUNCTION public.crear_ingrediente(
    p_nombre TEXT,
    p_unidad TEXT,
    p_stock NUMERIC,
    p_minimo NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.ingredientes (ingrediente, unidad, stock, stock_minimo)
    VALUES (LOWER(TRIM(p_nombre)), p_unidad, p_stock, p_minimo)
    ON CONFLICT (ingrediente) DO UPDATE
    SET unidad = EXCLUDED.unidad, stock = EXCLUDED.stock, stock_minimo = EXCLUDED.stock_minimo;

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Ingrediente ' || p_nombre || ' creado o actualizado con éxito.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Error al crear ingrediente: ' || SQLERRM);
END;
$$;

-- 4.5 RPC: reporte
CREATE OR REPLACE FUNCTION public.reporte(
    p_fecha TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fecha DATE;
    v_num_ventas INTEGER;
    v_total_ventas NUMERIC;
    v_total_gastos NUMERIC;
    v_balance NUMERIC;
    v_unidades_plato JSONB;
    v_gastos_cat JSONB;
    v_bajo_minimo JSONB;
    v_movs JSONB;
BEGIN
    IF p_fecha IS NULL OR TRIM(p_fecha) = '' THEN
        v_fecha := CURRENT_DATE;
    ELSE
        BEGIN
            v_fecha := p_fecha::date;
        EXCEPTION WHEN OTHERS THEN
            v_fecha := CURRENT_DATE;
        END;
    END IF;

    -- Ventas
    SELECT
        COALESCE(COUNT(*), 0),
        COALESCE(SUM(total), 0)
    INTO v_num_ventas, v_total_ventas
    FROM public.ventas
    WHERE fecha = v_fecha;

    -- Gastos
    SELECT COALESCE(SUM(valor), 0)
    INTO v_total_gastos
    FROM public.gastos
    WHERE fecha = v_fecha;

    v_balance := v_total_ventas - v_total_gastos;

    -- Unidades por plato
    SELECT COALESCE(jsonb_object_agg(plato, total_cant), '{}'::jsonb)
    INTO v_unidades_plato
    FROM (
        SELECT plato, SUM(cantidad) as total_cant
        FROM public.ventas
        WHERE fecha = v_fecha
        GROUP BY plato
    ) s;

    -- Gastos por categoría
    SELECT COALESCE(jsonb_object_agg(categoria, total_val), '{}'::jsonb)
    INTO v_gastos_cat
    FROM (
        SELECT categoria, SUM(valor) as total_val
        FROM public.gastos
        WHERE fecha = v_fecha
        GROUP BY categoria
    ) s;

    -- Insumos bajo mínimo
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'ingrediente', ingrediente,
            'stock', stock,
            'stock_minimo', stock_minimo,
            'unidad', unidad
        )
    ), '[]'::jsonb)
    INTO v_bajo_minimo
    FROM public.ingredientes
    WHERE stock <= stock_minimo;

    -- Movimientos recientes
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'ingrediente', m.ingrediente,
            'delta', m.delta,
            'unidad', COALESCE(i.unidad, 'g'),
            'motivo', m.motivo,
            'fecha', m.created_at
        )
    ), '[]'::jsonb)
    INTO v_movs
    FROM (
        SELECT ingrediente, delta, motivo, created_at
        FROM public.movimientos_inventario
        ORDER BY created_at DESC
        LIMIT 20
    ) m
    LEFT JOIN public.ingredientes i ON LOWER(i.ingrediente) = LOWER(m.ingrediente);

    RETURN jsonb_build_object(
        'periodo', v_fecha::text,
        'numero_ventas', v_num_ventas,
        'total_ventas', v_total_ventas,
        'total_gastos', v_total_gastos,
        'balance', v_balance,
        'unidades_por_plato', v_unidades_plato,
        'gastos_por_categoria', v_gastos_cat,
        'ingredientes_bajo_minimo', v_bajo_minimo,
        'movimientos_inventario', v_movs
    );
END;
$$;

-- 4.6 RPC: proyeccion
CREATE OR REPLACE FUNCTION public.proyeccion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_ventas NUMERIC;
    v_avg_gastos NUMERIC;
BEGIN
    SELECT COALESCE(AVG(tot), 0) INTO v_avg_ventas FROM (
        SELECT SUM(total) as tot FROM public.ventas GROUP BY fecha LIMIT 7
    ) t;

    SELECT COALESCE(AVG(tot), 0) INTO v_avg_gastos FROM (
        SELECT SUM(valor) as tot FROM public.gastos GROUP BY fecha LIMIT 7
    ) t;

    RETURN jsonb_build_object(
        'ventas_proyectadas', v_avg_ventas * 1.1,
        'margen_estimado', (v_avg_ventas * 1.1) - v_avg_gastos,
        'sugerencias', ARRAY['Asegurar compras tempranas de cortes de res y pan brioche', 'Supervisar insumos perecederos']
    );
END;
$$;

-- ==============================================================================
-- 5. DATOS SEMILLA (SEED DATA)
-- ==============================================================================

-- 5.1 Ingredientes Iniciales
INSERT INTO public.ingredientes (ingrediente, unidad, stock, stock_minimo) VALUES
('lomo de res fino', 'g', 4800, 2000),
('pechuga de pollo marinada', 'g', 6500, 2500),
('pan brioche artesanal', 'unidad', 34, 20),
('queso cheddar madurado', 'g', 1800, 1500),
('pasta fettuccine de la casa', 'g', 3200, 1200),
('costilla de cerdo ahumada', 'kg', 8.5, 3.0),
('tomates san marzano', 'g', 850, 1200),
('aceite de oliva extra virgen', 'g', 420, 800),
('crema de leche fresca', 'g', 1400, 1000),
('papas rústicas con romero', 'g', 9500, 3000),
('aguacate hass', 'unidad', 12, 15),
('vino tinto reserva para salsas', 'unidad', 6, 2)
ON CONFLICT (ingrediente) DO NOTHING;

-- 5.2 Recetas Culinarias
INSERT INTO public.recetas (plato, ingrediente, cantidad, precio) VALUES
('lomo al romero en reducción', 'lomo de res fino', 250, 48000),
('lomo al romero en reducción', 'papas rústicas con romero', 180, 48000),
('lomo al romero en reducción', 'vino tinto reserva para salsas', 0.15, 48000),

('hamburguesa smash cheddar doble', 'pan brioche artesanal', 1, 34000),
('hamburguesa smash cheddar doble', 'lomo de res fino', 200, 34000),
('hamburguesa smash cheddar doble', 'queso cheddar madurado', 60, 34000),
('hamburguesa smash cheddar doble', 'papas rústicas con romero', 150, 34000),

('fettuccine alfredo con pollo grillé', 'pasta fettuccine de la casa', 200, 36000),
('fettuccine alfredo con pollo grillé', 'pechuga de pollo marinada', 180, 36000),
('fettuccine alfredo con pollo grillé', 'crema de leche fresca', 120, 36000),

('costillas bbq ahumadas 500g', 'costilla de cerdo ahumada', 0.5, 52000),
('costillas bbq ahumadas 500g', 'papas rústicas con romero', 200, 52000),

('pechuga grillé con ensalada y aguacate', 'pechuga de pollo marinada', 220, 31000),
('pechuga grillé con ensalada y aguacate', 'aguacate hass', 0.5, 31000),
('pechuga grillé con ensalada y aguacate', 'tomates san marzano', 100, 31000)
ON CONFLICT DO NOTHING;

-- 5.3 Conceptos de Gasto
INSERT INTO public.conceptos_gasto (nombre, categoria) VALUES
('compra de lomo y cortes de res', 'ingredientes'),
('compra de pollo y aves', 'ingredientes'),
('verduras y hortalizas frescas', 'ingredientes'),
('panes y lácteos', 'ingredientes'),
('servicio de gas natural cocina', 'servicios'),
('energía eléctrica restaurante', 'servicios'),
('arriendo local comercial', 'servicios'),
('quincena equipo de cocina', 'nomina'),
('quincena servicio de mesa', 'nomina'),
('productos de aseo y desinfección', 'otros'),
('empaques biodegradables para llevar', 'otros')
ON CONFLICT (nombre) DO NOTHING;
