"""
Script para actualizar los precios al por mayor (precio_por_mayor) 
de los juguetes existentes desde un archivo Excel.

Uso:
    python actualizar_precios_por_mayor_desde_excel.py archivo.xlsx empresa_id [archivo_salida.sql]

El archivo Excel debe tener las siguientes columnas:
    - Codigo: Código del juguete (para identificar el juguete)
    - Precio al por mayor: Precio al por mayor (opcional, pero necesario para actualizar)
"""

import pandas as pd
import sys
import os
import re
from datetime import datetime

def actualizar_precios_por_mayor_desde_excel(excel_file, empresa_id, output_file=None):
    """
    Genera SQL UPDATE statements para actualizar precio_por_mayor
    desde un archivo Excel
    
    Args:
        excel_file: Ruta al archivo Excel
        empresa_id: ID de la empresa
        output_file: Archivo de salida (opcional)
    """
    try:
        # Leer el archivo Excel
        print(f"Leyendo archivo: {excel_file}")
        df = pd.read_excel(excel_file)
        
        # Normalizar nombres de columnas
        df.columns = df.columns.str.strip()
        
        # Mapeo de nombres de columnas posibles
        column_mapping = {
            'codigo': ['codigo', 'código', 'code'],
            'precio_por_mayor': ['precio al por mayor', 'precio_por_mayor', 'precio por mayor', 
                                'precio al por mayor', 'precio por mayor', 'precio mayor',
                                'precio mayorista', 'precio mayor', 'precio x mayor']
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
        
        print(f"Columnas detectadas: {', '.join(df.columns.tolist())}")
        
        # Validar que exista la columna codigo
        if 'codigo' not in df.columns:
            print("Error: No se encontró la columna 'Codigo' en el Excel")
            print(f"Columnas encontradas: {', '.join(df.columns.tolist())}")
            return False
        
        # Validar que exista la columna precio_por_mayor
        if 'precio_por_mayor' not in df.columns:
            print("Error: No se encontró la columna 'Precio al por mayor' en el Excel")
            print(f"Columnas encontradas: {', '.join(df.columns.tolist())}")
            return False
        
        # Generar nombre de archivo de salida si no se proporciona
        if not output_file:
            base_name = os.path.splitext(os.path.basename(excel_file))[0]
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f'update_precios_por_mayor_{base_name}_{timestamp}.sql'
        
        # Escribir SQL
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("-- ============================================\n")
            f.write("-- ACTUALIZACIÓN DE PRECIOS AL POR MAYOR DESDE EXCEL\n")
            f.write(f"-- Archivo: {os.path.basename(excel_file)}\n")
            f.write(f"-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- Empresa ID: {empresa_id}\n")
            f.write("-- ============================================\n\n")
            f.write("-- IMPORTANTE: Revisa los UPDATE statements antes de ejecutarlos\n\n")
            
            registros_procesados = 0
            registros_actualizados = 0
            errores = []
            
            for index, row in df.iterrows():
                try:
                    codigo = str(row['codigo']).strip().replace("'", "''")
                    
                    if not codigo or codigo.lower() == 'nan':
                        errores.append(f"Fila {index + 2}: Código vacío. Se omite.")
                        continue
                    
                    # Procesar precio_por_mayor
                    precio_por_mayor_sql = 'NULL'
                    if 'precio_por_mayor' in df.columns and pd.notna(row.get('precio_por_mayor')):
                        precio_por_mayor_str = str(row['precio_por_mayor']).strip()
                        
                        # Remover símbolo de dólar y espacios
                        precio_por_mayor_str = precio_por_mayor_str.replace('$', '').replace(' ', '')
                        
                        # Manejar diferentes formatos de números
                        # Si tiene comas, asumir que son separadores de miles (formato colombiano)
                        if ',' in precio_por_mayor_str and '.' not in precio_por_mayor_str:
                            # Formato: 1.000,00 o 1,000
                            precio_por_mayor_str = precio_por_mayor_str.replace(',', '')
                        elif ',' in precio_por_mayor_str and '.' in precio_por_mayor_str:
                            # Formato: 1.000,50 (coma como decimal)
                            precio_por_mayor_str = precio_por_mayor_str.replace('.', '').replace(',', '.')
                        elif '.' in precio_por_mayor_str and ',' not in precio_por_mayor_str:
                            # Formato: 1000.50 o 1.000 (punto como decimal o separador de miles)
                            # Si tiene más de un punto, asumir separador de miles
                            if precio_por_mayor_str.count('.') > 1:
                                precio_por_mayor_str = precio_por_mayor_str.replace('.', '')
                            # Si tiene un solo punto, verificar si es decimal o separador de miles
                            # Asumimos que si tiene más de 2 dígitos después del punto, es separador de miles
                            partes = precio_por_mayor_str.split('.')
                            if len(partes) == 2 and len(partes[1]) > 2:
                                # Probablemente es separador de miles, no decimal
                                precio_por_mayor_str = precio_por_mayor_str.replace('.', '')
                        
                        # Remover cualquier carácter que no sea dígito o punto
                        precio_por_mayor_str = re.sub(r'[^\d.]', '', precio_por_mayor_str)
                        
                        if precio_por_mayor_str and precio_por_mayor_str.lower() != 'nan' and precio_por_mayor_str != '':
                            try:
                                precio_por_mayor = float(precio_por_mayor_str)
                                if precio_por_mayor > 0:
                                    precio_por_mayor_sql = str(precio_por_mayor)
                            except ValueError:
                                errores.append(f"Fila {index + 2}: Precio inválido '{row.get('precio_por_mayor')}' para código '{codigo}'")
                                continue
                    
                    # Solo generar UPDATE si hay un valor para actualizar
                    if precio_por_mayor_sql != 'NULL':
                        # Generar UPDATE statement
                        sql = f"""UPDATE juguetes 
SET 
    precio_por_mayor = {precio_por_mayor_sql},
    updated_at = NOW()
WHERE codigo = '{codigo}' 
    AND empresa_id = {empresa_id};

"""
                        f.write(sql)
                        registros_actualizados += 1
                    else:
                        errores.append(f"Fila {index + 2}: No se encontró precio al por mayor para código '{codigo}'")
                    
                    registros_procesados += 1
                    
                except Exception as e:
                    errores.append(f"Fila {index + 2}: Error procesando - {str(e)}")
                    continue
            
            f.write("\n-- ============================================\n")
            f.write("-- FIN DE LOS UPDATES\n")
            f.write("-- ============================================\n")
        
        print(f"\n✓ SQL generado exitosamente: {output_file}")
        print(f"✓ Total de registros procesados: {registros_procesados}")
        print(f"✓ Total de registros actualizados: {registros_actualizados}")
        
        if errores:
            print(f"\n⚠ Advertencias/Errores ({len(errores)}):")
            for error in errores[:20]:  # Mostrar solo los primeros 20
                print(f"  - {error}")
            if len(errores) > 20:
                print(f"  ... y {len(errores) - 20} más")
        
        return True
        
    except Exception as e:
        print(f"Error al procesar el archivo: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    if len(sys.argv) < 3:
        print("Uso: python actualizar_precios_por_mayor_desde_excel.py <archivo_excel.xlsx> <empresa_id> [archivo_salida.sql]")
        print("\nEjemplo:")
        print("  python actualizar_precios_por_mayor_desde_excel.py \"Inventario 2025 1.xlsx\" 1")
        print("  python actualizar_precios_por_mayor_desde_excel.py \"Inventario 2025 1.xlsx\" 1 update_precios.sql")
        sys.exit(1)
    
    excel_file = sys.argv[1]
    empresa_id = int(sys.argv[2])
    output_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    if not os.path.exists(excel_file):
        print(f"Error: El archivo {excel_file} no existe")
        sys.exit(1)
    
    actualizar_precios_por_mayor_desde_excel(excel_file, empresa_id, output_file)

if __name__ == "__main__":
    main()

