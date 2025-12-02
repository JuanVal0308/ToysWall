"""
Script para actualizar los campos de bultos (numero_bultos y cantidad_por_bulto) 
de los juguetes existentes desde un archivo Excel.

Uso:
    python actualizar_bultos_desde_excel.py archivo.xlsx empresa_id [archivo_salida.sql]

El archivo Excel debe tener las siguientes columnas:
    - Codigo: Código del juguete (para identificar el juguete)
    - Numero de bultos: Número de bultos (opcional)
    - Cantidad por bultos: Cantidad por bulto (opcional)
"""

import pandas as pd
import sys
import os
import re
from datetime import datetime

def actualizar_bultos_desde_excel(excel_file, empresa_id, output_file=None):
    """
    Genera SQL UPDATE statements para actualizar numero_bultos y cantidad_por_bulto
    desde un archivo Excel
    
    Args:
        excel_file: Ruta al archivo Excel
        empresa_id: ID de la empresa
        output_file: Archivo de salida (opcional)
    """
    try:
        # Leer el archivo Excel
        df = pd.read_excel(excel_file)
        
        # Normalizar nombres de columnas
        df.columns = df.columns.str.strip()
        
        # Mapeo de nombres de columnas posibles
        column_mapping = {
            'codigo': ['codigo', 'código', 'code'],
            'numero_bultos': ['numero de bultos', 'número de bultos', 'numero_bultos', 'bultos', 'numero bultos', 'nro de bultos', 'nro bultos', 'cantidad de bultos'],
            'cantidad_por_bulto': ['cantidad por bultos', 'cantidad por bulto', 'cantidad_por_bulto', 'cantidad por bultos', 'cantidad/bulto', 'unidades por bulto', 'unidades/bulto', 'cantidad x bulto']
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
        
        # Validar que exista la columna codigo
        if 'codigo' not in df.columns:
            print("Error: No se encontró la columna 'Codigo' en el Excel")
            print(f"Columnas encontradas: {', '.join(df.columns.tolist())}")
            return False
        
        # Generar nombre de archivo de salida si no se proporciona
        if not output_file:
            base_name = os.path.splitext(os.path.basename(excel_file))[0]
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f'update_bultos_{base_name}_{timestamp}.sql'
        
        # Escribir SQL
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("-- ============================================\n")
            f.write("-- ACTUALIZACIÓN DE BULTOS DESDE EXCEL\n")
            f.write(f"-- Archivo: {os.path.basename(excel_file)}\n")
            f.write(f"-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- Empresa ID: {empresa_id}\n")
            f.write("-- ============================================\n\n")
            
            registros_procesados = 0
            registros_actualizados = 0
            
            for index, row in df.iterrows():
                try:
                    codigo = str(row['codigo']).strip().replace("'", "''")
                    
                    if not codigo or codigo.lower() == 'nan':
                        print(f"Advertencia: Fila {index + 2}: Código vacío. Se omite.")
                        continue
                    
                    # Procesar numero_bultos
                    numero_bultos_sql = 'NULL'
                    if 'numero_bultos' in df.columns and pd.notna(row.get('numero_bultos')):
                        numero_bultos_str = str(row['numero_bultos']).strip()
                        numero_bultos_str = re.sub(r'[^\d]', '', numero_bultos_str)
                        if numero_bultos_str and numero_bultos_str.lower() != 'nan':
                            numero_bultos = int(numero_bultos_str)
                            numero_bultos_sql = str(numero_bultos)
                    
                    # Procesar cantidad_por_bulto
                    cantidad_por_bulto_sql = 'NULL'
                    if 'cantidad_por_bulto' in df.columns and pd.notna(row.get('cantidad_por_bulto')):
                        cantidad_por_bulto_str = str(row['cantidad_por_bulto']).strip()
                        cantidad_por_bulto_str = re.sub(r'[^\d]', '', cantidad_por_bulto_str)
                        if cantidad_por_bulto_str and cantidad_por_bulto_str.lower() != 'nan':
                            cantidad_por_bulto = int(cantidad_por_bulto_str)
                            cantidad_por_bulto_sql = str(cantidad_por_bulto)
                    
                    # Solo generar UPDATE si hay al menos un valor para actualizar
                    if numero_bultos_sql != 'NULL' or cantidad_por_bulto_sql != 'NULL':
                        # Generar UPDATE statement
                        sql = f"""UPDATE juguetes 
SET 
    numero_bultos = {numero_bultos_sql},
    cantidad_por_bulto = {cantidad_por_bulto_sql},
    updated_at = NOW()
WHERE codigo = '{codigo}' 
    AND empresa_id = {empresa_id};

"""
                        f.write(sql)
                        registros_actualizados += 1
                    
                    registros_procesados += 1
                    
                except Exception as e:
                    print(f"Error procesando fila {index + 2}: {str(e)}")
                    continue
            
            f.write("\n-- ============================================\n")
            f.write("-- FIN DE LOS UPDATES\n")
            f.write("-- ============================================\n")
        
        print(f"✓ SQL generado exitosamente: {output_file}")
        print(f"✓ Total de registros procesados: {registros_procesados}")
        print(f"✓ Total de registros con datos de bultos: {registros_actualizados}")
        return True
        
    except Exception as e:
        print(f"Error al procesar el archivo: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    if len(sys.argv) < 3:
        print("Uso: python actualizar_bultos_desde_excel.py <archivo_excel.xlsx> <empresa_id> [archivo_salida.sql]")
        print("\nEjemplo:")
        print("  python actualizar_bultos_desde_excel.py inventario.xlsx 1")
        print("  python actualizar_bultos_desde_excel.py inventario.xlsx 1 update_bultos.sql")
        sys.exit(1)
    
    excel_file = sys.argv[1]
    empresa_id = int(sys.argv[2])
    output_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    if not os.path.exists(excel_file):
        print(f"Error: El archivo {excel_file} no existe")
        sys.exit(1)
    
    actualizar_bultos_desde_excel(excel_file, empresa_id, output_file)

if __name__ == "__main__":
    main()






