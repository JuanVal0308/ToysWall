# Instrucciones para Configurar Supabase Storage para Facturas XML

Para que los archivos XML de las facturas se puedan adjuntar y descargar automáticamente desde el correo, necesitas configurar un bucket en Supabase Storage.

## Pasos para Configurar el Bucket

1. **Accede a tu proyecto de Supabase**
   - Ve a https://supabase.com
   - Inicia sesión y selecciona tu proyecto

2. **Navega a Storage**
   - En el menú lateral izquierdo, haz clic en **"Storage"**
   - Verás una lista de buckets (si ya tienes alguno)

3. **Crear el Bucket "facturas"**
   - Haz clic en el botón **"New bucket"** o **"Crear bucket"**
   - **Nombre del bucket:** `facturas` (debe ser exactamente este nombre, en minúsculas)
   - **Público:** ✅ **Marca esta casilla** (esto permite que los archivos sean accesibles públicamente para descarga)
   - **File size limit:** Puedes dejarlo en el valor por defecto o aumentarlo si esperas archivos XML muy grandes (recomendado: 5MB)
   - **Allowed MIME types:** Puedes dejarlo vacío o agregar `application/xml` y `text/xml`
   - Haz clic en **"Create bucket"** o **"Crear bucket"**

4. **Configurar Políticas de Seguridad (RLS)**
   - Una vez creado el bucket, haz clic en él para abrir sus configuraciones
   - Ve a la pestaña **"Policies"** o **"Políticas"**
   - Haz clic en **"New Policy"** o **"Nueva Política"**
   - Selecciona **"For full customization"** o **"Para personalización completa"**
   - **Nombre de la política:** `Permitir lectura pública de facturas`
   - **Política de ALLOW para SELECT:**
     ```sql
     CREATE POLICY "Permitir lectura pública de facturas"
     ON storage.objects
     FOR SELECT
     USING (bucket_id = 'facturas');
     ```
   - Haz clic en **"Review"** y luego en **"Save policy"**

5. **Verificar la Configuración**
   - Asegúrate de que el bucket esté marcado como **público**
   - Verifica que la política de lectura esté activa

## ¿Qué hace esto?

Una vez configurado:
- Cuando se genere una factura, el archivo XML se subirá automáticamente a Supabase Storage
- Se generará un enlace de descarga directa que se incluirá en el correo electrónico
- El cliente podrá hacer clic en el enlace y descargar el archivo XML directamente
- El archivo se guardará con un nombre único: `factura_[CODIGO_FACTURA]_[TIMESTAMP].xml`

## Nota Importante

Si el bucket no está configurado o hay algún error al subir el archivo, el sistema usará un método alternativo que incluye el XML como texto plano en el correo con instrucciones para guardarlo manualmente.

## Solución de Problemas

**Error: "Bucket not found"**
- Verifica que el bucket se llame exactamente `facturas` (en minúsculas)
- Asegúrate de que el bucket esté creado en el proyecto correcto de Supabase

**Error: "Permission denied"**
- Verifica que el bucket esté marcado como **público**
- Revisa que la política de lectura esté configurada correctamente

**Los archivos no se descargan**
- Verifica que la URL pública esté funcionando
- Asegúrate de que el bucket tenga permisos de lectura pública





