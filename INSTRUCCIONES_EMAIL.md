# Instrucciones para Configurar el Envío de Correos

Para que las facturas se envíen automáticamente por correo, necesitas configurar EmailJS (servicio gratuito).

## Pasos para Configurar EmailJS:

### 1. Crear cuenta en EmailJS
- Ve a https://www.emailjs.com/
- Crea una cuenta gratuita (permite hasta 200 correos al mes)

### 2. Configurar un Servicio de Correo
- En el dashboard de EmailJS, ve a "Email Services"
- Haz clic en "Add New Service"
- Selecciona "Gmail" (o el servicio que prefieras)
- Conecta tu cuenta de Gmail (toyswalls@gmail.com)
- Guarda el **Service ID** que se genera

### 3. Crear una Plantilla de Correo
- Ve a "Email Templates"
- Haz clic en "Create New Template"
- Configura la plantilla con estos campos:
  - **To Email**: `{{to_email}}` ⚠️ **MUY IMPORTANTE**: Este campo DEBE estar configurado con `{{to_email}}` para que funcione
  - **To Name**: `{{to_name}}`
  - **From Name**: `ToysWalls` o `{{from_name}}`
  - **Reply To**: `{{reply_to}}` (opcional, pero recomendado)
  - **Subject**: `{{subject}}` o `Factura {{factura_codigo}} - ToysWalls`
  - **Content (HTML)**: 
    ```html
    {{message_html}}
    ```
    O si prefieres un formato más simple:
    ```html
    <h2>Estimado/a {{to_name}},</h2>
    <p>Adjunto encontrará su factura <strong>{{factura_codigo}}</strong>.</p>
    <p><strong>Total:</strong> {{factura_total}}</p>
    <p><strong>Fecha:</strong> {{factura_fecha}}</p>
    <hr>
    {{message_html}}
    <p>Gracias por su compra.</p>
    <p>ToysWalls - Sistema de Inventario</p>
    ```
- **IMPORTANTE**: Asegúrate de que el campo "To Email" esté configurado con `{{to_email}}` exactamente así
- Guarda el **Template ID** que se genera

### 4. Obtener tu Public Key
- Ve a "Account" > "General"
- Copia tu **Public Key** (también llamada User ID)

### 5. Configurar en el Código
- Abre el archivo `js/email-config.js`
- Reemplaza los valores:
  ```javascript
  const EMAILJS_CONFIG = {
      SERVICE_ID: 'TU_SERVICE_ID_AQUI',
      TEMPLATE_ID: 'TU_TEMPLATE_ID_AQUI',
      PUBLIC_KEY: 'TU_PUBLIC_KEY_AQUI',
      FROM_EMAIL: 'toyswalls@gmail.com',
      FROM_NAME: 'ToysWalls'
  };
  ```

### 6. Probar el Envío
- Una vez configurado, prueba enviando una factura
- El correo debería llegar al cliente automáticamente

## Nota Importante:
- El servicio gratuito de EmailJS permite 200 correos al mes
- Si necesitas más, puedes actualizar a un plan de pago
- Los correos se envían desde la cuenta de Gmail que configuraste (toyswalls@gmail.com)

