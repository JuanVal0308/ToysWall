-- ============================================
-- Script para corregir restricciones ON DELETE
-- Permite eliminar juguetes directamente en Supabase
-- ============================================

-- Eliminar las restricciones de clave foránea existentes
ALTER TABLE IF EXISTS movimientos 
    DROP CONSTRAINT IF EXISTS movimientos_juguete_id_fkey;

ALTER TABLE IF EXISTS ventas 
    DROP CONSTRAINT IF EXISTS ventas_juguete_id_fkey;

-- Recrear las restricciones con ON DELETE CASCADE
-- Esto permitirá eliminar juguetes y automáticamente eliminará
-- los movimientos y ventas relacionados

ALTER TABLE movimientos
    ADD CONSTRAINT movimientos_juguete_id_fkey 
    FOREIGN KEY (juguete_id) 
    REFERENCES juguetes(id) 
    ON DELETE CASCADE;

ALTER TABLE ventas
    ADD CONSTRAINT ventas_juguete_id_fkey 
    FOREIGN KEY (juguete_id) 
    REFERENCES juguetes(id) 
    ON DELETE CASCADE;

-- Verificar que las restricciones se crearon correctamente
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('movimientos', 'ventas')
    AND ccu.table_name = 'juguetes'
ORDER BY tc.table_name, tc.constraint_name;


