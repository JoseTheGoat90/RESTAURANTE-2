-- 005: la base calcula cuántas veces el mínimo tiene cada ingrediente,
--      para que el asistente no tenga que hacer la cuenta (la hacía mal).
CREATE OR REPLACE VIEW public.inventario_estado WITH (security_invoker = on) AS
SELECT ingrediente, unidad, stock, stock_minimo,
       ROUND(stock / NULLIF(stock_minimo,0), 2) AS veces_el_minimo,
       -- sin stock ni mínimo = nadie lo ha cargado todavía, no es una alerta
       CASE WHEN COALESCE(stock_minimo,0) <= 0 AND COALESCE(stock,0) <= 0 THEN 'sin configurar'
            WHEN stock <= 0 THEN 'agotado'
            WHEN stock <= stock_minimo THEN 'por agotarse'
            WHEN stock <= stock_minimo * 1.5 THEN 'bajo'
            ELSE 'ok' END AS estado
FROM public.ingredientes;
REVOKE ALL ON public.inventario_estado FROM anon;
GRANT SELECT ON public.inventario_estado TO authenticated, service_role;
