-- Rollback de 2026_09_30_05_storage_facturas.sql
-- Quita las políticas y la columna xml_path. Los buckets NO se borran (pueden contener XML/fotos);
-- si quieres borrarlos, vacíalos desde el panel de Storage.
BEGIN;
DROP POLICY IF EXISTS "toyswall_facturas_insertar" ON storage.objects;
DROP POLICY IF EXISTS "toyswall_facturas_leer" ON storage.objects;
DROP POLICY IF EXISTS "toyswall_juguetes_insertar" ON storage.objects;
DROP POLICY IF EXISTS "toyswall_juguetes_leer" ON storage.objects;
ALTER TABLE public.facturas DROP COLUMN IF EXISTS xml_path;
COMMIT;

-- VERIFICACIÓN: 0 filas en ambas
SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'toyswall_%';
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'facturas' AND column_name = 'xml_path';
