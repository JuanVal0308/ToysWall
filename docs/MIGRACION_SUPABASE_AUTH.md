# Migración a Supabase Auth, RLS y stock atómico

Guía para pasar ToysWall del login antiguo (tabla `usuarios` con contraseña en texto plano y la
anon key con acceso total) a **Supabase Auth + RLS**, con las operaciones de stock en funciones
RPC atómicas. Hay **una sola empresa**: no hay políticas por empresa.

Todas las migraciones están en `migrations/` (prefijo `2026_09_30_`), son **idempotentes** (se pueden
ejecutar más de una vez), terminan con una consulta de **VERIFICACIÓN** y tienen su rollback en
`migrations/rollback/<nombre>_rollback.sql`. Se ejecutan completas en el SQL Editor de Supabase.

## Orden de aplicación

| Paso | Qué hacer | ¿La app en producción sigue funcionando? |
|------|-----------|------------------------------------------|
| 1 | Aplicar `01` a `05` | Sí. El login antiguo y la app actual siguen igual (probado con y sin el código nuevo). |
| 2 | Publicar el frontend (ya está en `main`) con el flag **todavía en `false`** | Sí (modo antiguo). |
| 3 | Cambiar el flag a `true` en `js/config.js` y publicar | Sí: login por Supabase Auth, stock por RPC, XML de factura al bucket privado. |
| 4 | Aplicar `06_rls` | Sí, solo con el flag en `true`. **Cierra el acceso anónimo**: el login antiguo deja de funcionar. |
| 5 | Verificar que todos los usuarios inician sesión | — |
| 6 | Aplicar `07_eliminar_passwords` | Sí. Borra las contraseñas en texto plano (sin vuelta atrás). |

En Supabase → Authentication → Providers → Email conviene **desactivar "Allow new users to sign up"**:
las cuentas solo se crean desde la app (RPC `admin_crear_usuario`).

### El flag

```js
// js/config.js
const USAR_SUPABASE_AUTH_POR_DEFECTO = false;   // ← cambiar a true en el paso 3
```

También se puede sobrescribir con `window.ENV.USAR_SUPABASE_AUTH` o `CONFIG_LOCAL.USAR_SUPABASE_AUTH`
(ver `js/config.example.js`). Con `false` todo funciona como antes (tabla `usuarios`, operaciones de stock
desde el navegador).

## Qué hace cada migración

### 01 · `2026_09_30_01_auth_usuarios.sql`
- Crea el esquema `privado` (no expuesto por la API) con los helpers `usuario_actual_id()`,
  `es_usuario_activo()`, `es_admin()` (tipo 1 o 2) y `contexto()`, todos basados en `auth.uid()`.
- Agrega `usuarios.auth_id` (FK a `auth.users`, única) y permite `password` NULL.
- Crea una cuenta de Supabase Auth por usuario **con su contraseña actual** (bcrypt), el correo en
  minúsculas y confirmado, y el mismo UUID de `usuarios.id`. Nadie tiene que cambiar su clave.
- Trigger `usuarios_sincronizar_auth`: mientras el flag siga en `false`, las altas, cambios de correo o
  contraseña y bajas hechas con el login antiguo se replican en Auth.
- RPC `admin_crear_usuario`, `admin_actualizar_usuario`, `admin_eliminar_usuario` (solo admin; solo
  un Super Admin toca Super Admins) y `actualizar_mi_perfil` (exige la contraseña actual). Mínimo 6 caracteres.
- **Verificar:** la consulta final debe mostrar todos los usuarios con `tiene_auth`, `correo_confirmado`
  y `clave_coincide` en `true` e `identidades = 1`.

### 02 · `2026_09_30_02_ventas_ubicacion.sql`
- `ventas.juguete_id`, `tienda_id`, `bodega_id` (de qué registro/ubicación salió el stock) y
  `ventas.usuario_id` (quién la registró). Las ventas antiguas quedan en NULL.
- **Verificar:** aparecen las 4 columnas.

### 03 · `2026_09_30_03_logs_deshacer.sql`
- `logs_deshacer_ventas.usuario_id` pasa de INTEGER a UUID (antes todo insert fallaba con 22P02) y se
  agregan `motivo` (`deshacer` | `devolucion`), `usuario_nombre`, `venta_id`, `juguete_id`,
  `tienda_id`, `bodega_id`. Reemplaza a la antigua `corregir_usuario_id_logs_deshacer.sql`.
- **Verificar:** `usuario_id` es `uuid` y aparecen las columnas nuevas.

### 04 · `2026_09_30_04_stock_rpc.sql`
Funciones `SECURITY DEFINER` con `search_path` fijo, una transacción por llamada y filas bloqueadas
con `FOR UPDATE`. anon no puede ejecutarlas.
- `registrar_venta`: venta normal y al por mayor; descuenta stock y guarda ubicación, usuario, empleado y
  método de pago por ítem; valida el precio mínimo (no admin) y exige cliente en crédito por mayor.
- `revertir_venta`: deshacer y devoluciones parciales o totales; repone **en la ubicación exacta** de la
  venta (si el registro se borró, lo recrea allí) y escribe el log. Un empleado solo deshace sus propias
  ventas de los últimos 30 minutos.
- `transferir_stock`, `revertir_transferencia`, `ejecutar_plan_movimiento` (solo admin).
- **Verificar:** las 5 funciones con `security_definer = true`, `anon_puede = false`, `authenticated_puede = true`.

### 05 · `2026_09_30_05_storage_facturas.sql`
- Crea el bucket **privado** `facturas` (1 MB, solo XML) y el público `juguetes` si faltan; políticas
  `toyswall_*` en `storage.objects` solo para usuarios con sesión activa; columna `facturas.xml_path`.
- El correo lleva una URL firmada de 30 días al XML.
- **Verificar:** bucket `facturas` con `public = false`, 4 políticas `toyswall_*` y la columna `xml_path`.

### 06 · `2026_09_30_06_rls.sql` (aplicar con el flag ya en `true`)
- Vincula usuarios pendientes, borra todas las políticas antiguas de `public`, activa RLS en todas las
  tablas, quita todo privilegio a `anon` y aplica este mapa (leer / insertar / actualizar / borrar):

| Tabla | Leer | Insertar | Actualizar | Borrar |
|-------|------|----------|------------|--------|
| `tipo_usuarios` | con sesión | — | — | — |
| `empresas` | con sesión | — | admin | — |
| `usuarios` | con sesión (sin `password`) | RPC | RPC | RPC |
| bodegas, tiendas, ubicaciones, empleados, juguetes, movimientos, planes, clientes, pagos | con sesión | admin | admin | admin |
| `ventas` | con sesión | admin (el resto usa la RPC) | con sesión | admin |
| `facturas`, `facturas_items` | con sesión | con sesión | admin | admin |
| `logs_deshacer_ventas` | admin | con sesión | — | — |
| `pedidos_venta_por_mayor_empleados` | con sesión | con sesión | con sesión | admin |

  "Con sesión" = usuario autenticado con fila **activa** en `usuarios`. Los usuarios desactivados o
  eliminados quedan bloqueados aunque tengan un token válido.
- **Verificar:** la consulta (a) debe devolver 0 filas (sin tablas sin RLS, sin privilegios para anon,
  sin políticas abiertas, sin usuarios sin cuenta de Auth); la (b) muestra el resumen de políticas.

### 07 · `2026_09_30_07_eliminar_passwords.sql` (último paso)
- Aborta sin cambiar nada si algún usuario no tiene `auth_id`; pone `password = NULL` y agrega el CHECK
  `usuarios_sin_password_plano`. El `DROP COLUMN password` queda comentado (opcional).
- **Verificar:** `con_password = 0` y `sin_auth = 0`.

## Rollback (en orden inverso)

| Rollback | Efecto |
|----------|--------|
| 07 | Quita el CHECK. **Las contraseñas no se recuperan**: después de 07 el login antiguo ya no es posible. |
| 06 | Vuelve a políticas abiertas (`acceso_abierto_*`) y a los permisos de anon: el login antiguo vuelve a funcionar (poner el flag en `false`). |
| 05 | Quita las políticas `toyswall_*` y `xml_path` (no borra los buckets ni los archivos). |
| 04 | Borra las funciones RPC (el frontend con flag `false` no las usa). |
| 03 | Quita las columnas nuevas y vuelve `usuario_id` a INTEGER. |
| 02 | Quita las columnas nuevas de `ventas`. |
| 01 | Borra las RPC, el trigger, el esquema `privado`, `auth_id` y las cuentas de Auth creadas por la migración. No usar después de 07. |

Todo el ciclo (aplicar → rollback → reaplicar, dos veces) se probó sobre una copia local de la base de producción.

## Qué cambia en el frontend con el flag en `true`
- Login con `signInWithPassword` (correo sin distinguir mayúsculas) y validación del nombre de usuario;
  la sesión se revalida en cada carga y el logout cierra la sesión de Auth.
- Usuarios y perfil por RPC (la contraseña nunca se lee ni se escribe en tablas).
- Venta, venta por mayor, deshacer, devolución, abastecer, deshacer abastecer y planes por RPC atómicas.
- Factura: el XML se sube al bucket privado y el mensaje final informa por separado
  `Factura ✓ · XML ✓/✗ (motivo) · Correo ✓/✗`.

Con el flag en `false`, el XML sigue fallando mientras el bucket no exista (paso 05), pero ahora el
mensaje dice la causa real y el correo incluye el XML como texto.
