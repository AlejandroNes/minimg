# Actualizaciones de Minimg

## Política oficial de versionamiento

Minimg utiliza Semantic Versioning con el formato estable **MAJOR.MINOR.PATCH**.
La primera versión pública oficial será **1.0.0**; permanece sin publicar.
Las correcciones realizadas antes de ese lanzamiento forman parte de 1.0.0 y no
provocan un incremento automático de versión.

| Incremento | Cuándo corresponde | Ejemplo |
| --- | --- | --- |
| PATCH | Correcciones de errores o vulnerabilidades, actualización de dependencias, mejoras de estabilidad y pequeños ajustes sin funcionalidades nuevas ni incompatibilidades. | `1.0.0 → 1.0.1` |
| MINOR | Nuevas funcionalidades o mejoras importantes que mantienen compatibilidad con las funcionalidades existentes. | `1.0.1 → 1.1.0` |
| MAJOR | Cambios incompatibles o modificaciones significativas en el comportamiento público de la aplicación. | `1.x.x → 2.0.0` |

Al incrementar MINOR se reinicia PATCH a cero; al incrementar MAJOR se reinician
MINOR y PATCH. Se elige el incremento por el efecto sobre el usuario: una
actualización de dependencias que introduzca incompatibilidades no corresponde
a PATCH. Las versiones estables no llevan prefijo `v`, ceros iniciales ni sufijos.

### Fuente principal y propagación

**`package.json`, campo `version`, es la fuente principal.**

| Consumidor | Cómo obtiene la versión |
| --- | --- |
| `src-tauri/tauri.conf.json` | `"version": "../package.json"`; no contiene otra versión numérica. |
| Interfaz, «Acerca de» | `getVersion()` de Tauri en `src/components/SettingsPanel.tsx`; muestra la versión instalada, sin constante React. |
| Binarios e instaladores de Tauri | Versión resuelta por Tauri desde `package.json`, incorporada al build de cada plataforma. |
| `src-tauri/Cargo.toml` | Copia explícita en `[package].version`, necesaria para el paquete Rust. Debe coincidir con la fuente principal; Cargo no lee este campo de JSON. |
| `package-lock.json` | Copias en `version` y `packages[""].version` del paquete propio. |
| `src-tauri/Cargo.lock` | Copia en la entrada `[[package]]` cuyo `name` es `minimg`. |
| Actualizador | El plugin oficial usa la versión instalada de Tauri y la compara con `version` del manifiesto remoto. React muestra la versión ofrecida por el plugin. |

`npm run check:metadata` verifica formato SemVer y coincidencia del paquete propio
en ambos manifiestos y ambos lockfiles. Se ejecuta también desde `npm run check`
y antes de cada `npm run build`/build de Tauri. Un desfase detiene esas comprobaciones;
no se cambia ninguna versión automáticamente. Un build directo con Cargo no ejecuta
el validador Node: ejecutar primero `npm run check:metadata` en ese caso.
Los cambios de versión del producto no requieren actualizar las dependencias.

### Historial público

[`CHANGELOG.md`](CHANGELOG.md) es el único historial de versiones públicas.
Durante el desarrollo, anotar cambios relevantes para el usuario en **Sin publicar**.
Al preparar una release, convertir esa sección en la versión elegida y añadir
la fecha real de publicación; abrir una nueva sección Sin publicar para el trabajo
siguiente. No presentar 1.0.0 como publicada hasta que lo esté.

Registrar funcionalidades, correcciones, seguridad, estabilidad y cambios de
compatibilidad que afecten al usuario. Omitir tareas internas, refactorizaciones,
listas de commits y actualizaciones de dependencias sin efecto relevante para él.
Usar esa misma entrada como notas de GitHub Release y del updater para evitar
historias distintas de una misma versión.

### Correspondencia con GitHub y versiones inmutables

Cuando exista el repositorio, utilizar esta correspondencia:

| Elemento | Ejemplo |
| --- | --- |
| Versión de la aplicación y `latest.json.version` | `1.1.0` |
| Git tag | `v1.1.0` |
| Título de GitHub Release | `Minimg v1.1.0` |

El título de Release utiliza el nombre oficial Minimg. Para el primer lanzamiento: `1.0.0`, tag `v1.0.0` y título
`Minimg v1.0.0`. No se crea ningún tag o Release durante esta preparación.

**Nunca reutilizar ni sobrescribir una versión publicada:** no mover ni reemplazar
su tag ni sustituir los binarios o firmas de esa versión. Si aparece un error en
una release distribuida, corregirlo y publicar una versión nueva. Las siguientes
versiones públicas deben ser superiores a las ya distribuidas. Antes de elegir
el número, revisar el historial, los tags y las Releases del repositorio real.

### Procedimiento para publicar una nueva versión

1. Elegir el incremento aplicable según esta política. Para el primer lanzamiento
   conservar `1.0.0`; no ejecutar todavía ningún incremento.
2. Cambiar `package.json.version`; reflejar exactamente ese valor en
   `src-tauri/Cargo.toml` y las entradas propias de ambos lockfiles indicadas arriba.
   No cambiar versiones de dependencias. Revisar el diff para confirmar el alcance.
3. Preparar la entrada de `CHANGELOG.md` con cambios relevantes y la fecha real de
   publicación. Mantener Sin publicar si aún no se va a publicar.
4. Ejecutar las verificaciones y construir con las versiones bloqueadas:

   ```sh
   npm run check
   npm test
   cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
   cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
   cargo test --locked --manifest-path src-tauri/Cargo.toml
   npm run tauri -- build -- --locked
   ```

5. Verificar los paquetes en Windows y macOS: versión instalada, funciones
   existentes y actualización desde la versión anterior. Preparar firma y
   notarización con los datos reales; seguir la configuración del updater descrita
   abajo antes de distribuir la primera versión pública.
6. Con el repositorio ya definido y los cambios revisados, crear el tag `vVERSION`
   sobre el commit de esos builds y la Release `Minimg vVERSION`. Adjuntar los
   artefactos correspondientes a ese commit y sus firmas. Copiar la entrada del
   changelog como notas y usar `VERSION` sin `v` en el manifiesto del updater.
7. Verificar descarga, firma e instalación antes de anunciar la release. El archivo
   de descubrimiento `latest.json` puede avanzar a la nueva versión; los artefactos
   ya publicados de versiones anteriores permanecen inmutables.

## Estado actual

La aplicación usa Tauri 2.11.5 con los plugins oficiales `tauri-plugin-updater`
2.12.0 y `tauri-plugin-process` 2.3.1, y sus bindings JavaScript de la misma versión.
Cargo.lock y package-lock.json fijan las versiones instaladas. Windows y macOS son
las plataformas de distribución previstas. El actualizador requiere Rust 1.90 o
posterior.

**El actualizador está preparado, pero desactivado:** no hay `plugins.updater` en
`src-tauri/tauri.conf.json` y `bundle.createUpdaterArtifacts` es `false`.
Todavía no se configuraron claves públicas ni endpoints de distribución.

**Antes de distribuir la primera versión pública, activa el actualizador con los
datos reales y vuelve a compilar.** Una instalación distribuida con el actualizador
desactivado no puede obtener automáticamente una versión que lo active; necesitaría
una instalación manual inicial del paquete correctamente configurado.

## Experiencia implementada

- Una comprobación automática dos segundos después de iniciar la aplicación,
  únicamente cuando existen endpoint y clave pública configurados.
- Sin nueva versión o sin conexión, la comprobación automática no abre avisos.
  La solicitud de comprobación tiene un timeout de 15 segundos.
- Configuración incluye «Buscar actualizaciones». La búsqueda manual informa
  cuando no hay nuevas versiones, falta la configuración o existe un error.
- Una actualización disponible muestra versión, notas si existen, «Actualizar» y
  «Más tarde». Las notas se muestran como texto, sin ejecutar HTML o Markdown.
- «Más tarde» conserva la oferta durante la sesión y permite retomarla desde
  Configuración; no descarga ni instala nada. La comprobación vuelve a realizarse
  al iniciar otra sesión o mediante la búsqueda manual cuando no hay oferta pendiente.
- La instalación solo empieza al pulsar «Actualizar». Se muestra progreso cuando
  se conoce el tamaño, o una descarga indeterminada. La descarga tiene un timeout
  de 120 segundos; puede ajustarse si los paquetes reales o las conexiones lo exigen.
- No se instala mientras hay un lote de conversión o marcas de agua activo. El
  seguimiento continúa aunque se cambie de herramienta. El aviso se presenta
  cuando termina el procesamiento. La actualización puede cerrar o reiniciar la
  aplicación, por lo que el aviso pide guardar los resultados antes de continuar.
- En Windows el plugin inicia el instalador y cierra la aplicación; el modo
  predeterminado es `passive`. En macOS se solicita el reinicio con el plugin oficial
  `process`. Si falla, se informa que la actualización ya está instalada y se permite
  reintentar el reinicio sin descargar ni instalar otra vez.
- Los errores de descarga, firma e instalación se muestran y permiten reintentar.
  Los recursos del updater se liberan al reemplazar una oferta o cerrar la aplicación.

## Arquitectura

| Archivo | Responsabilidad |
| --- | --- |
| `src-tauri/src/updates.rs` | Comprueba si hay configuración real y comunica su disponibilidad a React. |
| `src-tauri/src/lib.rs` | Registra el updater solo cuando está configurado; registra `process` en Windows/macOS. |
| `src-tauri/capabilities/updates.json` | Permite exclusivamente comprobar, descargar/instalar y reiniciar desde la ventana principal en las plataformas previstas. |
| `src/updater/controller.ts` | Estados, consentimiento, errores, recursos y secuencia de instalación/reinicio. |
| `src/updater/imageActivity.ts` | Observa los lotes activos sin modificar sus resultados ni procesamiento. |
| `src/hooks/useUpdater.ts` | Conecta React con los plugins oficiales y la comprobación inicial. |
| `src/components/UpdatePanel.tsx`, `UpdateDialog.tsx` | Búsqueda manual y aviso de actualización. |
| `scripts/validate-updater.mjs` | Valida la configuración durante `npm run check` y `npm run build`. |
| `tests/updater.test.mjs` | Pruebas del flujo con un adaptador simulado, sin instalar software ni generar claves. |

La consulta y descarga HTTPS se realizan desde Rust. No se amplió la CSP de React
ni se añadieron permisos de HTTP, shell o ejecución arbitraria. La verificación
criptográfica y la instalación quedan a cargo del plugin oficial; no se implementó
un mecanismo alternativo de descarga o firma.

## Datos necesarios para activarlo

1. **Repositorio público definitivo:** propietario y nombre exactos de GitHub.
2. **Endpoint HTTPS real del manifiesto:** la URL del archivo `latest.json` publicado
   como asset de la última release estable de ese repositorio. Obtenerla de GitHub
   cuando exista el repositorio; no usar la página HTML de Releases como endpoint.
3. **Par de claves de firma del updater:** generar mediante el comando oficial
   `npm run tauri -- signer generate` y elegir explícitamente un destino privado
   fuera del proyecto. Este comando no se ejecutó durante la preparación.
4. **Clave pública:** copiar el contenido del archivo público generado a
   `plugins.updater.pubkey`; no una ruta al archivo. Es publicable.
5. **Clave privada y contraseña:** mantenerlas fuera del repositorio, con respaldo
   seguro. Solo se necesitan en el entorno de compilación de releases. No pegarlas
   en código, JSON, documentación, logs ni archivos `.env` del proyecto.
6. **Arquitecturas y formatos finales:** decidir cuáles se distribuirán y comprobar
   que cada plataforma tenga su artefacto correcto y su firma correspondiente.

## Configuración posterior

En `src-tauri/tauri.conf.json`, cuando tengas los datos reales:

1. Añadir `plugins.updater.pubkey` con la clave pública del CLI.
2. Añadir `plugins.updater.endpoints` como array con la URL HTTPS real del manifiesto.
3. Cambiar `bundle.createUpdaterArtifacts` a `true`.
4. Conservar los valores seguros predeterminados: TLS válido, transporte HTTPS y
   versiones estrictamente superiores. No activar opciones `dangerous*` ni
   `allowDowngrades`. El validador de compilación rechaza esos cambios inseguros.
5. Ejecutar `npm run check` y `npm run test:updater`.

El código detecta la configuración automáticamente; no es necesario editar React
para activar endpoints. No se aceptan claves privadas en `pubkey`. El validador no
reemplaza la validación criptográfica de la clave y de los paquetes por Tauri.

Para compilar artefactos firmados, Tauri lee `TAURI_SIGNING_PRIVATE_KEY` y, si procede,
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` del entorno del proceso de compilación. Los
archivos `.env` no sustituyen estas variables para la firma. En la futura CI deben
inyectarse desde secretos de GitHub Actions; no escribirse en el workflow. No se
configuró ningún workflow de releases en esta preparación.

La firma del updater es diferente de la firma de código de Windows y de la firma y
notarización de Apple. Estas últimas se prepararán con los certificados/cuentas
reales antes de distribuir; no se generaron ni configuraron ahora.

## GitHub Releases y manifiesto

Puede utilizarse posteriormente la acción oficial `tauri-apps/tauri-action` para
compilar y publicar los artefactos y el JSON del updater. Debe configurarse con el
repositorio definitivo, las plataformas elegidas y los secretos reales de firma.
También puede publicarse un `latest.json` correcto manualmente.

El manifiesto estático debe contener:

- `version`: versión SemVer de la release, coherente con los manifiestos del proyecto.
- `notes`: cambios de esa versión, opcional.
- `pub_date`: fecha RFC 3339, opcional.
- `platforms`: entradas por sistema y arquitectura. Windows usa `windows`, macOS
  usa `darwin`; las arquitecturas incluyen `x86_64` y `aarch64` según lo distribuido.
- Cada entrada debe contener `url` con la URL HTTPS real del artefacto y `signature`
  con el **contenido** de su archivo `.sig`, no la ruta ni URL de la firma.

Para macOS, el updater utiliza el archivo `.app.tar.gz` firmado, no el `.dmg`.
Para Windows, utiliza el instalador MSI o NSIS firmado. Si se ofrecen ambos, generar
entradas específicas para cada formato según el manifiesto producido por la acción
oficial y comprobar ambos recorridos; no mezclar instaladores de arquitecturas o
formatos diferentes. No se añadió un manifiesto ficticio con URLs o firmas vacías.

Mantener constantes `com.alejandro.webpcompressor`, el editor y el código MSI
`bef0c2be-1a03-5cae-adc2-efb6115bdf2d` en las releases. Mantener también la clave
pública de verificación: cambiarla exige una estrategia de migración de los clientes.
Antes de publicar, evaluar `requireSignedVersion` con la versión del CLI utilizada
y verificar que las firmas incluyan la versión firmada; esta opción debe probarse
con los artefactos reales antes de activarla.

## Verificación antes de distribuir

```sh
npm run check
npm run test:updater
npm run tauri -- build -- --locked
```

Después de activar la firma, probar desde una instalación real de una versión
anterior en Windows y macOS: actualización válida, firma incorrecta, manifiesto
inválido, misma versión, sin conexión, falta de permisos de instalación y fallo de
reinicio. Comprobar que las preferencias y el procesamiento se conservan.

Las pruebas automatizadas actuales validan el flujo de la aplicación y su manejo
de errores con respuestas simuladas; no sustituyen una instalación real firmada ni
la prueba del servicio de GitHub, que todavía no existe.

Referencias: [Updater oficial de Tauri](https://v2.tauri.app/plugin/updater/),
[API JavaScript](https://v2.tauri.app/reference/javascript/updater/),
[acción oficial de Tauri](https://github.com/tauri-apps/tauri-action).
