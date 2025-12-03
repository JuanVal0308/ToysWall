-- ============================================
-- SCRIPT: Procesar Movimientos Específicos
-- Toys Walls - Sistema de Inventario
-- ============================================
-- Este script procesa movimientos específicos que solo están registrados
-- en la tabla movimientos pero no se reflejaron en el inventario
-- ============================================

-- Primero, asegúrate de que estos movimientos existan en la tabla movimientos
-- Si no existen, insértalos primero (usa la sintaxis correcta de PostgreSQL)

-- Función para procesar movimientos específicos por ID
DO $$
DECLARE
    movimiento_id INTEGER;
    movimiento_record RECORD;
    juguete_origen RECORD;
    juguete_destino RECORD;
    nueva_cantidad_origen INTEGER;
    nueva_cantidad_destino INTEGER;
    movimientos_procesados INTEGER := 0;
    movimientos_error INTEGER := 0;
    movimientos_ids INTEGER[] := ARRAY[
        218, 219, 225, 231, 237, 243, 249, 255, 261, 267, 275, 283, 291, 299, 307, 315, 323, 331, 339, 347, 351, 359, 367, 377, 387, 397, 407, 417, 422, 427, 432, 442, 452, 462, 467, 477, 487, 497, 509, 515, 46, 47, 48, 50, 52, 54, 56, 58, 60, 64, 66, 68, 70, 72, 75, 78, 81, 84, 87, 93, 99, 105, 112, 117, 123, 132, 139, 144, 146, 147, 148, 149
    ];
BEGIN
    -- Procesar cada movimiento por ID
    FOREACH movimiento_id IN ARRAY movimientos_ids
    LOOP
        BEGIN
            -- Obtener el movimiento (incluir tanto juguete_id como juguete_codigo si existen)
            SELECT 
                id,
                tipo_origen,
                origen_id,
                tipo_destino,
                destino_id,
                juguete_id,
                juguete_codigo,
                cantidad,
                empresa_id,
                created_at
            INTO movimiento_record
            FROM movimientos
            WHERE id = movimiento_id
            AND empresa_id = 1;
            
            -- Si el movimiento no existe, saltar
            IF NOT FOUND THEN
                RAISE NOTICE 'Movimiento %: No encontrado, saltando...', movimiento_id;
                movimientos_error := movimientos_error + 1;
                CONTINUE;
            END IF;
            
            -- Obtener el código del juguete (puede estar en juguete_codigo o necesitamos buscarlo por juguete_id)
            juguete_codigo_val := NULL;
            
            -- Intentar obtener código directamente o desde juguete_id
            IF movimiento_record.juguete_codigo IS NOT NULL THEN
                juguete_codigo_val := movimiento_record.juguete_codigo;
            ELSIF movimiento_record.juguete_id IS NOT NULL THEN
                SELECT codigo INTO juguete_codigo_val
                FROM juguetes
                WHERE id = movimiento_record.juguete_id
                AND empresa_id = movimiento_record.empresa_id
                LIMIT 1;
            END IF;
            
            IF juguete_codigo_val IS NULL THEN
                RAISE NOTICE 'Movimiento %: No se pudo obtener código del juguete, saltando...', movimiento_record.id;
                movimientos_error := movimientos_error + 1;
                CONTINUE;
            END IF;
            
            -- Obtener el juguete en el origen (buscar por código)
            SELECT * INTO juguete_origen
            FROM juguetes
            WHERE codigo = juguete_codigo_val
            AND empresa_id = movimiento_record.empresa_id;
            
            -- Si el juguete no existe, saltar este movimiento
            IF NOT FOUND THEN
                RAISE NOTICE 'Movimiento %: Juguete con código % no encontrado, saltando...', movimiento_record.id, juguete_codigo_val;
                movimientos_error := movimientos_error + 1;
                CONTINUE;
            END IF;
            
            -- Verificar que el juguete esté en la ubicación de origen correcta
            IF movimiento_record.tipo_origen = 'bodega' THEN
                IF juguete_origen.bodega_id IS NULL OR juguete_origen.bodega_id != movimiento_record.origen_id THEN
                    RAISE NOTICE 'Movimiento %: Juguete % no está en bodega %, saltando...', 
                        movimiento_record.id, juguete_codigo_val, movimiento_record.origen_id;
                    movimientos_error := movimientos_error + 1;
                    CONTINUE;
                END IF;
            ELSIF movimiento_record.tipo_origen = 'tienda' THEN
                IF juguete_origen.tienda_id IS NULL OR juguete_origen.tienda_id != movimiento_record.origen_id THEN
                    RAISE NOTICE 'Movimiento %: Juguete % no está en tienda %, saltando...', 
                        movimiento_record.id, juguete_codigo_val, movimiento_record.origen_id;
                    movimientos_error := movimientos_error + 1;
                    CONTINUE;
                END IF;
            END IF;
            
            -- Calcular nueva cantidad en origen
            nueva_cantidad_origen := juguete_origen.cantidad - movimiento_record.cantidad;
            
            -- Verificar que haya suficiente cantidad
            IF nueva_cantidad_origen < 0 THEN
                RAISE NOTICE 'Movimiento %: Cantidad insuficiente en origen (disponible: %, requerida: %), saltando...', 
                    movimiento_record.id, juguete_origen.cantidad, movimiento_record.cantidad;
                movimientos_error := movimientos_error + 1;
                CONTINUE;
            END IF;
            
            -- Buscar juguete en destino
            IF movimiento_record.tipo_destino = 'bodega' THEN
                SELECT * INTO juguete_destino
                FROM juguetes
                WHERE codigo = juguete_origen.codigo
                AND nombre = juguete_origen.nombre
                AND bodega_id = movimiento_record.destino_id
                AND empresa_id = movimiento_record.empresa_id
                LIMIT 1;
            ELSE
                SELECT * INTO juguete_destino
                FROM juguetes
                WHERE codigo = juguete_origen.codigo
                AND nombre = juguete_origen.nombre
                AND tienda_id = movimiento_record.destino_id
                AND empresa_id = movimiento_record.empresa_id
                LIMIT 1;
            END IF;
            
            -- Actualizar origen
            IF nueva_cantidad_origen = 0 THEN
                -- Eliminar registro si cantidad llega a 0
                DELETE FROM juguetes WHERE id = juguete_origen.id;
            ELSE
                -- Actualizar cantidad
                UPDATE juguetes
                SET cantidad = nueva_cantidad_origen
                WHERE id = juguete_origen.id;
            END IF;
            
            -- Actualizar o crear destino
            IF FOUND AND juguete_destino.id IS NOT NULL THEN
                -- Si existe, sumar cantidad y completar datos faltantes (precios, foto, item, bultos)
                nueva_cantidad_destino := juguete_destino.cantidad + movimiento_record.cantidad;
                UPDATE juguetes
                SET cantidad = nueva_cantidad_destino,
                    foto_url = COALESCE(juguete_destino.foto_url, juguete_origen.foto_url),
                    precio_min = COALESCE(juguete_destino.precio_min, juguete_origen.precio_min),
                    precio_por_mayor = COALESCE(juguete_destino.precio_por_mayor, juguete_origen.precio_por_mayor),
                    item = COALESCE(juguete_destino.item, juguete_origen.item),
                    cantidad_por_bulto = COALESCE(juguete_destino.cantidad_por_bulto, juguete_origen.cantidad_por_bulto),
                    numero_bultos = COALESCE(juguete_destino.numero_bultos, juguete_origen.numero_bultos)
                WHERE id = juguete_destino.id;
            ELSE
                -- Si no existe, crear nuevo registro
                INSERT INTO juguetes (
                    nombre,
                    codigo,
                    cantidad,
                    bodega_id,
                    tienda_id,
                    empresa_id,
                    foto_url,
                    precio_min,
                    precio_por_mayor,
                    item,
                    cantidad_por_bulto,
                    numero_bultos
                ) VALUES (
                    juguete_origen.nombre,
                    juguete_origen.codigo,
                    movimiento_record.cantidad,
                    CASE WHEN movimiento_record.tipo_destino = 'bodega' THEN movimiento_record.destino_id ELSE NULL END,
                    CASE WHEN movimiento_record.tipo_destino = 'tienda' THEN movimiento_record.destino_id ELSE NULL END,
                    movimiento_record.empresa_id,
                    juguete_origen.foto_url,
                    juguete_origen.precio_min,
                    juguete_origen.precio_por_mayor,
                    juguete_origen.item,
                    juguete_origen.cantidad_por_bulto,
                    juguete_origen.numero_bultos
                );
            END IF;
            
            movimientos_procesados := movimientos_procesados + 1;
            RAISE NOTICE 'Movimiento % procesado correctamente', movimiento_record.id;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error procesando movimiento %: %', movimiento_id, SQLERRM;
                movimientos_error := movimientos_error + 1;
        END;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Procesamiento completado:';
    RAISE NOTICE '  - Movimientos procesados: %', movimientos_procesados;
    RAISE NOTICE '  - Errores: %', movimientos_error;
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- INSTRUCCIONES:
-- 1. Antes de ejecutar este script, asegúrate de que los movimientos
--    existan en la tabla movimientos. Si no existen, primero ejecuta
--    el script para insertarlos (ver siguiente sección).
-- 2. Este script procesa los movimientos en el orden especificado.
-- 3. Revisa los mensajes NOTICE para ver qué movimientos tuvieron problemas.
-- 4. Si un movimiento falla, los demás continúan procesándose.
-- ============================================

-- ============================================
-- SCRIPT PARA INSERTAR LOS MOVIMIENTOS (si no existen)
-- ============================================
-- Ejecuta esto PRIMERO si los movimientos no están en la base de datos:
-- NOTA: Este script inserta movimientos usando juguete_codigo
-- Si la tabla todavía tiene juguete_id, primero ejecuta la migración cambiar_juguete_id_a_codigo.sql

/*
-- Primero, obtener los códigos de los juguetes desde sus IDs
-- Luego insertar con juguete_codigo
INSERT INTO movimientos (tipo_origen, origen_id, tipo_destino, destino_id, juguete_codigo, cantidad, empresa_id, created_at) 
SELECT 
    'bodega'::VARCHAR(20),
    1,
    'tienda'::VARCHAR(20),
    1,
    j.codigo,
    120,
    1,
    '2025-12-01 21:36:17.846564+00'::TIMESTAMP WITH TIME ZONE
FROM juguetes j WHERE j.id = 172 AND j.empresa_id = 1
UNION ALL
SELECT 'bodega', 1, 'tienda', 1, j.codigo, 18, 1, '2025-12-01 21:43:08.498809+00'::TIMESTAMP WITH TIME ZONE
FROM juguetes j WHERE j.id = 229 AND j.empresa_id = 1
-- ... (continuar para todos los movimientos)
*/

-- Versión simplificada: Si ya tienes los códigos de los juguetes, usa esta:
/*
INSERT INTO movimientos (tipo_origen, origen_id, tipo_destino, destino_id, juguete_codigo, cantidad, empresa_id, created_at) VALUES
('bodega', 1, 'tienda', 1, 172, 120, 1, '2025-12-01 21:36:17.846564+00'),
('bodega', 1, 'tienda', 1, 229, 18, 1, '2025-12-01 21:43:08.498809+00'),
('bodega', 1, 'tienda', 1, 225, 36, 1, '2025-12-01 21:44:51.664056+00'),
('bodega', 1, 'tienda', 1, 304, 24, 1, '2025-12-01 21:51:59.810189+00'),
('bodega', 1, 'tienda', 1, 305, 24, 1, '2025-12-01 22:04:49.264096+00'),
('bodega', 1, 'tienda', 1, 274, 12, 1, '2025-12-01 22:05:49.577969+00'),
('bodega', 1, 'tienda', 1, 265, 6, 1, '2025-12-01 22:17:03.980246+00'),
('bodega', 1, 'tienda', 1, 316, 12, 1, '2025-12-01 22:19:22.294705+00'),
('bodega', 1, 'tienda', 1, 272, 36, 1, '2025-12-01 22:24:48.462395+00'),
('bodega', 1, 'tienda', 1, 280, 40, 1, '2025-12-01 22:27:22.785114+00'),
('bodega', 1, 'tienda', 1, 281, 40, 1, '2025-12-01 22:27:25.059759+00'),
('bodega', 1, 'tienda', 1, 290, 22, 1, '2025-12-01 22:30:36.600572+00'),
('bodega', 1, 'tienda', 1, 282, 24, 1, '2025-12-01 22:42:14.907701+00'),
('bodega', 1, 'tienda', 1, 254, 6, 1, '2025-12-01 22:49:05.404933+00'),
('bodega', 1, 'tienda', 1, 255, 6, 1, '2025-12-01 22:49:07.040168+00'),
('bodega', 1, 'tienda', 1, 312, 48, 1, '2025-12-01 22:54:57.578119+00'),
('bodega', 1, 'tienda', 1, 228, 6, 1, '2025-12-01 22:56:33.067697+00'),
('bodega', 1, 'tienda', 1, 222, 16, 1, '2025-12-01 23:00:04.938603+00'),
('bodega', 1, 'tienda', 1, 237, 18, 1, '2025-12-01 23:05:03.836305+00'),
('bodega', 1, 'tienda', 1, 170, 36, 1, '2025-12-01 23:10:11.90045+00'),
('bodega', 1, 'tienda', 1, 260, 12, 1, '2025-12-01 23:11:47.78754+00'),
('bodega', 1, 'tienda', 1, 262, 8, 1, '2025-12-01 23:12:49.882997+00'),
('bodega', 1, 'tienda', 1, 297, 36, 1, '2025-12-01 23:16:27.48325+00'),
('bodega', 1, 'tienda', 1, 292, 22, 1, '2025-12-01 23:20:28.945041+00'),
('bodega', 1, 'tienda', 1, 214, 12, 1, '2025-12-01 23:23:36.16554+00'),
('bodega', 1, 'bodega', 1, 308, 18, 1, '2025-12-01 23:27:19.563126+00'),
('bodega', 1, 'tienda', 1, 227, 12, 1, '2025-12-01 23:29:23.344305+00'),
('bodega', 1, 'tienda', 1, 258, 18, 1, '2025-12-01 23:34:35.238134+00'),
('bodega', 1, 'tienda', 1, 322, 24, 1, '2025-12-01 23:34:59.545528+00'),
('bodega', 1, 'tienda', 1, 322, 24, 1, '2025-12-01 23:35:00.04704+00'),
('bodega', 1, 'tienda', 1, 321, 12, 1, '2025-12-02 00:02:44.232667+00'),
('bodega', 1, 'tienda', 1, 236, 24, 1, '2025-12-02 00:04:35.469507+00'),
('bodega', 1, 'tienda', 1, 243, 12, 1, '2025-12-02 00:06:58.516252+00'),
('bodega', 1, 'tienda', 1, 248, 120, 1, '2025-12-02 00:11:46.826015+00'),
('bodega', 1, 'tienda', 1, 259, 18, 1, '2025-12-02 00:12:57.610252+00'),
('bodega', 1, 'tienda', 1, 245, 12, 1, '2025-12-02 00:14:52.843192+00'),
('bodega', 1, 'tienda', 1, 271, 24, 1, '2025-12-02 00:19:43.49446+00'),
('bodega', 1, 'tienda', 1, 223, 12, 1, '2025-12-02 00:21:35.857024+00'),
('bodega', 1, 'tienda', 1, 218, 24, 1, '2025-12-02 00:27:57.260912+00'),
('bodega', 1, 'tienda', 1, 232, 9, 1, '2025-12-02 00:30:25.130773+00'),
('bodega', 1, 'tienda', 1, 294, 12, 1, '2025-12-01 19:14:42.40757+00'),
('bodega', 1, 'tienda', 1, 313, 12, 1, '2025-12-01 19:15:35.33788+00'),
('bodega', 1, 'tienda', 1, 299, 48, 1, '2025-12-01 19:20:11.910845+00'),
('bodega', 1, 'tienda', 1, 191, 62, 1, '2025-12-01 19:21:52.038574+00'),
('bodega', 1, 'tienda', 1, 293, 8, 1, '2025-12-01 19:24:04.278933+00'),
('bodega', 1, 'bodega', 1, 289, 11, 1, '2025-12-01 19:29:14.552248+00'),
('bodega', 1, 'tienda', 1, 303, 16, 1, '2025-12-01 19:30:17.719926+00'),
('bodega', 1, 'tienda', 1, 291, 20, 1, '2025-12-01 19:36:48.806617+00'),
('bodega', 1, 'tienda', 1, 250, 4, 1, '2025-12-01 19:38:29.768987+00'),
('bodega', 1, 'tienda', 1, 301, 36, 1, '2025-12-01 19:40:38.868488+00'),
('bodega', 1, 'tienda', 1, 253, 9, 1, '2025-12-01 19:44:09.641789+00'),
('bodega', 1, 'tienda', 1, 270, 9, 1, '2025-12-01 19:45:11.048488+00'),
('bodega', 1, 'tienda', 1, 309, 48, 1, '2025-12-01 19:47:39.350383+00'),
('bodega', 1, 'tienda', 1, 217, 12, 1, '2025-12-01 19:58:36.249+00'),
('bodega', 1, 'tienda', 1, 240, 8, 1, '2025-12-01 20:01:31.004557+00'),
('bodega', 1, 'tienda', 1, 298, 18, 1, '2025-12-01 20:02:40.211282+00'),
('bodega', 1, 'tienda', 1, 318, 42, 1, '2025-12-01 20:08:13.161674+00'),
('bodega', 1, 'tienda', 1, 302, 48, 1, '2025-12-01 20:10:33.750844+00'),
('bodega', 1, 'tienda', 1, 267, 24, 1, '2025-12-01 20:15:56.791983+00'),
('bodega', 1, 'tienda', 1, 268, 4, 1, '2025-12-01 20:18:07.987372+00'),
('bodega', 1, 'tienda', 1, 183, 36, 1, '2025-12-01 20:22:50.422004+00'),
('bodega', 1, 'tienda', 1, 256, 24, 1, '2025-12-01 20:24:05.666483+00'),
('bodega', 1, 'tienda', 1, 278, 24, 1, '2025-12-01 20:25:54.305434+00'),
('bodega', 1, 'tienda', 1, 287, 48, 1, '2025-12-01 20:28:16.353125+00'),
('bodega', 1, 'tienda', 1, 319, 30, 1, '2025-12-01 20:33:27.981142+00'),
('bodega', 1, 'tienda', 1, 251, 6, 1, '2025-12-01 20:37:59.421645+00'),
('bodega', 1, 'tienda', 1, 219, 24, 1, '2025-12-01 20:39:23.381111+00'),
('bodega', 1, 'tienda', 1, 288, 15, 1, '2025-12-01 20:41:18.477226+00'),
('bodega', 1, 'tienda', 1, 288, 15, 1, '2025-12-01 20:41:18.509306+00'),
('bodega', 1, 'tienda', 1, 288, 15, 1, '2025-12-01 20:41:18.514227+00'),
('bodega', 1, 'tienda', 1, 288, 15, 1, '2025-12-01 20:41:18.516531+00'),
('bodega', 1, 'tienda', 1, 288, 15, 1, '2025-12-01 20:41:18.51982+00')
ON CONFLICT (id) DO NOTHING;
*/

