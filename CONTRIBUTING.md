# Contribuir a Minimg

Repositorio: [AlejandroNes/minimg](https://github.com/AlejandroNes/minimg).

1. Haz un **fork** del repositorio y clona tu copia.
2. Crea una rama para tu cambio, por ejemplo `fix/cancelacion`.
3. Realiza cambios concretos y comprueba que las funciones existentes siguen funcionando.
4. Haz un **commit** con un mensaje claro.
5. Haz **push** de tu rama a tu fork.
6. Abre un **Pull Request** explicando el cambio y cómo lo comprobaste.

Consulta [README.md](README.md#ejecutar-desde-el-código) para ejecutar el proyecto.
Antes de enviar cambios de código, ejecuta `npm run check`, `npm test` y
`cargo test --locked --manifest-path src-tauri/Cargo.toml`, según corresponda.

Usa imágenes de ejemplo sin datos personales y no incluyas credenciales ni claves
privadas. Registra en [CHANGELOG.md](CHANGELOG.md) solo cambios relevantes para
el usuario. Los incrementos de versión se acuerdan al preparar una release,
según [UPDATES.md](UPDATES.md#política-oficial-de-versionamiento).

El código propio se distribuye bajo [GNU GPL v3.0](LICENSE).

## Pruebas de interacción de React

Las pruebas ejecutan React mediante Chrome DevTools Protocol y simulan el IPC
de Tauri; las pruebas Rust comprueban el procesamiento real por separado.
Requiere Node.js 22.12 o posterior y Chrome o Chromium.

1. Inicia Vite con `npm run dev -- --port 1441`.
2. Inicia una instancia separada de Chrome/Chromium con `--headless=new`,
   `--remote-debugging-port=9239` y `--user-data-dir` apuntando a un directorio
   temporal exclusivo. Utiliza la ruta del ejecutable de tu sistema y evita el
   perfil personal del navegador.
3. Ejecuta los recorridos que correspondan al cambio:

   ```sh
   node tests/frontend-stability.mjs
   node tests/frontend-i18n.mjs
   node tests/frontend-critical.mjs
   node tests/frontend-comparison.mjs
   ```

4. Cierra las instancias de Vite y Chrome de pruebas y elimina el perfil temporal.

Puedes cambiar las direcciones mediante `MINIMG_TEST_APP_URL` y
`MINIMG_TEST_DEBUG_URL`. Estos recorridos no sustituyen las pruebas de la aplicación
instalada y de los diálogos nativos en Windows y macOS.

| Recorrido | Qué comprueba |
| --- | --- |
| `frontend-stability.mjs` | Selección, arrastre de archivos, progreso, cancelación, resultados y marcas de agua. |
| `frontend-i18n.mjs` | Detección, migración y persistencia del idioma, cambio durante un lote y distribución a 760 px. |
| `frontend-critical.mjs` | Orientación EXIF, tamaño original, ancho exacto y preferencias compartidas con almacenamiento bloqueado. |
| `frontend-comparison.mjs` | Arrastre de la línea fuera de ambos extremos y regreso, liberación, nuevo arrastre y cancelación. |

`npm test` ejecuta los archivos `*.test.mjs`; estos recorridos del navegador se
ejecutan por separado. Por defecto usan `http://127.0.0.1:1441/` para Vite y
`http://127.0.0.1:9239` para Chrome. Si usas el Vite de desarrollo de Tauri,
indica `MINIMG_TEST_APP_URL=http://127.0.0.1:1420/` al ejecutar cada recorrido.

## Traducciones y comprobación bilingüe

Los catálogos están en `src/i18n/es.ts` y `src/i18n/en.ts`. Añade cada clave y
sus parámetros a ambos idiomas. Los componentes usan `useTranslation()`;
los avisos persistentes guardan `message(clave, parámetros)` y se traducen
con `renderMessage` al mostrarlos. Así cambian de idioma sin recrear procesos.
Para cantidades, usa claves `.one` y `.other` y `plural`. Usa `formatNumber`
únicamente para presentación; los valores de controles y solicitudes conservan
sus números originales.

El idioma se guarda en `minimg-language-v1`, separado de las demás preferencias.
Los errores Rust viajan como `{ code, params }`; el frontend traduce los códigos
`errors.*`. Los registros locales conservan códigos estables y detalles técnicos,
con rutas de origen/destino reducidas cuando corresponda. Los controles nativos,
las notas de versiones y las páginas externas mantienen el idioma de su proveedor.

`npm test` verifica los catálogos, parámetros, plurales, migración y persistencia.
Con Vite y Chrome de pruebas iniciados como se indica arriba, ejecuta también:

```sh
node tests/frontend-i18n.mjs
```

Esta prueba verifica el cambio de idioma con imágenes cargadas, durante el
procesamiento, en marcas de agua y errores, al reiniciar y al restaurar ajustes.
Comprueba también que la interfaz no desborde a 760 px. Para guardar capturas,
indica un directorio existente en `MINIMG_TEST_SCREENSHOTS`.

Las ocho orientaciones EXIF se verifican también en las pruebas Rust.

## Cobertura y validación pendiente

Las comprobaciones recientes pasaron 42 pruebas de JavaScript, 34 de Rust y los
cuatro recorridos de React. Una fixture Rust se omite en la ejecución directa
porque la utiliza su prueba padre como subproceso. Son resultados de las
correcciones del 7 de octubre de 2026, no una certificación de todos los sistemas.

El frontend se compiló para producción y el procesamiento Rust se probó en macOS.
Queda validar los cambios recientes en la aplicación instalada en Windows y
macOS, incluidos diálogos nativos, gestos táctiles, cierre durante un lote y una
actualización firmada completa. Las pruebas de IPC simulado no cubren esos casos.
