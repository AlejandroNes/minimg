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
- Redimensionado preciso por píxel, sin ampliar imágenes pequeñas.
- Marcas de agua por lote con posición, tamaño y opacidad configurables.
- Comparación visual antes/después con una línea que puedes arrastrar hasta ambos
  extremos y regresar sin soltar el botón del ratón.
- Elección de carpeta de destino, progreso, cancelación y reintento de archivos fallidos.
- Corrección de orientación de cámara por defecto, con miniaturas y dimensiones
  que respetan EXIF; puede desactivarse en los ajustes avanzados.
- Ajustes avanzados de nombre, peso objetivo, orientación y sobrescritura.
- Interfaz en español e inglés, con cambio inmediato desde Configuración → Idioma.
  Las instalaciones nuevas detectan el idioma del sistema; las existentes conservan español.
- Preferencias de tema, idioma y sonido. Los cambios de sonido se respetan también
  durante un lote; si no se pueden guardar las preferencias, siguen funcionando
  en la sesión actual.

**Formatos de entrada:** JPEG (`.jpg`, `.jpeg`), PNG y WebP.
**Formatos de salida:** JPEG, PNG y WebP, además del modo Automático.
JPEG sustituye la transparencia por un fondo blanco; PNG y WebP la admiten.

## Uso básico

1. Añade las imágenes mediante selección o arrastrándolas a la ventana.
2. Elige Automático, WebP, JPEG o PNG como formato de salida.
3. Selecciona el modo de optimización.
4. Conserva el tamaño original o reduce el ancho con el control de redimensionado.
5. Elige la carpeta de destino.
6. Inicia la optimización y revisa los resultados. Usa **Comparar** para abrir la
   comparación visual; también puedes mover su línea con las flechas del teclado.

Para añadir una marca de agua, cambia a **Marca de agua**, selecciona las imágenes
y la imagen de la marca, ajusta su posición, tamaño y opacidad y elige el destino.

Los originales no se modifican. En Automático, cuando no hace falta cambiar la
orientación ni las dimensiones y no se obtiene una salida más ligera, se copia
el original a la carpeta de destino y se indica **Ya estaba optimizada**. Un formato
manual, una corrección de orientación o un redimensionado pueden producir una
salida más pesada para respetar lo solicitado. El peso objetivo es un intento,
no una garantía.

Se admiten hasta 10 000 imágenes por lote. Se rechazan archivos mayores de
512 MiB, imágenes de más de 100 megapíxeles y decodificaciones que excedan el
límite de memoria previsto. HEIC y AVIF no están admitidos.

## Privacidad

Las imágenes se procesan localmente en tu dispositivo y no se envían a servidores.
El procesamiento funciona sin conexión. El actualizador está configurado para
consultar versiones en GitHub al iniciar la aplicación y permite una búsqueda
manual desde Configuración. La consulta y la descarga de actualizaciones requieren
internet; la instalación se inicia con la confirmación del usuario.

Las imágenes recodificadas no conservan los metadatos originales. Cuando se copia
un original porque ya estaba optimizado, se conserva el archivo completo, incluidos
sus metadatos. Las preferencias se guardan localmente; los fallos de procesamiento
pueden generar `MinIMG-errors.log` en la carpeta de destino.

Los diálogos del sistema, las notas de versiones y las páginas legales externas
mantienen el idioma de su proveedor.

## Descarga

La versión del proyecto es **1.0.0**. Consulta los instaladores publicados y las
notas de cada versión en [Releases](https://github.com/AlejandroNes/minimg/releases).
El código está en [AlejandroNes/minimg](https://github.com/AlejandroNes/minimg).
La disponibilidad de instaladores depende de las releases publicadas.

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
`npm run build` compila únicamente el frontend; `npm run tauri -- build -- --locked`
genera la aplicación nativa y sus paquetes.

Las pruebas de interacción usan un navegador separado e IPC simulado. Incluyen
idiomas, regresiones de orientación/tamaño/preferencias y el arrastre de comparación.
Consulta [CONTRIBUTING.md](CONTRIBUTING.md#pruebas-de-interacción-de-react) para
prepararlas y ejecutarlas. La cobertura y las comprobaciones nativas pendientes
están en [CONTRIBUTING.md](CONTRIBUTING.md#cobertura-y-validación-pendiente).

## Reportar errores

Abre una incidencia en [Issues](https://github.com/AlejandroNes/minimg/issues).
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
