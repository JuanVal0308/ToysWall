# Sistema de Inventario - Toys Walls

Sistema web de inventario empresarial desarrollado con HTML, CSS, JavaScript y Supabase.

## 📋 Estructura del Proyecto

```
ToysWall/
├── Login.html              # Página de inicio de sesión
├── dashboard.html          # Dashboard principal (solo administradores)
├── css/
│   ├── styles.css         # Estilos del login
│   └── dashboard.css      # Estilos del dashboard
├── js/
│   ├── config.js          # Configuración de Supabase
│   ├── auth.js            # Lógica de autenticación
│   └── dashboard.js       # Lógica del dashboard
├── database_setup.sql      # Script completo de configuración de base de datos
└── SUPABASE_CONFIG.txt     # Configuración de Supabase (URL y Anon Key)
```

## 🚀 Configuración Inicial

### 1. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Copia la URL y la Anon Key de tu proyecto
3. Edita `SUPABASE_CONFIG.txt` y agrega tus credenciales:
   ```
   SUPABASE_URL=tu_url_aqui
   SUPABASE_ANON_KEY=tu_anon_key_aqui
   ```

### 2. Configurar Base de Datos

1. Abre el SQL Editor en Supabase
2. Copia y pega el contenido completo de `database_setup.sql`
3. Ejecuta el script (Run o Ctrl+Enter)
4. Verifica que se hayan creado las tablas:
   - `tipo_usuarios`
   - `empresas`
   - `usuarios`

### 3. Configurar JavaScript

El archivo `js/config.js` lee automáticamente las credenciales de `SUPABASE_CONFIG.txt`.

## 🔐 Autenticación

- **Login**: Usuario, Empresa y Contraseña
- **Tipos de Usuario**:
  - **Super Administrador** (ID: 1): Acceso completo
  - **Administrador** (ID: 2): Acceso al dashboard
  - **Empleado** (ID: 3): Acceso limitado (pendiente de implementar)

## 📝 Usuarios Iniciales

El script `database_setup.sql` crea usuarios de ejemplo:
- **Super Admin**: `Super Admin` / Empresa: `Toys Walls` / Contraseña: `superadmin123`
- **Admin**: `admin` / Empresa: `Toys Walls` / Contraseña: `admin123`

## 🎨 Características

- ✅ Autenticación por usuario, empresa y contraseña
- ✅ Dashboard para administradores
- ✅ Edición de perfil con verificación de contraseña
- ✅ Gestión de logos de empresa
- ✅ Diseño responsive y moderno

## 📱 Páginas

### Login.html
Página de inicio de sesión con:
- Selección de empresa (dropdown)
- Campo de usuario
- Campo de contraseña con toggle de visibilidad
- Botón de registro que redirige a WhatsApp

### dashboard.html
Dashboard principal (solo para administradores) con:
- Header con logo de empresa y nombre
- Bienvenida personalizada
- Nombre de usuario clickeable para editar perfil
- Modal de edición de perfil:
  - Edición de nombre de usuario
  - Edición de email
  - Cambio de contraseña
  - Requiere contraseña actual para cualquier cambio

## 🔧 Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Supabase (PostgreSQL + API REST)
- **Iconos**: Font Awesome 6.4.0
- **Hosting**: Compatible con cualquier hosting estático

## 📄 Licencia

Proyecto privado - Toys Walls

