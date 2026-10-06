# Contribuir a Minimg

Cuando el repositorio esté publicado:

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

## Prueba de interacción de React

`tests/frontend-stability.mjs` verifica selección, arrastre, progreso, cancelación,
marcas de agua y preferencias en React mediante Chrome DevTools Protocol. Simula
el IPC de Tauri; las pruebas Rust comprueban el procesamiento real por separado.
Requiere Node.js 22.12 o posterior y Chrome o Chromium.

1. Inicia Vite con `npm run dev -- --port 1441`.
2. Inicia una instancia separada de Chrome/Chromium con `--headless=new`,
   `--remote-debugging-port=9239` y `--user-data-dir` apuntando a un directorio
   temporal exclusivo. Utiliza la ruta del ejecutable de tu sistema y evita el
   perfil personal del navegador.
3. Ejecuta `node tests/frontend-stability.mjs`.
4. Cierra las instancias de Vite y Chrome de pruebas y elimina el perfil temporal.

Puedes cambiar las direcciones mediante `MINIMG_TEST_APP_URL` y
`MINIMG_TEST_DEBUG_URL`. Este recorrido no sustituye las pruebas de la aplicación
instalada y de los diálogos nativos en Windows y macOS.
