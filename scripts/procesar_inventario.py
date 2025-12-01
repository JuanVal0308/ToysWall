"""
Script mejorado para procesar el archivo Excel del inventario
Este script procesa el archivo y genera SQL directamente
"""

import pandas as pd
import re
import os
from datetime import datetime

def procesar_excel_inventario(excel_file, empresa_id=1):
    """
    Procesa el archivo Excel y genera SQL para insertar en Supabase
    """
    try:
        print(f"Leyendo archivo: {excel_file}")
        df = pd.read_excel(excel_file)
        
        # Normalizar nombres de columnas
        df.columns = df.columns.str.strip()
        
        # Mapeo de columnas
        column_mapping = {
            'nombre': ['nombre', 'name'],
            'codigo': ['codigo', 'código', 'code'],
            'item': ['item', 'item code'],
            'numero_bultos': ['numero de bultos', 'número de bultos', 'numero_bultos', 'bultos', 'numero bultos'],
            'cantidad_por_bulto': ['cantidad por bultos', 'cantidad por bulto', 'cantidad_por_bulto', 'cantidad por bultos'],
            'cantidad_total': ['cantidad total', 'cantidad_total', 'total', 'cantidad total'],
            'precio_min': ['precio minimo', 'precio mínimo', 'precio_min', 'precio_minimo', 'precio min', 'precio minimo'],
            'precio_por_mayor': ['precio al por mayor', 'precio_por_mayor', 'precio por mayor', 'precio al por mayor'],
            'foto_url': ['foto url', 'foto_url', 'url foto', 'url', 'foto url'],
            'ubicacion': ['ubicación', 'ubicacion', 'location', 'ubicación']
        }
        
        # Renombrar columnas
        normalized_columns = {}
        for standard_name, possible_names in column_mapping.items():
            for col in df.columns:
                if col.lower() in [name.lower() for name in possible_names]:
                    normalized_columns[col] = standard_name
                    break
        
        df = df.rename(columns=normalized_columns)
        
        print(f"Columnas detectadas: {', '.join(df.columns.tolist())}")
        
        # Validar columnas requeridas
        required_columns = ['nombre', 'codigo', 'precio_min', 'ubicacion']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            print(f"ERROR: Faltan columnas: {', '.join(missing_columns)}")
            return None
        
        # Generar SQL
        sql_statements = []
        sql_statements.append("-- ============================================")
        sql_statements.append("-- SQL GENERADO DESDE EXCEL")
        sql_statements.append(f"-- Archivo: {os.path.basename(excel_file)}")
        sql_statements.append(f"-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        sql_statements.append(f"-- Empresa ID: {empresa_id}")
        sql_statements.append("-- ============================================\n")
        sql_statements.append("-- IMPORTANTE: Asegúrate de que la bodega 'santa isabel' o 'Santa Isabel' exista en la base de datos\n\n")
        
        registros_procesados = 0
        errores = []
        
        for index, row in df.iterrows():
            try:
                nombre = str(row['nombre']).strip().replace("'", "''")
                codigo = str(row['codigo']).strip().replace("'", "''")
                
                # Calcular cantidad
                cantidad = 0
                if 'cantidad_total' in df.columns and pd.notna(row.get('cantidad_total')):
                    cantidad_val = str(row['cantidad_total']).strip()
                    cantidad_val = re.sub(r'[^\d]', '', cantidad_val)
                    cantidad = int(cantidad_val) if cantidad_val else 0
                elif 'numero_bultos' in df.columns and 'cantidad_por_bulto' in df.columns:
                    numero_bultos_str = str(row['numero_bultos']).strip() if pd.notna(row.get('numero_bultos')) else '0'
                    cantidad_por_bulto_str = str(row['cantidad_por_bulto']).strip() if pd.notna(row.get('cantidad_por_bulto')) else '0'
                    numero_bultos = int(re.sub(r'[^\d]', '', numero_bultos_str)) if numero_bultos_str else 0
                    cantidad_por_bulto = int(re.sub(r'[^\d]', '', cantidad_por_bulto_str)) if cantidad_por_bulto_str else 0
                    cantidad = numero_bultos * cantidad_por_bulto
                
                # Procesar precio mínimo
                precio_min_str = str(row['precio_min']).strip()
                precio_min_str = precio_min_str.replace('$', '').replace(' ', '')
                if ',' in precio_min_str and '.' not in precio_min_str:
                    precio_min_str = precio_min_str.replace(',', '')
                elif ',' in precio_min_str and '.' in precio_min_str:
                    precio_min_str = precio_min_str.replace(',', '')
                elif '.' in precio_min_str and ',' not in precio_min_str:
                    precio_min_str = precio_min_str.replace('.', '')
                precio_min_str = re.sub(r'[^\d.]', '', precio_min_str)
                precio_min = float(precio_min_str) if precio_min_str and precio_min_str != 'nan' else 0
                
                # Procesar ubicación
                ubicacion_str = str(row['ubicacion']).strip()
                ubicacion_tipo = None
                ubicacion_nombre = None
                
                if '/' in ubicacion_str:
                    partes = ubicacion_str.split('/', 1)
                    ubicacion_tipo = partes[0].strip().lower()
                    ubicacion_nombre = partes[1].strip().replace("'", "''")
                else:
                    palabras = ubicacion_str.split()
                    if len(palabras) >= 2:
                        primera_palabra = palabras[0].lower()
                        if primera_palabra in ['bodega', 'tienda']:
                            ubicacion_tipo = primera_palabra
                            ubicacion_nombre = ' '.join(palabras[1:]).strip().replace("'", "''")
                
                if not ubicacion_tipo or not ubicacion_nombre:
                    errores.append(f"Fila {index + 2}: Ubicación inválida: '{ubicacion_str}'")
                    continue
                
                if ubicacion_tipo not in ['bodega', 'tienda']:
                    errores.append(f"Fila {index + 2}: Tipo de ubicación inválido: '{ubicacion_tipo}'")
                    continue
                
                # Campos opcionales
                item = 'NULL'
                if 'item' in df.columns and pd.notna(row.get('item')):
                    item_val = str(row['item']).strip().replace("'", "''")
                    if item_val and item_val.lower() != 'nan' and item_val != '':
                        item = f"'{item_val}'"
                
                precio_por_mayor = None
                if 'precio_por_mayor' in df.columns and pd.notna(row.get('precio_por_mayor')):
                    precio_por_mayor_str = str(row['precio_por_mayor']).strip()
                    precio_por_mayor_str = precio_por_mayor_str.replace('$', '').replace(' ', '')
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
                
                # Generar SQL
                if ubicacion_tipo == 'bodega':
                    bodega_id = f"(SELECT id FROM bodegas WHERE LOWER(nombre) = LOWER('{ubicacion_nombre}') AND empresa_id = {empresa_id} LIMIT 1)"
                    tienda_id = 'NULL'
                else:
                    bodega_id = 'NULL'
                    tienda_id = f"(SELECT id FROM tiendas WHERE LOWER(nombre) = LOWER('{ubicacion_nombre}') AND empresa_id = {empresa_id} LIMIT 1)"
                
                precio_por_mayor_sql = f"{precio_por_mayor}" if precio_por_mayor is not None else 'NULL'
                
                sql = f"""INSERT INTO juguetes (
    nombre, codigo, item, cantidad, foto_url, precio_min, precio_por_mayor, 
    empresa_id, bodega_id, tienda_id, created_at, updated_at
) VALUES (
    '{nombre}',
    '{codigo}',
    {item},
    {cantidad},
    {foto_url},
    {precio_min},
    {precio_por_mayor_sql},
    {empresa_id},
    {bodega_id},
    {tienda_id},
    NOW(),
    NOW()
);"""
                
                sql_statements.append(sql)
                sql_statements.append("")
                registros_procesados += 1
                
            except Exception as e:
                errores.append(f"Fila {index + 2}: {str(e)}")
                continue
        
        sql_statements.append("\n-- ============================================")
        sql_statements.append("-- FIN DE LOS INSERTS")
        sql_statements.append("-- ============================================")
        
        sql_final = '\n'.join(sql_statements)
        
        # Guardar en archivo
        output_file = f"sql_inserts_inventario_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(sql_final)
        
        print(f"\n✓ SQL generado exitosamente: {output_file}")
        print(f"✓ Total de registros procesados: {registros_procesados} de {len(df)}")
        
        if errores:
            print(f"\n⚠ Advertencias/Errores ({len(errores)}):")
            for error in errores[:10]:  # Mostrar solo los primeros 10
                print(f"  - {error}")
            if len(errores) > 10:
                print(f"  ... y {len(errores) - 10} más")
        
        return sql_final
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Uso: python procesar_inventario.py <archivo_excel.xlsx> [empresa_id]")
        print("Ejemplo: python procesar_inventario.py inventario.xlsx 1")
        sys.exit(1)
    
    excel_file = sys.argv[1]
    empresa_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    if not os.path.exists(excel_file):
        print(f"ERROR: El archivo {excel_file} no existe")
        sys.exit(1)
    
    procesar_excel_inventario(excel_file, empresa_id)






