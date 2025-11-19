# Guía de Deploy - Toys Walls

## Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://uytbiygaxxephyxsugak.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_aqui
```

### 2. Instalación de Dependencias

```bash
npm install
```

### 3. Desarrollo Local

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Deploy en Vercel

### Opción 1: Deploy desde GitHub

1. Sube tu código a GitHub
2. Ve a [Vercel](https://vercel.com)
3. Importa tu repositorio
4. Configura las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy automático

### Opción 2: Deploy desde CLI

```bash
npm i -g vercel
vercel
```

Sigue las instrucciones y configura las variables de entorno cuando se solicite.

## Configuración de Supabase

### 1. Edge Function: send-invoice

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a Edge Functions
3. Crea una nueva función llamada `send-invoice`
4. Copia el contenido de `supabase/functions/send-invoice/index.ts`
5. Configura las variables de entorno de la función:
   - `RESEND_API_KEY`: Tu API key de Resend
   - `SUPABASE_URL`: URL de tu proyecto (se configura automáticamente)
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key de tu proyecto

### 2. Configuración de Resend

1. Crea una cuenta en [Resend](https://resend.com)
2. Verifica el dominio `toyswalls@gmail.com` o usa un dominio propio
3. Obtén tu API key
4. Configúrala en las variables de entorno de la Edge Function

### 3. Políticas RLS

Ejecuta las migraciones SQL en el SQL Editor de Supabase:

1. Ve a SQL Editor en Supabase Dashboard
2. Ejecuta el contenido de `supabase/migrations/001_initial_setup.sql`
3. Ajusta las políticas según tus necesidades

## Estructura de Base de Datos

Asegúrate de tener las siguientes tablas con sus campos:

### usuarios
- id (uuid, PK)
- empresa_id (integer, FK)
- tipo_usuario_id (integer, FK)

### empresas
- id (integer, PK)
- nombre (text)

### tipo_usuarios
- id (integer, PK)
- nombre (text)

### juguetes
- id (integer, PK)
- empresa_id (integer, FK)
- nombre (text)
- codigo (text)
- descripcion (text)
- precio (numeric)
- categoria_id (integer, FK)

### categorias
- id (integer, PK)
- empresa_id (integer, FK)
- nombre (text)

### tiendas
- id (integer, PK)
- empresa_id (integer, FK)
- nombre (text)
- direccion (text)
- telefono (text)

### inventario_tiendas
- id (integer, PK)
- juguete_id (integer, FK)
- tienda_id (integer, FK)
- cantidad (integer)

### vendedores
- id (integer, PK)
- empresa_id (integer, FK)
- nombre (text)
- codigo (text)
- email (text)
- telefono (text)

### ventas
- id (integer, PK)
- empresa_id (integer, FK)
- juguete_id (integer, FK)
- vendedor_id (integer, FK)
- precio_venta (numeric)
- metodo_pago (text)
- fecha_venta (timestamp)

### facturas
- id (integer, PK)
- empresa_id (integer, FK)
- venta_id (integer, FK)
- nombre_cliente (text)
- correo_cliente (text)
- total (numeric)
- fecha_factura (timestamp)
- items (jsonb)

## Verificación Post-Deploy

1. Verifica que la autenticación funcione
2. Prueba crear un juguete
3. Prueba registrar una venta
4. Prueba generar y enviar una factura
5. Verifica los permisos según el tipo de usuario

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que las variables de entorno estén configuradas en Vercel
- Asegúrate de que los nombres sean exactos: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

### Error al enviar facturas por correo
- Verifica que la Edge Function esté desplegada
- Verifica que `RESEND_API_KEY` esté configurada
- Verifica que el dominio de correo esté verificado en Resend

### Error de permisos (RLS)
- Verifica que las políticas RLS estén configuradas
- Verifica que las funciones `current_empresa()` y `current_tipo_usuario()` existan
- Verifica que el usuario tenga `empresa_id` y `tipo_usuario_id` asignados

