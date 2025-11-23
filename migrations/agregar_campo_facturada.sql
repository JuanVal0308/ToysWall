-- Script para agregar campo facturada a la tabla ventas
-- Esto permite verificar si una venta ya fue facturada

-- Agregar columna facturada si no existe
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS facturada BOOLEAN DEFAULT FALSE;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_ventas_facturada ON ventas(facturada, codigo_venta);

-- Comentario en la columna
COMMENT ON COLUMN ventas.facturada IS 'Indica si la venta ya fue facturada';

