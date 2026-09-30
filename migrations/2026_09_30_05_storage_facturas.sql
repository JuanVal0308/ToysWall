-- =====================================================================
-- 2026_09_30_05_storage_facturas.sql
-- Arregla la subida del XML de la factura (error 400 "Bucket not found"):
--   * crea el bucket privado "facturas" (máx. 1 MB, solo XML) y el bucket público "juguetes" (fotos) si faltan;
--   * políticas de storage: solo usuarios con sesión activa pueden subir/leer XML y subir fotos;
--   * facturas.xml_path guarda la ruta del XML dentro del bucket (el enlace del correo es una URL firmada).
-- Requiere 01 (privado.es_usuario_activo). Idempotente.
-- =====================================================================
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('facturas', 'facturas', false, 1048576, ARRAY['application/xml', 'text/xml'])
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Las fotos se ven desde la tienda sin sesión, por eso este bucket es público (no se modifica si ya existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('juguetes', 'juguetes', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "toyswall_facturas_insertar" ON storage.objects;
CREATE POLICY "toyswall_facturas_insertar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'facturas' AND privado.es_usuario_activo());

DROP POLICY IF EXISTS "toyswall_facturas_leer" ON storage.objects;
CREATE POLICY "toyswall_facturas_leer" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'facturas' AND privado.es_usuario_activo());

DROP POLICY IF EXISTS "toyswall_juguetes_insertar" ON storage.objects;
CREATE POLICY "toyswall_juguetes_insertar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'juguetes' AND privado.es_usuario_activo());

DROP POLICY IF EXISTS "toyswall_juguetes_leer" ON storage.objects;
CREATE POLICY "toyswall_juguetes_leer" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'juguetes' AND privado.es_usuario_activo());

ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS xml_path text;
COMMENT ON COLUMN public.facturas.xml_path IS 'Ruta del XML en el bucket privado "facturas" (NULL si la subida falló)';

COMMIT;

-- VERIFICACIÓN: bucket facturas privado, 4 políticas y columna xml_path
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id IN ('facturas', 'juguetes') ORDER BY id;
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'toyswall_%' ORDER BY 1;
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facturas' AND column_name = 'xml_path';
