# Desarrollo — levantar y probar el proyecto

Stack: **Electron + Vue 3 + Vite** (orquestado con `electron-vite`) y **SQLite** local (`better-sqlite3`).

## 1. Requisitos

- Node.js 22 LTS (ya instalado: `node -v`)
- npm (ya instalado: `npm -v`)
- En Linux/macOS con Node 22+ no hace falta compilador C++: `better-sqlite3` v13 usa binarios
  precompilados (N-API), no requiere `node-gyp`.

> **Importante — rutas con espacios**: esta carpeta del proyecto está dentro de
> `Planta de Hielo/`, que tiene un espacio en el nombre. `better-sqlite3` funciona igual porque
> usa un binario ya compilado, pero si en el futuro agregas otra dependencia nativa que sí
> necesite compilarse (`node-gyp`), el build va a fallar por el espacio en la ruta
> (limitación conocida de `node-gyp`, no de este proyecto). Si eso pasa, la solución es mover el
> proyecto a una ruta sin espacios.

## 2. Instalar dependencias

```bash
npm install
```

Esto también corre automáticamente `electron-builder install-app-deps` (script `postinstall`),
que intenta recompilar los módulos nativos para la versión de Node embebida en Electron. Es
normal ver un aviso de `better-sqlite3` si tu ruta tiene espacios (ver nota arriba); no es un
error bloqueante porque igual se usa el binario precompilado.

## 3. Levantar en modo desarrollo

```bash
npm run dev
```

Esto:

1. Compila `src/main` y `src/preload` con `electron-vite`.
2. Levanta el servidor Vite del renderer (Vue) con hot-reload en `http://localhost:5173`.
3. Abre la ventana de Electron apuntando a ese servidor.
4. Al arrancar, el proceso principal corre las migraciones SQLite automáticamente
   (`src/main/db/migrate.js`) y crea el archivo `planta-hielo.db`.

Deberías ver la ventana con el título "Planta de Hielo POS" y una pantalla de prueba
"Usuarios" que lee y escribe directo contra SQLite a través de IPC (`window.api.usuarios.*`).
Usarla (crear un usuario desde el formulario) es la forma más rápida de confirmar que toda la
cadena Vue → preload → IPC → servicio → repositorio → SQLite funciona.

### Dónde queda la base de datos

- **Windows**: `%APPDATA%\planta-hielo-pos\planta-hielo.db`
- **Linux**: `~/.config/planta-hielo-pos/planta-hielo.db`
- **macOS**: `~/Library/Application Support/planta-hielo-pos/planta-hielo.db`

Podés inspeccionarla con cualquier cliente SQLite (ej. [DB Browser for SQLite](https://sqlitebrowser.org/)).

Para borrar todo y volver a probar desde cero, simplemente borrá ese archivo (y los
`.db-shm` / `.db-wal` que lo acompañan) y volvé a correr `npm run dev`.

## 4. Estructura del código

```
src/
├── main/                     # proceso principal (Node, acceso total al SO)
│   ├── index.js               # crea la ventana, corre migraciones, registra IPC
│   ├── db/
│   │   ├── connection.js      # abre la conexión SQLite (better-sqlite3)
│   │   ├── migrate.js         # corre migraciones .sql pendientes al iniciar
│   │   └── migrations/        # scripts .sql versionados (001_init.sql, 002_...)
│   ├── repositories/          # una clase/módulo por tabla, solo SQL
│   ├── services/               # lógica de negocio (usa uno o varios repos)
│   └── ipc/                   # handlers que exponen los services al renderer
├── preload/
│   └── index.js                # puente seguro (contextBridge) entre main y renderer
└── renderer/                   # la app Vue (sin acceso a Node ni al filesystem)
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/
        ├── pages/
        ├── components/
        └── store/
```

**El renderer nunca toca SQLite ni el filesystem directamente.** Todo pasa por
`window.api.*` (expuesto en `src/preload/index.js`), que llama IPC → `ipc/*.ipc.js` →
`services/*.service.js` → `repositories/*.repo.js`.

### Cómo agregar una funcionalidad nueva (ejemplo: "clientes")

1. Agregá la tabla en una migración nueva: `src/main/db/migrations/002_clientes.sql` (si la
   tabla ya existe en `001_init.sql`, saltá este paso).
2. Creá `src/main/repositories/clientes.repo.js` con las consultas SQL.
3. Creá `src/main/services/clientes.service.js` con la lógica de negocio.
4. Creá `src/main/ipc/clientes.ipc.js` y registralo en `src/main/ipc/index.js`.
5. Exponé los métodos nuevos en `src/preload/index.js` dentro de `api.clientes`.
6. Consumilos desde una página Vue en `src/renderer/src/pages/` vía `window.api.clientes.*`.

El ejemplo de `usuarios` (repo + service + ipc + página `Home.vue`) sigue exactamente este
patrón — usalo como plantilla.

## 5. Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Modo desarrollo con hot-reload |
| `npm run build` | Compila main/preload/renderer a `out/` (sin empaquetar instalador) |
| `npm run start` | Sirve el build de `out/` en modo preview (sin hot-reload) |
| `npm run build:win` | Compila y genera el instalador `.exe` (ver `Docs/compilar.md`) |

## 6. Problemas comunes

- **La ventana queda en blanco**: revisá la consola del proceso principal (terminal donde
  corriste `npm run dev`) y las DevTools de la ventana (se abren con Ctrl+Shift+I).
- **Error de `better-sqlite3` al instalar**: confirmá que estás en Node 22 LTS
  (`node -v`) y volvé a correr `npm install`.
- **Cambios en `src/main` o `src/preload` no se reflejan**: `electron-vite dev` reinicia solo
  el proceso principal automáticamente al guardar; si no lo hace, parate la terminal
  (Ctrl+C) y volvé a correr `npm run dev`.
