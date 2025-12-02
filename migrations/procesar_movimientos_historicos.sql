-- ============================================
-- SCRIPT: Procesar Movimientos Históricos
-- Toys Walls - Sistema de Inventario
-- ============================================
-- Este script procesa movimientos históricos que solo están registrados
-- en la tabla movimientos pero no se reflejaron en el inventario
-- ============================================

-- Función para procesar un movimiento individual
DO $$
DECLARE
    movimiento_record RECORD;
    juguete_origen RECORD;
    juguete_destino RECORD;
    nueva_cantidad_origen INTEGER;
    nueva_cantidad_destino INTEGER;
    juguete_id_destino INTEGER;
    movimientos_procesados INTEGER := 0;
    movimientos_error INTEGER := 0;
BEGIN
    -- Procesar cada movimiento en orden cronológico
    -- Nota: Este script funciona tanto con juguete_id como con juguete_codigo
    FOR movimiento_record IN 
        SELECT 
            id,
            tipo_origen,
            origen_id,
            tipo_destino,
            destino_id,
            COALESCE(juguete_codigo, (SELECT codigo FROM juguetes WHERE id = juguete_id LIMIT 1)) as juguete_codigo,
            cantidad,
            empresa_id,
            created_at
        FROM movimientos
        WHERE empresa_id = 1
        ORDER BY created_at ASC, id ASC
    LOOP
        BEGIN
            -- Obtener el juguete en el origen (buscar por código)
            SELECT * INTO juguete_origen
            FROM juguetes
            WHERE codigo = movimiento_record.juguete_codigo
            AND empresa_id = movimiento_record.empresa_id;
            
            -- Si el juguete no existe, saltar este movimiento
            IF NOT FOUND THEN
                RAISE NOTICE 'Movimiento %: Juguete con código % no encontrado, saltando...', movimiento_record.id, movimiento_record.juguete_codigo;
                movimientos_error := movimientos_error + 1;
                CONTINUE;
            END IF;
            
            -- Verificar que el juguete esté en la ubicación de origen correcta
            IF movimiento_record.tipo_origen = 'bodega' THEN
                IF juguete_origen.bodega_id IS NULL OR juguete_origen.bodega_id != movimiento_record.origen_id THEN
                    RAISE NOTICE 'Movimiento %: Juguete % no está en bodega %, saltando...', 
                        movimiento_record.id, movimiento_record.juguete_codigo, movimiento_record.origen_id;
                    movimientos_error := movimientos_error + 1;
                    CONTINUE;
                END IF;
            ELSIF movimiento_record.tipo_origen = 'tienda' THEN
                IF juguete_origen.tienda_id IS NULL OR juguete_origen.tienda_id != movimiento_record.origen_id THEN
                    RAISE NOTICE 'Movimiento %: Juguete % no está en tienda %, saltando...', 
                        movimiento_record.id, movimiento_record.juguete_codigo, movimiento_record.origen_id;
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
                -- Si existe, sumar cantidad
                nueva_cantidad_destino := juguete_destino.cantidad + movimiento_record.cantidad;
                UPDATE juguetes
                SET cantidad = nueva_cantidad_destino
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
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Error procesando movimiento %: %', movimiento_record.id, SQLERRM;
                movimientos_error := movimientos_error + 1;
        END;
    END LOOP;
    
    RAISE NOTICE 'Procesamiento completado: % movimientos procesados, % errores', movimientos_procesados, movimientos_error;
END $$;

-- ============================================
-- NOTA: Este script procesa los movimientos en orden cronológico
-- Si hay movimientos duplicados o conflictos, algunos pueden fallar
-- Revisa los mensajes NOTICE para ver qué movimientos tuvieron problemas
-- ============================================

