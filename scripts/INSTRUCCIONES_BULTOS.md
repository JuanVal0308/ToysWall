# Instrucciones para Importar Datos de Bultos

Este documento explica cómo importar los datos de **número de bultos** y **cantidad por bulto** desde un archivo Excel.

## Paso 1: Ejecutar la Migración SQL

Primero, asegúrate de que los campos estén creados en la base de datos:

```sql
-- Ejecutar en Supabase SQL Editor
-- migrations/agregar_campos_bultos.sql
```

## Paso 2: Preparar el Archivo Excel

Tu archivo Excel debe tener al menos estas columnas:

### Columnas Requeridas:
- **Codigo**: Código del juguete (para identificar qué juguete actualizar)

### Columnas Opcionales (al menos una debe estar presente):
- **Numero de bultos**: Número total de bultos
- **Cantidad por bultos**: Cantidad de unidades por bulto

### Variaciones de Nombres Aceptadas:

Para "Numero de bultos":
- Numero de bultos
- Número de bultos
- Numero_bultos
- Bultos
- Numero bultos
- Nro de bultos
- Nro bultos
- Cantidad de bultos

Para "Cantidad por bultos":
- Cantidad por bultos
- Cantidad por bulto
- Cantidad_por_bulto
- Cantidad/bulto
- Unidades por bulto
- Unidades/bulto
- Cantidad x bulto

## Paso 3: Generar SQL de Actualización

Usa el script `actualizar_bultos_desde_excel.py` para generar los UPDATE statements:

```bash
python scripts/actualizar_bultos_desde_excel.py "Inventario 2025 1.xlsx" 1
```

Esto generará un archivo SQL con los UPDATE statements.

## Paso 4: Ejecutar el SQL Generado

1. Abre el archivo SQL generado
2. Cópialo y pégalo en el SQL Editor de Supabase
3. Ejecuta el script

## Ejemplo de Excel

| Codigo | Numero de bultos | Cantidad por bultos |
|--------|------------------|---------------------|
| JUG-001 | 24 | 12 |
| JUG-002 | 30 | 10 |
| JUG-003 | 15 | 20 |

## Notas Importantes

1. **Código debe coincidir**: El código en el Excel debe coincidir exactamente con el código en la base de datos.

2. **Empresa ID**: Asegúrate de usar el ID correcto de tu empresa.

3. **Valores NULL**: Si un juguete no tiene datos de bultos en el Excel, ese campo se dejará como NULL en la base de datos.

4. **Actualización**: Este script actualiza los juguetes existentes. No crea nuevos juguetes.

## Para Nuevos Juguetes

Si estás importando juguetes nuevos, usa el script `excel_to_sql.py` que incluye los campos de bultos automáticamente:

```bash
python scripts/excel_to_sql.py "Inventario 2025 1.xlsx" 1
```

Este script generará INSERT statements que incluyen los campos de bultos si están presentes en el Excel.






