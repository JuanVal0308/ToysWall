# Arquitectura del Sistema - ToysWall

## 📐 Arquitectura Clean con Principios SOLID

Este proyecto implementa **Clean Architecture** (Arquitectura Limpia) con principios **SOLID**, organizando el código en capas claramente definidas que promueven la mantenibilidad, testabilidad y escalabilidad.

## 🎯 Principios SOLID Aplicados

### 1. **S**ingle Responsibility Principle (Principio de Responsabilidad Única)
Cada clase tiene una única razón para cambiar:
- `Juguete`: Solo representa un juguete
- `ActualizarJuguete`: Solo actualiza juguetes
- `ControladorInventario`: Solo coordina UI de inventario

### 2. **O**pen/Closed Principle (Principio Abierto/Cerrado)
Abierto para extensión, cerrado para modificación:
- Nuevos casos de uso se agregan sin modificar existentes
- Nuevas validaciones se extienden sin cambiar la lógica core

### 3. **L**iskov Substitution Principle (Principio de Sustitución de Liskov)
Las implementaciones son intercambiables:
- `RepositorioJuguetesSupabase` puede ser sustituido por otra implementación (ej: `RepositorioJuguetesFirebase`)
- Cualquier implementación de `IRepositorioJuguetes` es válida

### 4. **I**nterface Segregation Principle (Principio de Segregación de Interfaces)
Interfaces específicas en lugar de generales:
- `IRepositorioJuguetes` solo para operaciones de juguetes
- `IRepositorioUbicaciones` solo para ubicaciones
- `IRepositorioInventario` solo para inventario

### 5. **D**ependency Inversion Principle (Principio de Inversión de Dependencias)
Dependencias apuntan hacia abstracciones:
- Casos de uso dependen de interfaces (`IRepositorio*`), no de implementaciones
- Controladores dependen de casos de uso, no de Supabase directamente

## 📁 Estructura de Carpetas

```
js/
├── dominio/                          # CAPA DE DOMINIO (Core)
│   ├── entidades/                    # Entidades del negocio
│   │   ├── Juguete.js               # Entidad Juguete
│   │   ├── Ubicacion.js             # Entidad Ubicación
│   │   └── InventarioUbicacion.js   # Entidad Inventario por Ubicación
│   ├── repositorios/                 # Interfaces de repositorios (contratos)
│   │   ├── IRepositorioJuguetes.js
│   │   ├── IRepositorioUbicaciones.js
│   │   └── IRepositorioInventario.js
│   └── casos-de-uso/                 # Reglas de negocio de la aplicación
│       ├── ActualizarJuguete.js
│       ├── ObtenerInventarioConsolidado.js
│       ├── ActualizarInventarioUbicacion.js
│       └── ObtenerUbicaciones.js
│
├── aplicacion/                       # CAPA DE APLICACIÓN
│   ├── servicios/                    # Servicios de aplicación (legacy)
│   └── dto/                          # Data Transfer Objects
│
├── infraestructura/                  # CAPA DE INFRAESTRUCTURA
│   ├── repositorios/                 # Implementaciones concretas
│   │   ├── RepositorioJuguetesSupabase.js
│   │   ├── RepositorioUbicacionesSupabase.js
│   │   └── RepositorioInventarioSupabase.js
│   └── configuracion/                # Configuración del sistema
│       ├── inyeccion-dependencias.js # Wire-up de dependencias
│       └── adaptador-legacy.js       # Compatibilidad con código legacy
│
└── presentacion/                     # CAPA DE PRESENTACIÓN
    ├── controladores/                # Controladores de UI
    │   └── ControladorInventario.js
    ├── vistas/                       # Lógica de vistas
    └── componentes/                  # Componentes reutilizables de UI
```

## 🔄 Flujo de Dependencias

```
┌─────────────────────────────────────────┐
│         Presentación (UI)               │
│  ┌───────────────────────────────────┐  │
│  │  ControladorInventario            │  │
│  └──────────────┬────────────────────┘  │
└─────────────────┼───────────────────────┘
                  │ depende de ↓
┌─────────────────┼───────────────────────┐
│         Dominio │(Core)                 │
│  ┌──────────────▼──────────────────┐    │
│  │  Casos de Uso                   │    │
│  │  - ActualizarJuguete           │    │
│  │  - ObtenerInventario           │    │
│  └──────────────┬──────────────────┘    │
│                 │ depende de ↓          │
│  ┌──────────────▼──────────────────┐    │
│  │  IRepositorio* (Interfaces)     │    │
│  └─────────────────────────────────┘    │
└─────────────────┬───────────────────────┘
                  │ implementado por ↓
┌─────────────────┼───────────────────────┐
│   Infraestructura                       │
│  ┌──────────────▼──────────────────┐    │
│  │  RepositorioSupabase            │    │
│  │  (Implementación concreta)      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Regla de Oro**: Las dependencias siempre apuntan hacia adentro (hacia el dominio). El dominio NO conoce la infraestructura ni la presentación.

## 🚀 Cómo Agregar una Nueva Funcionalidad

Sigue estos pasos para agregar una nueva funcionalidad respetando la arquitectura:

### Ejemplo: Agregar funcionalidad de "Transferir Inventario entre Ubicaciones"

#### 1. **Capa de Dominio** - Definir la lógica de negocio

**a) Agregar método a la interfaz del repositorio** (si es necesario)

`js/dominio/repositorios/IRepositorioInventario.js`
```javascript
// Ya existe el método transferir() - usar ese
```

**b) Crear el caso de uso**

`js/dominio/casos-de-uso/TransferirInventario.js`
```javascript
class TransferirInventario {
    constructor(repositorioInventario) {
        this.repositorioInventario = repositorioInventario;
    }

    async ejecutar(jugueteCodigo, origenId, destinoId, cantidad, empresaId) {
        // Validaciones
        if (cantidad <= 0) {
            return { exito: false, mensaje: 'Cantidad inválida' };
        }

        // Ejecutar transferencia
        try {
            await this.repositorioInventario.transferir(
                jugueteCodigo, origenId, destinoId, cantidad, empresaId
            );
            return { exito: true, mensaje: 'Transferencia exitosa' };
        } catch (error) {
            return { exito: false, mensaje: error.message };
        }
    }
}
```

#### 2. **Capa de Infraestructura** - Implementar si es necesario

Si el método no existe en el repositorio, implementarlo en:
`js/infraestructura/repositorios/RepositorioInventarioSupabase.js`

```javascript
// Ya existe la implementación de transferir()
```

#### 3. **Capa de Presentación** - Crear controlador

**a) Agregar método al controlador**

`js/presentacion/controladores/ControladorInventario.js`
```javascript
async transferirInventario(codigo, origenId, destinoId, cantidad, empresaId) {
    const resultado = await this.casoUsoTransferir.ejecutar(
        codigo, origenId, destinoId, cantidad, empresaId
    );
    
    if (resultado.exito) {
        this.mostrarExito(resultado.mensaje);
        await this.cargarInventarioDetalle(empresaId);
    } else {
        this.mostrarError(resultado.mensaje);
    }
    
    return resultado;
}
```

**b) Crear UI y conectar con el controlador**

En el HTML o JavaScript de la vista:
```javascript
document.getElementById('btnTransferir').addEventListener('click', async () => {
    const codigo = document.getElementById('codigoJuguete').value;
    const origen = document.getElementById('ubicacionOrigen').value;
    const destino = document.getElementById('ubicacionDestino').value;
    const cantidad = parseInt(document.getElementById('cantidad').value);
    
    const user = JSON.parse(sessionStorage.getItem('user'));
    await window.controladorInventario.transferirInventario(
        codigo, origen, destino, cantidad, user.empresa_id
    );
});
```

#### 4. **Configuración** - Registrar dependencias

`js/infraestructura/configuracion/inyeccion-dependencias.js`
```javascript
// Agregar en configurarDependencias():
const casoUsoTransferir = new TransferirInventario(repositorioInventario);
contenedor.registrar('casoUsoTransferir', casoUsoTransferir);

// Actualizar ControladorInventario para recibir el nuevo caso de uso
const controladorInventario = new ControladorInventario(
    casoUsoObtenerInventario,
    casoUsoActualizarJuguete,
    casoUsoActualizarInventarioUbicacion,
    casoUsoObtenerUbicaciones,
    casoUsoTransferir  // ← Nuevo
);
```

#### 5. **HTML** - Agregar script

En `dashboard.html`, agregar después de los demás casos de uso:
```html
<script src="js/dominio/casos-de-uso/TransferirInventario.js"></script>
```

## 🧪 Ventajas de esta Arquitectura

### ✅ Testabilidad
- Cada capa se puede probar independientemente
- Los casos de uso son puros y no dependen de UI o BD
- Se pueden crear mocks de repositorios fácilmente

### ✅ Mantenibilidad
- Código organizado y predecible
- Cada pieza tiene una responsabilidad clara
- Cambios en una capa no afectan otras

### ✅ Escalabilidad
- Fácil agregar nuevas funcionalidades
- Estructura clara para el crecimiento
- Preparado para crecer sin refactorizar

### ✅ Independencia
- El dominio no conoce Supabase (se puede cambiar a otro backend)
- La UI no conoce la BD (se puede cambiar React, Vue, etc.)
- Las reglas de negocio están aisladas

## 📝 Nomenclatura en Español

Todo el código está en español para facilitar el mantenimiento por el equipo:

- **Variables**: `empresaId`, `jugueteCodigo`, `ubicacionOrigen`
- **Funciones**: `actualizarJuguete()`, `obtenerInventario()`, `transferir()`
- **Clases**: `Juguete`, `Ubicacion`, `ControladorInventario`
- **Carpetas**: `dominio/`, `casos-de-uso/`, `entidades/`

**Excepciones**: APIs de frameworks (Supabase, JavaScript nativo) mantienen su nomenclatura original.

## 🔧 Migración Gradual

El sistema mantiene compatibilidad con código legacy a través de:

- **AdaptadorInventarioLegacy**: Permite que funciones antiguas usen la nueva arquitectura
- **Variables globales**: `window.controladorInventario` accesible desde cualquier parte
- **Coexistencia**: Código legacy funciona mientras se migra gradualmente

## 📚 Recursos Adicionales

- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://es.wikipedia.org/wiki/SOLID)
- [Dependency Injection](https://es.wikipedia.org/wiki/Inyecci%C3%B3n_de_dependencias)

## 🤝 Contribuir

Al agregar código nuevo:

1. ✅ Seguir la estructura de carpetas establecida
2. ✅ Aplicar principios SOLID
3. ✅ Escribir en español
4. ✅ Documentar las decisiones importantes
5. ✅ Mantener las dependencias apuntando hacia el dominio
