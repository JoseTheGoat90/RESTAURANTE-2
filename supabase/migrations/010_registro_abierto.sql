-- 010: registro de cuentas desde la pantalla de inicio.
-- Cada cuenta nueva recibe un perfil con el "cargo para cuentas nuevas" que define administración
-- (restaurante_config.rol_registro). NULL = registro cerrado: la cuenta se crea pero no tiene acceso.

ALTER TABLE public.restaurante_config ADD COLUMN IF NOT EXISTS rol_registro text DEFAULT 'mesera';
UPDATE public.restaurante_config SET rol_registro = 'mesera' WHERE rol_registro IS NULL;
ALTER TABLE public.restaurante_config DROP CONSTRAINT IF EXISTS restaurante_config_rol_registro_check;
ALTER TABLE public.restaurante_config ADD CONSTRAINT restaurante_config_rol_registro_check
  CHECK (rol_registro IS NULL OR rol_registro IN ('admin','cocina','parrilla','mesera','domicilios','domiciliario'));

CREATE OR REPLACE FUNCTION public.tg_perfil_nueva_cuenta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol TEXT;
BEGIN
  SELECT rol_registro INTO v_rol FROM restaurante_config ORDER BY id LIMIT 1;
  IF v_rol IS NOT NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO perfiles (email, nombre, rol, activo)
    VALUES (LOWER(NEW.email), COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre'), ''), split_part(NEW.email, '@', 1)), v_rol, true)
    ON CONFLICT (email) DO NOTHING;
    INSERT INTO auditoria (usuario, rol, accion, entidad, referencia, detalle)
    VALUES (LOWER(NEW.email), v_rol, 'registro', 'cuenta', LOWER(NEW.email), jsonb_build_object('cargo', v_rol));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- nunca bloquear la creación de la cuenta por el perfil
END $$;
REVOKE ALL ON FUNCTION public.tg_perfil_nueva_cuenta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS perfil_nueva_cuenta ON auth.users;
CREATE TRIGGER perfil_nueva_cuenta AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_perfil_nueva_cuenta();

-- guardar_config ahora también define el cargo de las cuentas nuevas ('' = cerrar registro)
DROP FUNCTION IF EXISTS public.guardar_config(text, int);
CREATE OR REPLACE FUNCTION public.guardar_config(p_nombre text, p_num_mesas int, p_rol_registro text DEFAULT 'mesera')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol TEXT := NULLIF(TRIM(COALESCE(p_rol_registro, '')), '');
BEGIN
  PERFORM _exigir_rol(ARRAY[]::text[]);
  IF COALESCE(TRIM(p_nombre), '') = '' THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Escribe el nombre del restaurante.'); END IF;
  IF p_num_mesas IS NULL OR p_num_mesas < 1 OR p_num_mesas > 100 THEN RETURN jsonb_build_object('ok', false, 'mensaje', 'Número de mesas entre 1 y 100.'); END IF;
  IF v_rol IS NOT NULL AND v_rol NOT IN ('admin','cocina','parrilla','mesera','domicilios','domiciliario') THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Cargo no válido.');
  END IF;
  UPDATE restaurante_config SET nombre = TRIM(p_nombre), num_mesas = p_num_mesas, rol_registro = v_rol, updated_at = now() WHERE id = 1;
  IF NOT FOUND THEN INSERT INTO restaurante_config (id, nombre, num_mesas, rol_registro) VALUES (1, TRIM(p_nombre), p_num_mesas, v_rol); END IF;
  PERFORM _auditar('guardar', 'config', NULL, jsonb_build_object('nombre', p_nombre, 'mesas', p_num_mesas, 'rol_registro', v_rol));
  RETURN jsonb_build_object('ok', true, 'mensaje', 'Configuración guardada. Cuentas nuevas: ' || COALESCE(v_rol, 'registro cerrado') || '.');
END $$;
REVOKE ALL ON FUNCTION public.guardar_config(text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_config(text, int, text) TO authenticated, service_role;
