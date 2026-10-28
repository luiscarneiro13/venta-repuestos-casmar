# Compilar el proyecto como .exe (Windows)

Se usa [`electron-builder`](https://www.electron.build/) con target `nsis`, que genera un
instalador `.exe` para Windows (arquitectura x64).

## Opción A — Compilar desde Windows (recomendado)

Es la forma más simple y la que da menos problemas, porque no hace falta emular nada.

1. Instalá Node.js 22 LTS.
2. Cloná/copiá el proyecto.
3. Instalá dependencias:
   ```powershell
   npm install
   ```
4. Generá el instalador:
   ```powershell
   npm run build:win
   ```
5. El instalador queda en:
   ```
   release/planta-hielo-pos-<version>-setup.exe
   ```
6. Probalo ejecutándolo — instala la app, crea acceso directo y la agrega al menú inicio
   (configurado en `electron-builder.yml`).

## Opción B — Compilar un .exe desde Linux o macOS

`electron-builder` puede generar el instalador de Windows (`nsis`) sin tener Windows, pero
**necesita Wine instalado** para poder editar el ícono/metadatos del `.exe` — esto lo verificamos
directamente: sin Wine, el build falla en el paso de firmar/editar el ejecutable
(`wine process failed ENOENT`).

### B.1 — Instalando Wine

En Debian/Ubuntu:

```bash
sudo apt update
sudo apt install wine wine64
```

Después corré igual que en Windows:

```bash
npm run build:win
```

### B.2 — Sin instalar Wine (alternativa rápida)

Si no querés instalar Wine, podés desactivar el paso que edita el `.exe` (ícono/versión). El
instalador se genera igual y funciona, solo que el ejecutable queda con el ícono genérico de
Electron en vez de uno personalizado. Agregá esto a `electron-builder.yml`:

```yaml
win:
  executableName: planta-hielo-pos
  signAndEditExecutable: false
  target:
    - target: nsis
      arch:
        - x64
```

Y compilá normal:

```bash
npm run build:win
```

## Notas importantes

- **El instalador no está firmado digitalmente.** No configuramos ningún certificado de code
  signing (es un trámite pago aparte). Esto es normal para desarrollo/uso interno: al instalar
  en Windows, es posible que aparezca la advertencia de "Windows protegió su PC" (SmartScreen).
  Se puede continuar con "Más información" → "Ejecutar de todas formas". Si más adelante se
  necesita evitar esa advertencia, hay que comprar un certificado de firma de código y
  configurarlo en `electron-builder.yml` (clave `win.certificateFile` / `win.certificatePassword`,
  o firma en la nube tipo Azure Trusted Signing).
- **Ícono de la app**: por ahora no hay un ícono personalizado (`electron-builder` avisa
  "default Electron icon is used"). Para poner uno propio, agregá un archivo
  `build/icon.ico` (mínimo 256x256) — `electron-builder` lo toma automáticamente por convención.
- **Dónde queda el resultado**: siempre en `release/` (configurado en `electron-builder.yml`,
  clave `directories.output`). Esa carpeta está en `.gitignore`, no se versiona.
- **Solo empaquetar sin instalador** (para probar rápido sin generar el `.exe` final):
  ```bash
  npm run build:dir
  ```
  Esto deja la app "descomprimida" en `release/win-unpacked/`, con el `.exe` ejecutable directo
  ahí adentro — útil para probar más rápido durante el ajuste del empaquetado.
- **Cambiar el nombre/versión del instalador**: se controla desde `package.json`
  (`name`, `version`) y `electron-builder.yml` (`productName`).
