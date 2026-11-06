-- =====================================================================
-- Destinatarios de reportes por Telegram
-- Ejecutar en Supabase > SQL Editor (después de supabase_setup.sql)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.destinatarios_reportes (
    id            BIGSERIAL PRIMARY KEY,
    nombre        TEXT NOT NULL,                 -- "Dueño", "Admin Carlos"
    rol           TEXT NOT NULL DEFAULT 'admin', -- dueno | admin | cocina | caja
    chat_id       TEXT NOT NULL UNIQUE,          -- chat_id de Telegram (no es el número de teléfono)
    recibe_diario BOOLEAN NOT NULL DEFAULT TRUE, -- cierre del día
    recibe_stock  BOOLEAN NOT NULL DEFAULT TRUE, -- alertas de stock bajo
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Los chat_id son datos personales: SIN acceso para anon/authenticated.
-- Solo n8n (con la service_role key) puede leer esta tabla.
ALTER TABLE public.destinatarios_reportes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.destinatarios_reportes FROM anon, authenticated;

-- Ejemplo (reemplazar por el chat_id real que devuelve el bot con /start):
-- INSERT INTO public.destinatarios_reportes (nombre, rol, chat_id) VALUES ('Dueño', 'dueno', '123456789');
