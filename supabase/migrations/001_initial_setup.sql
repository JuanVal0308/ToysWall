-- Funciones auxiliares para RLS
-- Estas funciones deben crearse en Supabase SQL Editor

-- Función para obtener el empresa_id del usuario actual
CREATE OR REPLACE FUNCTION current_empresa()
RETURNS INTEGER AS $$
  SELECT empresa_id FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Función para obtener el tipo_usuario_id del usuario actual
CREATE OR REPLACE FUNCTION current_tipo_usuario()
RETURNS INTEGER AS $$
  SELECT tipo_usuario_id FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Ejemplo de políticas RLS para la tabla juguetes
-- Habilitar RLS
ALTER TABLE juguetes ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver juguetes de su empresa
CREATE POLICY "Users can view toys from their company"
  ON juguetes FOR SELECT
  USING (empresa_id = current_empresa());

-- Política: Administradores y empresas pueden insertar juguetes
CREATE POLICY "Admins and companies can insert toys"
  ON juguetes FOR INSERT
  WITH CHECK (
    empresa_id = current_empresa() 
    AND (current_tipo_usuario() = 1 OR current_tipo_usuario() = 2)
  );

-- Política: Administradores y empresas pueden actualizar juguetes
CREATE POLICY "Admins and companies can update toys"
  ON juguetes FOR UPDATE
  USING (
    empresa_id = current_empresa() 
    AND (current_tipo_usuario() = 1 OR current_tipo_usuario() = 2)
  );

-- Política: Administradores y empresas pueden eliminar juguetes
CREATE POLICY "Admins and companies can delete toys"
  ON juguetes FOR DELETE
  USING (
    empresa_id = current_empresa() 
    AND (current_tipo_usuario() = 1 OR current_tipo_usuario() = 2)
  );

-- Similar para otras tablas:
-- categorias, tiendas, inventario_tiendas, vendedores, ventas, facturas

-- Ejemplo para ventas (todos pueden ver y crear ventas de su empresa)
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales from their company"
  ON ventas FOR SELECT
  USING (empresa_id = current_empresa());

CREATE POLICY "Users can insert sales for their company"
  ON ventas FOR INSERT
  WITH CHECK (empresa_id = current_empresa());

-- Ejemplo para tiendas (solo administradores pueden gestionar)
ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stores from their company"
  ON tiendas FOR SELECT
  USING (empresa_id = current_empresa());

CREATE POLICY "Admins can manage stores"
  ON tiendas FOR ALL
  USING (
    empresa_id = current_empresa() 
    AND current_tipo_usuario() = 1
  )
  WITH CHECK (
    empresa_id = current_empresa() 
    AND current_tipo_usuario() = 1
  );

