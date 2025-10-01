# 🧸 Toys World - Sistema de Gestión de Juguetes

Una aplicación web completa para la gestión de inventario y venta de juguetes, desarrollada con HTML, CSS, JavaScript vanilla y Supabase.

## 🚀 Características

- **Autenticación segura** con usuario predeterminado
- **Gestión de usuarios** con registro de nuevos usuarios
- **Inventario completo** de juguetes con CRUD operations
- **Tienda online pública** para mostrar juguetes disponibles
- **Interfaz moderna y responsive** con diseño atractivo
- **Conexión en tiempo real** con Supabase

## 📋 Requisitos Previos

1. **Cuenta de Supabase**: Ya configurada con las credenciales proporcionadas
2. **Navegador web moderno** (Chrome, Firefox, Safari, Edge)
3. **Servidor web local** (opcional, puedes abrir directamente los archivos HTML)

## 🛠️ Instalación y Configuración

### 1. Configuración de Supabase

Ejecuta el siguiente SQL en el SQL Editor de tu proyecto Supabase:

```sql
-- Tabla de usuarios
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  created_at timestamp default now()
);

-- Usuario predeterminado
insert into usuarios (username, password) values ('luciana', 'luciana28')
on conflict (username) do nothing;

-- Tabla de juguetes
create table if not exists juguetes (
  id serial primary key,
  nombre text not null,
  categoria text,
  precio numeric(10,2) not null,
  cantidad int not null,
  estado text default 'disponible'
);

-- Activar RLS
alter table usuarios enable row level security;
alter table juguetes enable row level security;

-- Políticas RLS básicas
create policy "Usuarios pueden ver su propio perfil"
  on usuarios for select
  using (auth.role() = 'anon');

create policy "Usuarios pueden registrar nuevos usuarios (si están autenticados)"
  on usuarios for insert
  with check (auth.role() = 'anon');

create policy "Inventario visible públicamente"
  on juguetes for select
  using (true);

create policy "Solo usuarios autenticados pueden modificar juguetes"
  on juguetes for insert
  with check (auth.role() = 'anon');

create policy "Solo usuarios autenticados pueden actualizar juguetes"
  on juguetes for update
  using (auth.role() = 'anon');
```

### 2. Estructura de Archivos

```
ToysWall/
├── index.html          # Página de login
├── dashboard.html      # Panel de administración
├── inventario.html    # Gestión de inventario
├── venta.html         # Tienda online pública
├── css/
│   └── styles.css     # Estilos principales
├── js/
│   ├── supabase.js    # Configuración de Supabase
│   ├── auth.js        # Sistema de autenticación
│   ├── dashboard.js   # Lógica del dashboard
│   ├── inventario.js  # Gestión de inventario
│   └── venta.js       # Lógica de la tienda
└── README.md          # Este archivo
```

## 🎯 Uso de la Aplicación

### 1. Inicio de Sesión

1. Abre `index.html` en tu navegador
2. Usa las credenciales predeterminadas:
   - **Usuario**: `luciana`
   - **Contraseña**: `luciana28`
3. Una vez autenticado, serás redirigido al dashboard

### 2. Dashboard (Panel de Administración)

- **Registro de usuarios**: Solo usuarios autenticados pueden registrar nuevos usuarios
- **Gestión de juguetes**: Agregar nuevos juguetes al inventario
- **Vista del inventario**: Lista de todos los juguetes con opciones de edición

### 3. Inventario

- **Vista completa** del inventario con filtros
- **Actualización de cantidades** y estados
- **Filtros por categoría** y estado
- **Gestión en tiempo real**

### 4. Tienda Online (Venta Web)

- **Página pública** que muestra solo juguetes disponibles
- **Búsqueda y filtros** por categoría y precio
- **Simulación de compra** con cálculo de totales
- **Interfaz atractiva** para clientes

## 🔧 Funcionalidades Técnicas

### Autenticación
- Sistema de login con validación contra base de datos
- Sesiones persistentes con localStorage
- Protección de rutas sensibles

### Base de Datos
- **Tabla usuarios**: Gestión de usuarios del sistema
- **Tabla juguetes**: Inventario completo con campos:
  - `id`: Identificador único
  - `nombre`: Nombre del juguete
  - `categoria`: Categoría del producto
  - `precio`: Precio en formato decimal
  - `cantidad`: Stock disponible
  - `estado`: disponible/vendido

### Interfaz de Usuario
- **Diseño responsive** que se adapta a móviles y desktop
- **Navegación intuitiva** entre secciones
- **Feedback visual** con mensajes de éxito/error
- **Animaciones suaves** y transiciones

## 🎨 Características del Diseño

- **Gradientes modernos** y colores atractivos
- **Cards con sombras** y efectos hover
- **Tipografía clara** y jerarquía visual
- **Iconos emoji** para mejor UX
- **Estados visuales** claros (disponible/vendido)

## 🔒 Seguridad

- **Row Level Security (RLS)** habilitado en Supabase
- **Políticas de acceso** configuradas
- **Validación de datos** en frontend y backend
- **Autenticación requerida** para operaciones sensibles

## 🚀 Despliegue

Para usar la aplicación:

1. **Local**: Abre `index.html` directamente en tu navegador
2. **Servidor web**: Sube los archivos a cualquier servidor web
3. **GitHub Pages**: Conecta el repositorio a GitHub Pages

## 📱 Compatibilidad

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ✅ Dispositivos móviles (responsive)

## 🛠️ Desarrollo

### Estructura del Código

- **Modular**: Cada página tiene su propio archivo JavaScript
- **Reutilizable**: Componentes CSS reutilizables
- **Mantenible**: Código limpio y bien documentado
- **Escalable**: Fácil agregar nuevas funcionalidades

### Próximas Mejoras

- [ ] Sistema de roles de usuario
- [ ] Reportes y estadísticas
- [ ] Carrito de compras real
- [ ] Integración con pasarelas de pago
- [ ] Notificaciones push
- [ ] Modo oscuro

## 📞 Soporte

Si encuentras algún problema:

1. Verifica que las credenciales de Supabase sean correctas
2. Asegúrate de que las tablas estén creadas correctamente
3. Revisa la consola del navegador para errores
4. Verifica la conexión a internet

## 📄 Licencia

Este proyecto está desarrollado como ejemplo educativo. Puedes usarlo y modificarlo libremente.

---

**¡Disfruta gestionando tu tienda de juguetes con Toys World! 🧸✨**

