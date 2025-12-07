"""
Script para actualizar los precios mínimos (precio_min) y precios al por mayor (precio_por_mayor)
de los juguetes existentes desde archivos Excel.

Uso:
    python actualizar_precios_desde_excel.py <archivo_precio_final.xlsx> <archivo_precios_mayorista.xlsx> <empresa_id> [archivo_salida.sql]

Ejemplo:
    python actualizar_precios_desde_excel.py "PRECIO FINAL.xlsx" "PRECIOS MAYORISTAA (1).xlsx" 1
"""

import pandas as pd
import sys
import os
import re
from datetime import datetime

def procesar_precio(precio_str):
    """
    Procesa un precio en formato string y lo convierte a float.
    Maneja diferentes formatos: $1.000, 1,000.50, 1000.50, etc.
    """
    if pd.isna(precio_str):
        return None
    
    precio_str = str(precio_str).strip()
    
    # Remover símbolo de dólar y espacios
    precio_str = precio_str.replace('$', '').replace(' ', '')
    
    # Manejar diferentes formatos de números
    if ',' in precio_str and '.' not in precio_str:
        # Formato: 1,000 (coma como separador de miles)
        precio_str = precio_str.replace(',', '')
    elif ',' in precio_str and '.' in precio_str:
        # Formato: 1.000,50 (punto como miles, coma como decimal)
        precio_str = precio_str.replace('.', '').replace(',', '.')
    elif '.' in precio_str and ',' not in precio_str:
        # Formato: 1000.50 o 1.000 (punto como decimal o separador de miles)
        if precio_str.count('.') > 1:
            # Múltiples puntos = separador de miles
            precio_str = precio_str.replace('.', '')
        else:
            # Un solo punto, verificar si es decimal o separador de miles
            partes = precio_str.split('.')
            if len(partes) == 2 and len(partes[1]) > 2:
                # Probablemente es separador de miles, no decimal
                precio_str = precio_str.replace('.', '')
    
    # Remover cualquier carácter que no sea dígito o punto
    precio_str = re.sub(r'[^\d.]', '', precio_str)
    
    if not precio_str or precio_str.lower() == 'nan' or precio_str == '':
        return None
    
    try:
        precio = float(precio_str)
        return precio if precio > 0 else None
    except ValueError:
        return None

def actualizar_precios_desde_excel(precio_final_file, precios_mayorista_file, empresa_id, output_file=None):
    """
    Genera SQL UPDATE statements para actualizar precio_min y precio_por_mayor
    desde archivos Excel
    
    Args:
        precio_final_file: Ruta al archivo Excel con precios finales (precio mínimo)
        precios_mayorista_file: Ruta al archivo Excel con precios mayoristas
        empresa_id: ID de la empresa
        output_file: Archivo de salida (opcional)
    """
    try:
        # Leer archivo de precios finales (precio mínimo)
        print(f"Leyendo archivo de precios finales: {precio_final_file}")
        df_precio_final = pd.read_excel(precio_final_file)
        df_precio_final.columns = df_precio_final.columns.str.strip()
        
        # Leer archivo de precios mayoristas
        print(f"Leyendo archivo de precios mayoristas: {precios_mayorista_file}")
        df_mayorista = pd.read_excel(precios_mayorista_file)
        df_mayorista.columns = df_mayorista.columns.str.strip()
        
        # Normalizar columnas del archivo de precios finales
        column_mapping_final = {
            'item': ['item no.:', 'item', 'item no', 'item_no', 'codigo', 'código'],
            'precio_minimo': ['precio minimo', 'precio_minimo', 'precio mínimo', 'precio minimo', 'minimo']
        }
        
        normalized_columns_final = {}
        for standard_name, possible_names in column_mapping_final.items():
            for col in df_precio_final.columns:
                if col.lower() in [name.lower() for name in possible_names]:
                    normalized_columns_final[col] = standard_name
                    break
        
        df_precio_final = df_precio_final.rename(columns=normalized_columns_final)
        print(f"Columnas detectadas en PRECIO FINAL: {', '.join(df_precio_final.columns.tolist())}")
        
        # Normalizar columnas del archivo de precios mayoristas
        column_mapping_mayorista = {
            'item': ['item', 'item ', 'item no.:', 'item no', 'item_no', 'codigo', 'código'],
            'precio_por_mayor': ['precio al por mayor', 'precio_por_mayor', 'precio por mayor', 
                                'precio mayorista', 'precio mayor', 'precio x mayor']
        }
        
        normalized_columns_mayorista = {}
        for standard_name, possible_names in column_mapping_mayorista.items():
            for col in df_mayorista.columns:
                if col.lower() in [name.lower() for name in possible_names]:
                    normalized_columns_mayorista[col] = standard_name
                    break
        
        df_mayorista = df_mayorista.rename(columns=normalized_columns_mayorista)
        print(f"Columnas detectadas en PRECIOS MAYORISTA: {', '.join(df_mayorista.columns.tolist())}")
        
        # Validar columnas requeridas
        if 'item' not in df_precio_final.columns:
            print("Error: No se encontró la columna 'ITEM NO.:' o 'ITEM' en el archivo de precios finales")
            print(f"Columnas encontradas: {', '.join(df_precio_final.columns.tolist())}")
            return False
        
        if 'precio_minimo' not in df_precio_final.columns:
            print("Error: No se encontró la columna 'PRECIO MINIMO' en el archivo de precios finales")
            print(f"Columnas encontradas: {', '.join(df_precio_final.columns.tolist())}")
            return False
        
        if 'item' not in df_mayorista.columns:
            print("Error: No se encontró la columna 'ITEM' en el archivo de precios mayoristas")
            print(f"Columnas encontradas: {', '.join(df_mayorista.columns.tolist())}")
            return False
        
        if 'precio_por_mayor' not in df_mayorista.columns:
            print("Error: No se encontró la columna 'PRECIO AL POR MAYOR' en el archivo de precios mayoristas")
            print(f"Columnas encontradas: {', '.join(df_mayorista.columns.tolist())}")
            return False
        
        # Generar nombre de archivo de salida si no se proporciona
        if not output_file:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f'update_precios_{timestamp}.sql'
        
        # Crear diccionarios para búsqueda rápida
        precios_minimos = {}
        for index, row in df_precio_final.iterrows():
            item = str(row['item']).strip() if pd.notna(row.get('item')) else None
            if item and item.lower() != 'nan':
                precio_min = procesar_precio(row.get('precio_minimo'))
                if precio_min:
                    precios_minimos[item] = precio_min
        
        precios_mayoristas = {}
        for index, row in df_mayorista.iterrows():
            item = str(row['item']).strip() if pd.notna(row.get('item')) else None
            if item and item.lower() != 'nan':
                precio_mayor = procesar_precio(row.get('precio_por_mayor'))
                if precio_mayor:
                    precios_mayoristas[item] = precio_mayor
        
        # Escribir SQL
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("-- ============================================\n")
            f.write("-- ACTUALIZACIÓN DE PRECIOS MÍNIMOS Y AL POR MAYOR DESDE EXCEL\n")
            f.write(f"-- Archivo Precio Final: {os.path.basename(precio_final_file)}\n")
            f.write(f"-- Archivo Precios Mayorista: {os.path.basename(precios_mayorista_file)}\n")
            f.write(f"-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- Empresa ID: {empresa_id}\n")
            f.write("-- ============================================\n\n")
            f.write("-- IMPORTANTE: Revisa los UPDATE statements antes de ejecutarlos\n\n")
            
            registros_procesados = 0
            registros_actualizados_min = 0
            registros_actualizados_mayor = 0
            registros_actualizados_ambos = 0
            errores = []
            
            # Obtener todos los items únicos de ambos archivos
            todos_items = set(precios_minimos.keys()) | set(precios_mayoristas.keys())
            
            for item in todos_items:
                try:
                    item_escaped = item.replace("'", "''").replace('\n', '').replace('\\n', '')
                    
                    precio_min = precios_minimos.get(item)
                    precio_mayor = precios_mayoristas.get(item)
                    
                    # Solo generar UPDATE si hay al menos un precio para actualizar
                    if precio_min is not None or precio_mayor is not None:
                        # Construir la parte SET del UPDATE
                        set_parts = []
                        
                        if precio_min is not None:
                            set_parts.append(f"    precio_min = {precio_min}")
                            registros_actualizados_min += 1
                        
                        if precio_mayor is not None:
                            set_parts.append(f"    precio_por_mayor = {precio_mayor}")
                            registros_actualizados_mayor += 1
                        
                        if precio_min is not None and precio_mayor is not None:
                            registros_actualizados_ambos += 1
                        
                        set_parts.append("    updated_at = NOW()")
                        
                        # Generar UPDATE statement
                        sql = f"""UPDATE juguetes 
SET 
{',\n'.join(set_parts)}
WHERE item = '{item_escaped}' 
    AND empresa_id = {empresa_id};

"""
                        f.write(sql)
                        registros_procesados += 1
                    else:
                        errores.append(f"Item '{item}': No se encontró ningún precio válido")
                    
                except Exception as e:
                    errores.append(f"Item '{item}': Error procesando - {str(e)}")
                    continue
            
            f.write("\n-- ============================================\n")
            f.write("-- FIN DE LOS UPDATES\n")
            f.write("-- ============================================\n")
        
        print(f"\n✓ SQL generado exitosamente: {output_file}")
        print(f"✓ Total de items procesados: {registros_procesados}")
        print(f"✓ Items con precio mínimo actualizado: {registros_actualizados_min}")
        print(f"✓ Items con precio al por mayor actualizado: {registros_actualizados_mayor}")
        print(f"✓ Items con ambos precios actualizados: {registros_actualizados_ambos}")
        
        if errores:
            print(f"\n⚠ Advertencias/Errores ({len(errores)}):")
            for error in errores[:20]:  # Mostrar solo los primeros 20
                print(f"  - {error}")
            if len(errores) > 20:
                print(f"  ... y {len(errores) - 20} más")
        
        return True
        
    except Exception as e:
        print(f"Error al procesar los archivos: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    if len(sys.argv) < 4:
        print("Uso: python actualizar_precios_desde_excel.py <archivo_precio_final.xlsx> <archivo_precios_mayorista.xlsx> <empresa_id> [archivo_salida.sql]")
        print("\nEjemplo:")
        print('  python actualizar_precios_desde_excel.py "PRECIO FINAL.xlsx" "PRECIOS MAYORISTAA (1).xlsx" 1')
        print('  python actualizar_precios_desde_excel.py "PRECIO FINAL.xlsx" "PRECIOS MAYORISTAA (1).xlsx" 1 update_precios.sql')
        sys.exit(1)
    
    precio_final_file = sys.argv[1]
    precios_mayorista_file = sys.argv[2]
    empresa_id = int(sys.argv[3])
    output_file = sys.argv[4] if len(sys.argv) > 4 else None
    
    if not os.path.exists(precio_final_file):
        print(f"Error: El archivo {precio_final_file} no existe")
        sys.exit(1)
    
    if not os.path.exists(precios_mayorista_file):
        print(f"Error: El archivo {precios_mayorista_file} no existe")
        sys.exit(1)
    
    actualizar_precios_desde_excel(precio_final_file, precios_mayorista_file, empresa_id, output_file)

if __name__ == "__main__":
    main()

