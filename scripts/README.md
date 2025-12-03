# Scripts de Utilidad - ToysWalls

## Excel a SQL

### Descripción
Script para convertir un archivo Excel a sentencias SQL INSERT para llenar el inventario de juguetes.

### Requisitos
```bash
pip install -r requirements.txt
```

### Uso
```bash
python excel_to_sql.py <archivo_excel.xlsx> <empresa_id> [archivo_salida.sql]
```

### Ejemplo
```bash
python excel_to_sql.py inventario.xlsx 1
python excel_to_sql.py inventario.xlsx 1 output.sql
```

### Formato del Excel

El archivo Excel debe tener las siguientes columnas:

#### Columnas Requeridas:
- **nombre**: Nombre del juguete
- **codigo**: Código del juguete
- **cantidad**: Cantidad de juguetes
- **precio_min**: Precio mínimo
- **ubicacion_tipo**: 'bodega' o 'tienda'
- **ubicacion_nombre**: Nombre de la bodega o tienda

#### Columnas Opcionales:
- **item**: Código ITEM del juguete
- **precio_por_mayor**: Precio al por mayor
- **foto_url**: URL de la foto del juguete

### Ejemplo de Excel

| nombre | codigo | item | cantidad | precio_min | precio_por_mayor | foto_url | ubicacion_tipo | ubicacion_nombre |
|--------|--------|------|----------|------------|------------------|----------|----------------|------------------|
| Pelota de Fútbol | JUG-001 | ITM-001 | 50 | 30000 | 25000 | https://... | bodega | Bodega Principal |
| Muñeca | JUG-002 | ITM-002 | 30 | 50000 | 40000 | https://... | tienda | Tienda Centro |

### Notas Importantes

1. **Bodegas y Tiendas**: Asegúrate de que las bodegas y tiendas especificadas en el Excel ya existan en la base de datos antes de ejecutar el SQL generado.

2. **Empresa ID**: Necesitas conocer el ID de tu empresa en la base de datos. Puedes obtenerlo consultando la tabla `empresas`.

3. **Validación**: El script valida que:
   - Todas las columnas requeridas estén presentes
   - `ubicacion_tipo` sea 'bodega' o 'tienda'
   - Los valores numéricos sean válidos

4. **SQL Generado**: El archivo SQL generado contiene:
   - Comentarios con información del archivo origen
   - Sentencias INSERT con subconsultas para obtener IDs de ubicaciones
   - Manejo de valores NULL para campos opcionales

### Ejecutar el SQL Generado

1. Copia el contenido del archivo SQL generado
2. Pégalo en el SQL Editor de Supabase
3. Ejecuta el script completo
4. Verifica que los datos se hayan insertado correctamente








