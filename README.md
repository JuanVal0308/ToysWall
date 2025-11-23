# Sistema de Inventario - Toys Walls

Sistema web de inventario empresarial desarrollado con HTML, CSS, JavaScript y Supabase.

## 📋 Estructura del Proyecto

```
ToysWall/
├── index.html              # Página de inicio de sesión
├── dashboard.html          # Dashboard principal
├── css/
│   ├── styles.css         # Estilos del login
│   └── dashboard.css      # Estilos del dashboard
├── js/
│   ├── config.js          # Configuración de Supabase
│   ├── auth.js            # Lógica de autenticación
│   ├── dashboard.js       # Lógica del dashboard
│   ├── dashboard-funcionalidades.js  # Funcionalidades del dashboard
│   ├── analisis-tiendas-empleados.js # Análisis de tiendas y empleados
│   └── email-config.js    # Configuración de EmailJS
├── setup_completo.sql     # Script completo de configuración de base de datos
└── migrations/            # Scripts de migración para bases de datos existentes
    ├── fix_foreign_keys_delete.sql
    ├── fix_usuarios_rls.sql
    └── agregar_campo_facturada.sql
```

## 🚀 Configuración Inicial

### 1. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Copia la URL y la Anon Key de tu proyecto
3. Edita `js/config.js` y agrega tus credenciales:
   ```javascript
   const SUPABASE_URL = 'tu_url_aqui';
   const SUPABASE_ANON_KEY = 'tu_anon_key_aqui';
   ```

### 2. Configurar Base de Datos

1. Abre el SQL Editor en Supabase
2. Copia y pega el contenido completo de `setup_completo.sql`
3. Ejecuta el script (Run o Ctrl+Enter)
4. Verifica que se hayan creado todas las tablas

**Para bases de datos existentes:** Si ya tienes una base de datos, ejecuta los scripts en la carpeta `migrations/` según sea necesario.

### 3. Configurar EmailJS (Opcional - para envío de facturas)

Para que las facturas se envíen automáticamente por correo:

1. Crea una cuenta en [EmailJS](https://www.emailjs.com/) (gratis hasta 200 correos/mes)
2. Configura un servicio de correo (Gmail, Outlook, etc.)
3. Crea una plantilla de correo con estos campos:
   - **To Email:** `{{to_email}}`
   - **To Name:** `{{to_name}}`
   - **From Name:** `ToysWalls`
   - **Reply To:** `{{reply_to}}`
   - **Subject:** `{{subject}}`
   - **Content (HTML):** `{{{message_html}}}` ⚠️ **TRIPLE LLAVE** (muy importante)
4. Obtén tu Service ID, Template ID y Public Key
5. Edita `js/email-config.js` y configura tus credenciales:
   ```javascript
   const EMAILJS_CONFIG = {
       SERVICE_ID: 'tu_service_id',
       TEMPLATE_ID: 'tu_template_id',
       PUBLIC_KEY: 'tu_public_key',
       FROM_EMAIL: 'toyswalls@gmail.com',
       FROM_NAME: 'ToysWalls'
   };
   ```

**⚠️ IMPORTANTE sobre EmailJS:**
- Usa **TRIPLE LLAVE** `{{{message_html}}}` en el campo Content de EmailJS
- `{{variable}}` → EmailJS escapa el HTML (lo muestra como texto)
- `{{{variable}}}` → EmailJS NO escapa el HTML (lo renderiza correctamente)
- El HTML completo ya viene procesado desde la aplicación, solo necesitas renderizarlo

## 🔐 Autenticación

- **Login**: Usuario, Empresa y Contraseña
- **Tipos de Usuario**:
  - **Super Administrador** (ID: 1): Acceso completo
  - **Administrador** (ID: 2): Acceso al dashboard
  - **Empleado** (ID: 3): Acceso a Dashboard, Registrar Venta, Inventario, Ajustes y Análisis

## 📝 Usuarios Iniciales

El script `setup_completo.sql` crea usuarios de ejemplo:
- **Super Admin**: `Super Admin` / Empresa: `Toys Walls` / Contraseña: `superadmin123`
- **Admin**: `admin` / Empresa: `Toys Walls` / Contraseña: `admin123`

## 🎨 Características

- ✅ Autenticación por usuario, empresa y contraseña
- ✅ Dashboard completo con resumen de ventas
- ✅ Gestión de inventario (juguetes, tiendas, bodegas)
- ✅ Registro y facturación de ventas
- ✅ Envío automático de facturas por correo
- ✅ Análisis de ventas (por día, hora, tienda, empleado)
- ✅ Gestión de usuarios y empleados
- ✅ Movimientos de inventario entre ubicaciones
- ✅ Devoluciones de ventas
- ✅ Exportación de datos a Excel
- ✅ Diseño responsive y moderno
- ✅ Prevención de facturación duplicada

## 📱 Páginas

### index.html
Página de inicio de sesión con:
- Selección de empresa (dropdown)
- Campo de usuario
- Campo de contraseña con toggle de visibilidad
- Botón de registro que redirige a WhatsApp

### dashboard.html
Dashboard principal con:
- Resumen de ventas del mes
- Gráficos de análisis
- Gestión de inventario
- Registro de ventas
- Facturación
- Análisis de datos
- Gestión de usuarios
- Ajustes y configuraciones

## 🔧 Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Supabase (PostgreSQL + API REST)
- **Iconos**: Font Awesome 6.4.0
- **Gráficos**: Chart.js
- **Exportación**: XLSX.js
- **Email**: EmailJS
- **Hosting**: Compatible con cualquier hosting estático

## 📄 Licencia

Proyecto privado - Toys Walls
