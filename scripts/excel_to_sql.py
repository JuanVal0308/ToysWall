"""
Script para convertir archivo Excel a SQL INSERT statements
Para llenar el inventario de juguetes en ToysWalls

Uso:
    python excel_to_sql.py archivo.xlsx empresa_id

El archivo Excel debe tener las siguientes columnas (en español):
    - Nombre: Nombre del juguete
    - Codigo: Código del juguete
    - ITEM: Código ITEM (opcional)
    - Numero de bultos: Número de bultos
    - Cantidad por bultos: Cantidad por bulto
    - Cantidad TOTAL: Cantidad total (se calcula si no existe: Numero de bultos * Cantidad por bultos)
    - PRECIO MINIMO: Precio mínimo
    - Precio al por mayor: Precio al por mayor (opcional)
    - Foto URL: URL de la foto (opcional)
    - Ubicación: Formato "Bodega/ nombre" o "Tienda/ nombre"
"""

import pandas as pd
import sys
import os
import re
from datetime import datetime

def excel_to_sql(excel_file, empresa_id, output_file=None):
    """
    Convierte un archivo Excel a SQL INSERT statements
    
    Args:
        excel_file: Ruta al archivo Excel
        empresa_id: ID de la empresa
        output_file: Archivo de salida (opcional, por defecto genera nombre automático)
    """
    try:
        # Leer el archivo Excel
        df = pd.read_excel(excel_file)
        
        # Normalizar nombres de columnas (eliminar espacios, convertir a minúsculas)
        df.columns = df.columns.str.strip()
        
        # Mapeo de nombres de columnas posibles
        column_mapping = {
            'nombre': ['nombre', 'name'],
            'codigo': ['codigo', 'código', 'code'],
            'item': ['item', 'item code'],
            'numero_bultos': ['numero de bultos', 'número de bultos', 'numero_bultos', 'bultos', 'numero bultos', 'nro de bultos', 'nro bultos', 'cantidad de bultos'],
            'cantidad_por_bulto': ['cantidad por bultos', 'cantidad por bulto', 'cantidad_por_bulto', 'cantidad/bulto', 'unidades por bulto', 'unidades/bulto', 'cantidad x bulto'],
            'cantidad_total': ['cantidad total', 'cantidad_total', 'total', 'cantidad total'],
            'precio_min': ['precio minimo', 'precio mínimo', 'precio_min', 'precio_minimo', 'precio min', 'precio minimo'],
            'precio_por_mayor': ['precio al por mayor', 'precio_por_mayor', 'precio por mayor', 'precio al por mayor'],
            'foto_url': ['foto url', 'foto_url', 'url foto', 'url', 'foto url'],
            'ubicacion': ['ubicación', 'ubicacion', 'location', 'ubicación']
        }
        
        # Buscar y renombrar columnas
        normalized_columns = {}
        for standard_name, possible_names in column_mapping.items():
            for col in df.columns:
                if col.lower() in [name.lower() for name in possible_names]:
                    normalized_columns[col] = standard_name
                    break
        
        # Renombrar columnas
        df = df.rename(columns=normalized_columns)
        
        # Validar columnas requeridas
        required_columns = ['nombre', 'codigo', 'precio_min', 'ubicacion']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            print(f"Error: Faltan las siguientes columnas requeridas: {', '.join(missing_columns)}")
            print(f"\nColumnas encontradas en el Excel: {', '.join(df.columns.tolist())}")
            print(f"\nColumnas esperadas (en español):")
            print("  - Nombre")
            print("  - Codigo")
            print("  - PRECIO MINIMO")
            print("  - Ubicación (formato: 'Bodega/ nombre' o 'Tienda/ nombre')")
            print("\nColumnas opcionales:")
            print("  - ITEM")
            print("  - Numero de bultos")
            print("  - Cantidad por bultos")
            print("  - Cantidad TOTAL")
            print("  - Precio al por mayor")
            print("  - Foto URL")
            return False
        
        # Generar nombre de archivo de salida si no se proporciona
        if not output_file:
            base_name = os.path.splitext(os.path.basename(excel_file))[0]
            output_file = f"sql_inserts_{base_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        
        # Abrir archivo de salida
        with open(output_file, 'w', encoding='utf-8') as f:
            # Escribir encabezado
            f.write(f"-- ============================================\n")
            f.write(f"-- SQL GENERADO DESDE EXCEL\n")
            f.write(f"-- Archivo: {os.path.basename(excel_file)}\n")
            f.write(f"-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- Empresa ID: {empresa_id}\n")
            f.write(f"-- ============================================\n\n")
            
            f.write("-- Primero, obtener los IDs de bodegas y tiendas\n")
            f.write("-- Asegúrate de que las bodegas y tiendas existan antes de ejecutar estos INSERTs\n\n")
            
            # Procesar cada fila
            registros_procesados = 0
            for index, row in df.iterrows():
                try:
                    nombre = str(row['nombre']).strip().replace("'", "''")
                    codigo = str(row['codigo']).strip().replace("'", "''")
                    
                    # Calcular cantidad: usar Cantidad TOTAL si existe, sino calcular desde bultos
                    cantidad = 0
                    if 'cantidad_total' in df.columns and pd.notna(row.get('cantidad_total')):
                        cantidad_val = str(row['cantidad_total']).strip()
                        # Remover puntos y comas, convertir a entero
                        cantidad_val = re.sub(r'[^\d]', '', cantidad_val)
                        cantidad = int(cantidad_val) if cantidad_val else 0
                    elif 'numero_bultos' in df.columns and 'cantidad_por_bulto' in df.columns:
                        numero_bultos_str = str(row['numero_bultos']).strip() if pd.notna(row.get('numero_bultos')) else '0'
                        cantidad_por_bulto_str = str(row['cantidad_por_bulto']).strip() if pd.notna(row.get('cantidad_por_bulto')) else '0'
                        numero_bultos = int(re.sub(r'[^\d]', '', numero_bultos_str)) if numero_bultos_str else 0
                        cantidad_por_bulto = int(re.sub(r'[^\d]', '', cantidad_por_bulto_str)) if cantidad_por_bulto_str else 0
                        cantidad = numero_bultos * cantidad_por_bulto
                    
                    if cantidad == 0:
                        print(f"Advertencia: Fila {index + 2}: Cantidad es 0. Se continuará con 0.")
                    
                    # Procesar precio mínimo (puede tener formato con puntos o comas como separadores de miles)
                    precio_min_str = str(row['precio_min']).strip()
                    # Remover símbolo de dólar y espacios
                    precio_min_str = precio_min_str.replace('$', '').replace(' ', '')
                    # Si tiene comas, asumir que son separadores de miles (formato colombiano)
                    if ',' in precio_min_str and '.' not in precio_min_str:
                        # Formato: "22,684" -> "22684"
                        precio_min_str = precio_min_str.replace(',', '')
                    elif ',' in precio_min_str and '.' in precio_min_str:
                        # Formato: "22,684.50" -> "22684.50"
                        precio_min_str = precio_min_str.replace(',', '')
                    elif '.' in precio_min_str and ',' not in precio_min_str:
                        # Formato: "22.684" -> "22684" (puntos como separadores de miles)
                        precio_min_str = precio_min_str.replace('.', '')
                    # Remover cualquier carácter no numérico excepto punto decimal
                    precio_min_str = re.sub(r'[^\d.]', '', precio_min_str)
                    precio_min = float(precio_min_str) if precio_min_str and precio_min_str != 'nan' else 0
                    
                    # Procesar ubicación (formatos: "Bodega/ nombre", "Bodega nombre", "Tienda/ nombre", "Tienda nombre")
                    ubicacion_str = str(row['ubicacion']).strip()
                    ubicacion_tipo = None
                    ubicacion_nombre = None
                    
                    if '/' in ubicacion_str:
                        # Formato: "Bodega/ nombre" o "Tienda/ nombre"
                        partes = ubicacion_str.split('/', 1)
                        ubicacion_tipo = partes[0].strip().lower()
                        ubicacion_nombre = partes[1].strip().replace("'", "''")
                    else:
                        # Formato: "Bodega nombre" o "Tienda nombre" (sin "/")
                        palabras = ubicacion_str.split()
                        if len(palabras) >= 2:
                            primera_palabra = palabras[0].lower()
                            if primera_palabra in ['bodega', 'tienda']:
                                ubicacion_tipo = primera_palabra
                                ubicacion_nombre = ' '.join(palabras[1:]).strip().replace("'", "''")
                    
                    if not ubicacion_tipo or not ubicacion_nombre:
                        print(f"Advertencia: Fila {index + 2}: Formato de ubicación incorrecto: '{ubicacion_str}'. Se omite.")
                        continue
                    
                    # Validar ubicacion_tipo
                    if ubicacion_tipo not in ['bodega', 'tienda']:
                        print(f"Advertencia: Fila {index + 2}: Tipo de ubicación debe ser 'Bodega' o 'Tienda'. Se omite.")
                        continue
                    
                    # Campos opcionales
                    item = 'NULL'
                    if 'item' in df.columns and pd.notna(row.get('item')):
                        item_val = str(row['item']).strip().replace("'", "''")
                        if item_val and item_val.lower() != 'nan' and item_val != '':
                            item = f"'{item_val}'"
                    
                    # Procesar campos de bultos
                    numero_bultos = None
                    if 'numero_bultos' in df.columns and pd.notna(row.get('numero_bultos')):
                        numero_bultos_str = str(row['numero_bultos']).strip()
                        numero_bultos_str = re.sub(r'[^\d]', '', numero_bultos_str)
                        if numero_bultos_str and numero_bultos_str.lower() != 'nan':
                            numero_bultos = int(numero_bultos_str)
                    
                    cantidad_por_bulto = None
                    if 'cantidad_por_bulto' in df.columns and pd.notna(row.get('cantidad_por_bulto')):
                        cantidad_por_bulto_str = str(row['cantidad_por_bulto']).strip()
                        cantidad_por_bulto_str = re.sub(r'[^\d]', '', cantidad_por_bulto_str)
                        if cantidad_por_bulto_str and cantidad_por_bulto_str.lower() != 'nan':
                            cantidad_por_bulto = int(cantidad_por_bulto_str)
                    
                    precio_por_mayor = None
                    if 'precio_por_mayor' in df.columns and pd.notna(row.get('precio_por_mayor')):
                        precio_por_mayor_str = str(row['precio_por_mayor']).strip()
                        # Remover símbolo de dólar y espacios
                        precio_por_mayor_str = precio_por_mayor_str.replace('$', '').replace(' ', '')
                        # Si tiene comas, asumir que son separadores de miles (formato colombiano)
                        if ',' in precio_por_mayor_str and '.' not in precio_por_mayor_str:
                            precio_por_mayor_str = precio_por_mayor_str.replace(',', '')
                        elif ',' in precio_por_mayor_str and '.' in precio_por_mayor_str:
                            precio_por_mayor_str = precio_por_mayor_str.replace(',', '')
                        elif '.' in precio_por_mayor_str and ',' not in precio_por_mayor_str:
                            precio_por_mayor_str = precio_por_mayor_str.replace('.', '')
                        precio_por_mayor_str = re.sub(r'[^\d.]', '', precio_por_mayor_str)
                        if precio_por_mayor_str and precio_por_mayor_str.lower() != 'nan':
                            precio_por_mayor = float(precio_por_mayor_str)
                    
                    foto_url = 'NULL'
                    if 'foto_url' in df.columns and pd.notna(row.get('foto_url')):
                        foto_url_val = str(row['foto_url']).strip().replace("'", "''")
                        if foto_url_val and foto_url_val.lower() != 'nan' and foto_url_val.startswith('http'):
                            foto_url = f"'{foto_url_val}'"
                    
                    # Generar SQL con subconsulta para obtener el ID de la ubicación (case-insensitive)
                    if ubicacion_tipo == 'bodega':
                        ubicacion_id_query = f"(SELECT id FROM bodegas WHERE LOWER(nombre) = LOWER('{ubicacion_nombre}') AND empresa_id = {empresa_id} LIMIT 1)"
                        bodega_id = ubicacion_id_query
                        tienda_id = 'NULL'
                    else:
                        ubicacion_id_query = f"(SELECT id FROM tiendas WHERE LOWER(nombre) = LOWER('{ubicacion_nombre}') AND empresa_id = {empresa_id} LIMIT 1)"
                        bodega_id = 'NULL'
                        tienda_id = ubicacion_id_query
                    
                    # Construir precio_por_mayor
                    precio_por_mayor_sql = f"{precio_por_mayor}" if precio_por_mayor is not None else 'NULL'
                    
                    # Construir campos de bultos
                    numero_bultos_sql = f"{numero_bultos}" if numero_bultos is not None else 'NULL'
                    cantidad_por_bulto_sql = f"{cantidad_por_bulto}" if cantidad_por_bulto is not None else 'NULL'
                    
                    # Generar INSERT statement
                    sql = f"""INSERT INTO juguetes (
    nombre, codigo, item, cantidad, foto_url, precio_min, precio_por_mayor, 
    numero_bultos, cantidad_por_bulto,
    empresa_id, bodega_id, tienda_id, created_at, updated_at
) VALUES (
    '{nombre}',
    '{codigo}',
    {item},
    {cantidad},
    {foto_url},
    {precio_min},
    {precio_por_mayor_sql},
    {numero_bultos_sql},
    {cantidad_por_bulto_sql},
    {empresa_id},
    {bodega_id},
    {tienda_id},
    NOW(),
    NOW()
);

"""
                    f.write(sql)
                    registros_procesados += 1
                    
                except Exception as e:
                    print(f"Error procesando fila {index + 2}: {str(e)}")
                    continue
            
            f.write("\n-- ============================================\n")
            f.write("-- FIN DE LOS INSERTS\n")
            f.write("-- ============================================\n")
        
        print(f"✓ SQL generado exitosamente: {output_file}")
        print(f"✓ Total de registros procesados: {registros_procesados} de {len(df)}")
        return True
        
    except Exception as e:
        print(f"Error al procesar el archivo: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    if len(sys.argv) < 3:
        print("Uso: python excel_to_sql.py <archivo_excel.xlsx> <empresa_id> [archivo_salida.sql]")
        print("\nEjemplo:")
        print("  python excel_to_sql.py inventario.xlsx 1")
        print("  python excel_to_sql.py inventario.xlsx 1 output.sql")
        sys.exit(1)
    
    excel_file = sys.argv[1]
    empresa_id = int(sys.argv[2])
    output_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    if not os.path.exists(excel_file):
        print(f"Error: El archivo {excel_file} no existe")
        sys.exit(1)
    
    excel_to_sql(excel_file, empresa_id, output_file)

if __name__ == "__main__":
    main()
