# Estructura del proyecto Electron — POS Planta de Hielo

## Árbol de carpetas

```
planta-hielo-pos/
├── package.json
├── electron-builder.yml              # config del instalador para Windows
├── src/
│   ├── main/                          # PROCESO PRINCIPAL (Node.js, acceso total al SO)
│   │   ├── index.js                   # punto de entrada, crea BrowserWindow
│   │   ├── db/
│   │   │   ├── connection.js          # abre/crea el SQLite local (better-sqlite3)
│   │   │   ├── migrations/            # scripts .sql versionados (001_init.sql, 002_...)
│   │   │   └── migrate.js             # corre migraciones pendientes al iniciar
│   │   ├── repositories/              # una clase por tabla, solo SQL, sin lógica de negocio
│   │   │   ├── usuarios.repo.js
│   │   │   ├── tasasCambio.repo.js
│   │   │   ├── precios.repo.js
│   │   │   ├── clientes.repo.js
│   │   │   ├── ventas.repo.js
│   │   │   ├── pagos.repo.js
│   │   │   ├── creditos.repo.js
│   │   │   └── cierresCaja.repo.js
│   │   ├── services/                  # lógica de negocio (usa varios repos)
│   │   │   ├── autenticacion.service.js
│   │   │   ├── tasaCambio.service.js  # valida y registra tasa del día
│   │   │   ├── ventas.service.js      # crea venta + detalle + credito si aplica, en una transacción
│   │   │   ├── pagos.service.js
│   │   │   ├── cierreCaja.service.js
│   │   │   └── sync.service.js        # sube/baja cambios contra MySQL en la nube
│   │   ├── ipc/                       # handlers que exponen los services al renderer
│   │   │   ├── auth.ipc.js
│   │   │   ├── ventas.ipc.js
│   │   │   ├── tasas.ipc.js
│   │   │   ├── clientes.ipc.js
│   │   │   └── sync.ipc.js
│   │   ├── printer/
│   │   │   └── ticket.printer.js      # arma y envía el ticket a la impresora térmica (Bluetooth)
│   │   └── preload.js                 # puente seguro entre main y renderer (contextBridge)
│   │
│   └── renderer/                      # PROCESO DE INTERFAZ (React o Vue, sin acceso a Node)
│       ├── index.html
│       ├── main.jsx
│       ├── App.jsx
│       ├── router/
│       ├── pages/
│       │   ├── LoginTasa.jsx          # modal de login + edición de tasa (punto 6)
│       │   ├── Ventas/
│       │   │   ├── NuevaVenta.jsx
│       │   │   └── HistorialVentas.jsx
│       │   ├── Clientes/
│       │   ├── Creditos/
│       │   ├── CierreCaja/
│       │   └── Configuracion/
│       │       └── Precios.jsx        # CRUD del catálogo de precios (imagen del Excel)
│       ├── components/
│       ├── hooks/
│       │   └── useApi.js              # wrapper de window.api.* (expuesto por preload)
│       └── store/                     # estado global (zustand/redux): tasa activa, usuario, carrito
│
└── resources/
    └── icons/
```

## Cómo se conecta con el modelo de datos

- **`repositories/`** son el único lugar que escribe SQL — un método por operación (`crear`, `buscarPorId`, `listar`, etc.), mapeando 1 a 1 con las tablas que ya definimos.
- **`services/ventas.service.js`** es el que orquesta la regla más delicada del negocio: crear una venta implica, en una sola transacción SQLite (`db.transaction(...)`):
  1. Tomar la tasa vigente (`tasaCambio.service`).
  2. Insertar en `ventas`.
  3. Insertar cada línea en `venta_detalle`.
  4. Si `tipo_pago = 'credito'`, validar que el cliente no tenga deuda pendiente y crear el registro en `creditos`.
  5. Encolar el cambio en `sync_queue`.
  6. Enviar el ticket a imprimir (`printer/ticket.printer.js`).
- **`preload.js`** expone solo funciones puntuales al renderer (nunca `require` directo), por ejemplo:
  ```js
  contextBridge.exposeInMainWorld('api', {
    login: (usuario, password) => ipcRenderer.invoke('auth:login', usuario, password),
    obtenerTasaActual: () => ipcRenderer.invoke('tasas:actual'),
    actualizarTasa: (valor) => ipcRenderer.invoke('tasas:actualizar', valor),
    crearVenta: (venta) => ipcRenderer.invoke('ventas:crear', venta),
  });
  ```
- **El renderer nunca toca SQLite ni el sistema de archivos directamente** — todo pasa por `window.api.*`, que internamente llama IPC → service → repository.

## Librerías sugeridas

| Necesidad | Librería |
|---|---|
| SQLite local | `better-sqlite3` (síncrono, rápido, ideal para Electron) |
| Impresión térmica por Bluetooth | `node-thermal-printer` o `escpos` con transporte Bluetooth serial |
| Empaquetado del instalador .exe | `electron-builder` |
| UI | React + Vite, o Vue 3 + Vite |
| Estado global | `zustand` (ligero) |
| Sync con MySQL en la nube | `mysql2` desde un servicio backend propio (API REST), no conexión directa desde el Electron |

## Flujo de sincronización (resumen)

1. Toda escritura local pasa primero por SQLite y encola un registro en `sync_queue`.
2. Un proceso en `sync.service.js` corre cada X minutos (o al detectar conexión con `navigator.onLine` / ping) y envía los pendientes a un endpoint REST propio que escribe en MySQL.
3. Al confirmar éxito, marca `sincronizado = 1` en el registro local.
4. Para consulta remota (reportes desde otro país), esos reportes leen directamente de MySQL — nunca del Electron en sitio.

¿Quieres que profundice en el flujo de la transacción de venta (services/ventas.service.js) con el pseudocódigo completo, o en cómo estructurar la app REST intermedia para la sincronización con MySQL?
