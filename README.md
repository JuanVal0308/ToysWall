# Toys Walls - Sistema de Inventario Empresarial

Aplicación web completa de inventario empresarial construida con React, Tailwind CSS, shadcn/ui y Supabase.

## Características

- ✅ Autenticación con Supabase Auth
- ✅ Gestión de inventario (juguetes, categorías, stock por tienda)
- ✅ Registro de ventas
- ✅ Gestión de tiendas (CRUD completo para administradores)
- ✅ Gestión de empleados/vendedores (CRUD)
- ✅ Generación y envío de facturas por correo
- ✅ Control de acceso basado en roles (RLS)
- ✅ Diseño moderno y responsivo

## Requisitos Previos

- Node.js 18+ y npm
- Cuenta de Supabase
- Cuenta de Resend (para envío de correos)

## Instalación

1. Clona el repositorio:
```bash
git clone <tu-repositorio>
cd ToysWall
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
Crea un archivo `.env.local` con:
```
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## Configuración de Supabase

### Tablas necesarias

Asegúrate de tener las siguientes tablas en tu base de datos Supabase:

- `usuarios` (con campos: id, empresa_id, tipo_usuario_id)
- `empresas` (con campo: nombre)
- `tipo_usuarios` (con campo: nombre)
- `juguetes` (con campos: id, empresa_id, nombre, codigo, descripcion, precio, categoria_id)
- `categorias` (con campos: id, empresa_id, nombre)
- `tiendas` (con campos: id, empresa_id, nombre, direccion, telefono)
- `inventario_tiendas` (con campos: id, juguete_id, tienda_id, cantidad)
- `vendedores` (con campos: id, empresa_id, nombre, codigo, email, telefono)
- `ventas` (con campos: id, empresa_id, juguete_id, vendedor_id, precio_venta, metodo_pago, fecha_venta)
- `facturas` (con campos: id, empresa_id, venta_id, nombre_cliente, correo_cliente, total, fecha_factura, items)

### Row Level Security (RLS)

Implementa políticas RLS usando las funciones `current_empresa()` y `current_tipo_usuario()` para asegurar que cada usuario solo pueda acceder a los datos de su empresa.

### Edge Function

1. Crea la Edge Function `send-invoice` en Supabase
2. Configura las variables de entorno:
   - `RESEND_API_KEY`: Tu API key de Resend
   - `SUPABASE_URL`: URL de tu proyecto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key de Supabase

## Deploy en Vercel

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy automático con cada push a la rama principal

## Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── ui/             # Componentes de UI (shadcn/ui)
│   ├── Login.jsx       # Componente de login
│   ├── Layout.jsx      # Layout principal
│   ├── Inventario.jsx  # Módulo de inventario
│   ├── Venta.jsx       # Módulo de ventas
│   ├── Tiendas.jsx     # Módulo de tiendas
│   ├── Empleados.jsx   # Módulo de empleados
│   └── Facturar.jsx    # Módulo de facturación
├── contexts/           # Contextos de React
│   └── AuthContext.jsx # Contexto de autenticación
├── lib/                # Utilidades
│   ├── supabase.js     # Cliente de Supabase
│   └── utils.js        # Utilidades generales
├── App.jsx             # Componente principal
└── main.jsx            # Punto de entrada
```

## Tecnologías Utilizadas

- **React 18** - Framework de UI
- **Vite** - Build tool
- **Tailwind CSS** - Estilos
- **shadcn/ui** - Componentes de UI
- **Supabase** - Backend (Auth, Database, Edge Functions)
- **Resend** - Envío de correos electrónicos

## Licencia

MIT

