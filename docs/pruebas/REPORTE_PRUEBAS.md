# Reporte de pruebas de punta a punta – ToysWall

**Fecha:** 30 de septiembre de 2026
**Alcance:** aplicación web estática (index.html, dashboard.html y js/) contra la base de producción de Supabase "Toys Wall".
**Método:** pruebas automatizadas con navegador (Playwright) a 1366 px (escritorio) y 375 px (móvil), más consultas directas a la API REST para verificar el efecto real sobre el stock.

> Este documento reemplaza y consolida los reportes/informes sueltos que existían en la raíz del proyecto.

## Reglas de seguridad aplicadas durante las pruebas

- Solo se crearon registros con el prefijo `PRUEBA_` (juguetes, empleados, clientes, tiendas, bodegas, usuarios, facturas) y se borraron al terminar por id exacto o por prefijo.
- Se guardó una foto (snapshot) de todas las tablas antes de empezar y, al final, se comparó fila por fila: **ninguna fila real fue modificada**.
- El envío de correos (EmailJS) se reemplazó por un stub; no salió ningún correo.
- No se modificó el esquema ni las políticas RLS.
- Conteo final: **326 juguetes, todos reales (0 con prefijo PRUEBA_)**, igual que al inicio.
- Excepción: la factura de prueba (`facturas.id = 17`, cliente "PRUEBA_Cliente Factura") y su item (`facturas_items.id = 18`) **no se pudieron borrar** porque RLS no permite DELETE con la anon key. Hay que borrarlos desde el panel de Supabase:
  `delete from facturas_items where id = 18; delete from facturas where id = 17;`

## Bugs encontrados y corregidos

### Inicio de sesión (index.html)
- Se cargaba `js/dominio/Juguete.js`, que ya no existe (404 en consola). Se quitó la referencia.

### Registrar venta
- Sin empleado la venta fallaba con "Cannot read properties of null (reading 'id')" aunque el campo decía "Opcional". Ahora el empleado es opcional de verdad.
- **El stock se descontaba de una fila cualquiera del código** (`limit(1)`), no de la ubicación que se validó al agregar el item. Ahora cada item guarda `juguete_id` y su ubicación, se muestra "Sale de: …" y se descuenta exactamente de esa fila.
- No se validaban las unidades acumuladas (se podía agregar el mismo juguete varias veces y superar el stock), ni cantidades como "abc", "1.5" o negativas, ni precios inválidos.
- Si la inserción de la venta fallaba, el stock ya descontado no se devolvía. Ahora se compensa.
- "Deshacer" sobrescribía la cantidad con un valor absoluto viejo (pisaba otras ventas hechas en el intervalo) y, si el stock había llegado a 0, insertaba filas duplicadas. Ahora borra la venta y suma lo vendido a la cantidad actual.
- El log de deshacer fallaba siempre (error 22P02: `logs_deshacer_ventas.usuario_id` es INTEGER y los usuarios usan UUID). Ahora reintenta con `usuario_id = null`. Se dejó la migración propuesta `migrations/corregir_usuario_id_logs_deshacer.sql` (**no ejecutada**).
- "Facturar" con items sin registrar creaba una factura sin venta y sin descontar stock. Ahora pide registrar la venta primero.
- El doble clic en agregar item, registrar o deshacer duplicaba operaciones. Ahora está protegido.
- El empleado y el método de pago se borraban después de cada item. Ahora se conservan.

### Campos de precio
- Los campos de precio eran `type=number` con formato de miles; los valores ≥ 1.000.000 se vaciaban. Ahora son texto con `inputmode=numeric`.
- Después de limpiar el formulario quedaba guardado el precio anterior en `dataset.numericValue`. Ahora se limpia.

### Ventas al por mayor
- El empleado era obligatorio aunque la etiqueta decía opcional.
- Se aceptaban cantidades negativas o decimales y no se validaban las unidades acumuladas por fila.
- Una venta a crédito no exigía cliente, y el abono podía superar el total.
- Cuando el stock llegaba a 0 se **borraba la fila del juguete**; al deshacer se recreaba sin precio, foto ni ITEM. Ya no se borra.
- **El botón Deshacer nunca funcionaba**: su listener solo se registraba en una rama de respaldo duplicada. Se eliminó la duplicación. Ahora deshacer repone el stock correctamente y avisa si hay pagos asociados que se borrarán en cascada.

### Abastecer / Movimientos
- Se permitía el mismo origen y destino.
- La transferencia borraba y reinsertaba la fila de origen sin revisar errores (se podía perder stock). Ahora usa `servicioStock.transferir`, que compensa el origen si falla el destino.
- Los errores por item no se mostraban: salía "correcto" igual. Ahora se listan.
- El doble clic duplicaba el movimiento.

### Planes de movimiento
- El doble clic en "Guardar plan" creaba 2 planes. Ahora está protegido (verificado: se crea 1).
- Ejecutar plan ahora usa la misma transferencia segura, lista los items omitidos y deja el plan pendiente si no se procesó ninguno.

### Formularios (juguetes, empleados, usuarios, tiendas, bodegas, clientes)
- 13 formularios no tenían protección contra doble envío. El doble clic creaba juguetes y empleados duplicados. Todos usan ahora `preventFormDoubleSubmit`.
- Empleados: se podía crear o editar con un código ya existente. Ahora se bloquea.
- Tiendas/Bodegas: se podían borrar con juguetes dentro; por `ON DELETE SET NULL`, esos juguetes quedaban sin ubicación. Ahora se bloquea con un aviso.
- Eliminar juguete: la confirmación ahora indica la ubicación y aclara que solo se borra ese registro.

### Ajustes / Devoluciones
- El doble clic mostraba dos confirmaciones y podía devolver el stock dos veces. Ahora hay una sola confirmación y un solo incremento (verificado).

### Facturas
- Los montos salían con 3 decimales ("$6.386,555"). Ahora se muestran con máximo 2.

### Mensajes y navegación
- Un temporizador viejo ocultaba antes de tiempo el mensaje nuevo. Se agregó el helper `programarOcultarMensajes`, que reinicia el temporizador.
- Al cambiar de vista quedaban modales abiertos (por ejemplo, "ventas del cliente") que bloqueaban la pantalla. `showView` ahora los cierra.

### Diseño móvil (375 px)
- Las tarjetas del resumen se salían de la pantalla y partían los textos letra por letra (regla base `minmax(250px)` y `grid-column: span 2` en línea). Se corrigió al final de `css/dashboard.css`. Sin desbordes horizontales en las 16 vistas.
- El logo del dashboard daba 403 (imgur rechaza el referer). Se agregó `referrerpolicy="no-referrer"` y un respaldo `onerror`.

## Cambios de arquitectura

- `js/dominio/servicios/ReglasInventario.js`: reglas puras (parseo de cantidad/precio, descripción y selección de ubicación).
- `js/infraestructura/servicios/ServicioStockSupabase.js`: único punto para descontar, reponer y transferir stock, con control de concurrencia optimista y reintentos. Lo usan venta, venta al por mayor, abastecer, planes y deshacer.

## Verificado funcionando

Login y logout; dashboard; crear, editar y eliminar juguete; registrar venta y deshacer (stock exacto); venta al por mayor con cliente, pago y deshacer; abastecer y deshacer; crear, ejecutar y cancelar planes; factura (email stubeado); devolución completa; CRUD de tiendas, bodegas, usuarios y empleados de prueba; email duplicado bloqueado con mensaje visible; exportación a Excel en Análisis. Sin errores de consola en las 16 vistas, a 1366 px y a 375 px.

## Pendientes (no implementados, requieren decisión o cambios de esquema)

1. **Seguridad crítica:** la tabla `usuarios` guarda contraseñas en texto plano legibles con la anon key, y la autenticación ocurre solo en el navegador. Se recomienda migrar a Supabase Auth con RLS por rol.
2. `ventas` no guarda la ubicación de la que salió el stock, así que la devolución repone en una fila cualquiera del mismo código. Propuesta: agregar `juguete_id`/ubicación a `ventas`.
3. El descuento de stock no es atómico entre filas (hay control optimista, pero no una transacción). Propuesta: una función RPC transaccional en Postgres.
4. La subida del XML de la factura a Storage devuelve 400 (probablemente falta el bucket `facturas`), pero la app muestra éxito.
5. El nombre del juguete pasa por `capitalizarPrimeraLetra` ("PRUEBA_X" → "Prueba_x") aunque los nombres reales están en MAYÚSCULAS.
6. Los empleados con reglas especiales (Jose, Sindy) están fijados en el código por nombre.
7. Algunas fotos externas de juguetes dan 403 por el referer.
8. No existe importación de Excel en la app web (solo exportación; la importación está en los scripts Python de `scripts/`).
9. `logs_deshacer_ventas.usuario_id` debería ser UUID (ver la migración propuesta). Además, tras las pruebas la tabla sigue con 0 filas visibles con la anon key: revisar si RLS impide insertar o leer esos logs. El fallo del log no interrumpe el deshacer.
