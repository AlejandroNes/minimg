<p align="center">
  <img src="public/logo.png" alt="Logotipo de Minimg" width="100">
</p>

# Minimg

Aplicación de escritorio gratuita y de código abierto para optimizar, convertir,
redimensionar y añadir marcas de agua a imágenes. Desarrollada por **Nesvatek**
con **Tauri, React y Rust** para Windows y macOS.

[Sitio oficial](https://nesvatek.com/products/minimg/) ·
[Términos y condiciones](https://nesvatek.com/products/minimg/legal/terms) ·
[Política de privacidad](https://nesvatek.com/products/minimg/legal/privacy)

## Características

- Selección de imágenes o arrastrar y soltar archivos; procesamiento por lote.
- Conversión de formato y modos de optimización: recomendado, calidad equilibrada
  y archivo más pequeño.
- Redimensionado y marcas de agua con posición, tamaño y opacidad configurables.
- Elección de carpeta de destino, progreso, cancelación y reintento de archivos fallidos.
- Ajustes avanzados de nombre, peso objetivo, orientación y sobrescritura.

**Formatos de entrada:** JPEG (`.jpg`, `.jpeg`), PNG y WebP.
**Formatos de salida:** JPEG, PNG y WebP, además del modo Automático.
JPEG sustituye la transparencia por un fondo blanco; PNG y WebP la admiten.

## Privacidad

Las imágenes se procesan localmente en tu dispositivo y no se envían a servidores.
El procesamiento funciona sin conexión. El actualizador, cuando se configure,
utilizará internet para consultar y descargar versiones.

## Descarga

La primera versión pública será **1.0.0**. Todavía no hay una release publicada.
Cuando exista el repositorio, los instaladores de Windows y macOS estarán disponibles
en su sección **Releases**. El enlace se añadirá cuando se defina la URL definitiva.

## Ejecutar desde el código

Necesitas Node.js **22.12 o posterior**, npm, Rust estable **1.90 o posterior** y los
[requisitos de Tauri para tu sistema](https://v2.tauri.app/start/prerequisites/).
Desde la carpeta del proyecto:

```sh
npm ci
npm run tauri -- dev
```

Comprobaciones y build de producción para el sistema actual:

```sh
npm run check
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build -- --locked
```

Los paquetes se generan en `src-tauri/target/release/bundle/`.
Para generar instaladores Windows, compila en Windows.
No necesitas API keys ni archivos `.env` para ejecutar el proyecto.

## Reportar errores

Cuando se publique el repositorio, abre una incidencia en la pestaña **Issues**.
Indica la versión de Minimg, sistema operativo, pasos para reproducir el problema
y qué esperabas que ocurriera. Si adjuntas imágenes, capturas o registros, utiliza
datos de ejemplo sin información personal.

## Contribuir

Las correcciones y mejoras son bienvenidas. Sigue los pasos de
[CONTRIBUTING.md](CONTRIBUTING.md).
El historial está en [CHANGELOG.md](CHANGELOG.md); la política SemVer y el
procedimiento de releases están en [UPDATES.md](UPDATES.md).

## Licencia y créditos

Desarrollado por **Nesvatek**. Copyright © 2026 Nesvatek.
El código propio utiliza **GNU General Public License v3.0** (`GPL-3.0-only`);
consulta [LICENSE](LICENSE). Las dependencias y recursos de terceros conservan
sus respectivas licencias, incluida la [licencia de las fuentes Outfit](src/assets/fonts/OFL.txt).
