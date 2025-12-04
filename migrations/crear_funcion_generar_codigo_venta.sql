-- ============================================
-- CREAR FUNCIÓN: generar_codigo_venta
-- ============================================
-- Este script crea la función RPC generar_codigo_venta
-- que es necesaria para generar códigos únicos de venta
-- ============================================
-- INSTRUCCIONES:
-- 1. Copia TODO este archivo
-- 2. Pégalo en el SQL Editor de Supabase
-- 3. Ejecuta el script (Run o Ctrl+Enter)
-- ============================================

-- Función para generar código de venta único
CREATE OR REPLACE FUNCTION generar_codigo_venta()
RETURNS TEXT AS $$
DECLARE
    nuevo_codigo TEXT;
    fecha_actual TEXT;
    contador INTEGER;
    ultimo_codigo TEXT;
    partes TEXT[];
BEGIN
    -- Obtener fecha actual en formato YYYYMMDD
    fecha_actual := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Buscar el último código de venta del día
    SELECT codigo_venta
    INTO ultimo_codigo
    FROM ventas
    WHERE codigo_venta LIKE 'VENT-' || fecha_actual || '-%'
    ORDER BY codigo_venta DESC
    LIMIT 1;
    
    -- Si existe un código del día, extraer el contador
    IF ultimo_codigo IS NOT NULL THEN
        -- Dividir por guiones: VENT-YYYYMMDD-XXX
        partes := string_to_array(ultimo_codigo, '-');
        IF array_length(partes, 1) >= 3 THEN
            contador := CAST(partes[3] AS INTEGER) + 1;
        ELSE
            contador := 1;
        END IF;
    ELSE
        contador := 1;
    END IF;
    
    -- Generar código: VENT-YYYYMMDD-XXX
    nuevo_codigo := 'VENT-' || fecha_actual || '-' || LPAD(contador::TEXT, 3, '0');
    
    RETURN nuevo_codigo;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ✅ Función creada exitosamente
-- ============================================
-- La función generar_codigo_venta() ahora está disponible
-- y generará códigos únicos de venta en formato:
-- VENT-YYYYMMDD-XXX (ej: VENT-20251204-001)
-- ============================================

