import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { validateUpdater } from "./validate-updater.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const config = JSON.parse(read("src-tauri/tauri.conf.json"));
validateUpdater(config);
const cargoManifest = read("src-tauri/Cargo.toml");
const cargo = cargoManifest.split(/^\[/m).find((part) => part.startsWith("package]"));
const field = (name) => JSON.parse(cargo.match(new RegExp(`^${name} = (.+)$`, "m"))?.[1] ?? "null");
const html = read("index.html");
const meta = (name) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];

assert.equal(config.productName, "Minimg", "El nombre oficial debe ser Minimg");
assert.equal(pkg.name, config.productName.toLowerCase(), "El paquete npm debe usar minimg");
assert.equal(field("name"), pkg.name, "El nombre del paquete Cargo difiere de npm");
assert.equal(lock.name, pkg.name, "El nombre del lockfile difiere de npm");
assert.equal(lock.packages[""].name, pkg.name, "El nombre raíz del lockfile difiere de npm");
const binary = cargoManifest.match(/^\[\[bin\]\]\s*\nname = "([^"]+)"/m)?.[1];
assert.equal(binary, config.productName, "El binario Cargo debe usar el nombre oficial");
const library = cargoManifest.match(/^\[lib\]\s*\nname = "([^"]+)"/m)?.[1];
assert.equal(library, `${pkg.name}_lib`, "La biblioteca Rust debe usar minimg_lib");
assert.ok(read("src-tauri/src/main.rs").includes(`${library}::run()`), "main.rs debe usar la biblioteca configurada");
assert.ok(config.bundle.longDescription.startsWith(`${config.productName} `), "La descripción extensa debe usar el nombre oficial");

assert.equal(config.version, "../package.json", "Tauri debe usar la versión de package.json");
assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "La versión pública debe ser MAJOR.MINOR.PATCH, sin ceros iniciales");
assert.equal(field("version"), pkg.version, "La versión de Cargo difiere de npm");
const cargoLockPackage = read("src-tauri/Cargo.lock").split(/^\[\[package\]\]$/m)
  .find((part) => part.match(/^name = "([^"]+)"$/m)?.[1] === pkg.name);
assert.ok(cargoLockPackage, "El paquete propio no aparece en Cargo.lock");
assert.equal(cargoLockPackage.match(/^version = "([^"]+)"$/m)?.[1], pkg.version, "La versión propia de Cargo.lock difiere de npm");
assert.equal(lock.version, pkg.version, "La versión de package-lock.json difiere de npm");
assert.equal(lock.packages[""].version, pkg.version, "La versión raíz del lockfile difiere de npm");
assert.equal(field("description"), pkg.description, "La descripción de Cargo difiere de npm");
assert.deepEqual(field("authors"), [pkg.author], "El autor de Cargo difiere de npm");
assert.equal(field("homepage"), pkg.homepage, "El sitio de Cargo difiere de npm");
assert.equal(config.bundle.homepage, pkg.homepage, "El sitio de Tauri difiere de npm");
assert.equal(config.bundle.shortDescription, pkg.description, "La descripción de Tauri difiere de npm");
assert.equal(config.app.windows[0].title, config.productName, "El título de ventana difiere del nombre oficial");
assert.equal(config.mainBinaryName, config.productName, "El ejecutable difiere del nombre oficial");
assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], config.productName, "El título HTML difiere del nombre oficial");
assert.equal(meta("description"), pkg.description, "La descripción HTML difiere de npm");
assert.equal(meta("author"), pkg.author, "El autor HTML difiere de npm");
assert.equal(meta("copyright"), config.bundle.copyright, "El copyright HTML difiere de Tauri");
assert.equal(pkg.author, config.bundle.publisher, "El desarrollador difiere del editor de Tauri");
assert.equal(pkg.license, "GPL-3.0-only", "La licencia propia debe ser GNU GPL v3.0");
assert.equal(field("license"), pkg.license, "La licencia de Cargo difiere de npm");
assert.equal(lock.packages[""].license, pkg.license, "La licencia raíz del lockfile difiere de npm");
assert.equal(config.bundle.license, pkg.license, "La licencia de Tauri difiere de npm");
assert.equal(config.bundle.licenseFile, "../LICENSE", "Tauri debe incluir LICENSE");
assert.equal(config.bundle.resources["../LICENSE"], "licenses/MinIMG-GPL-3.0.txt");
assert.match(read("LICENSE"), /GNU GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/);

for (const icon of config.bundle.icon) {
  assert.ok(readFileSync(new URL(`../src-tauri/${icon}`, import.meta.url)).length, `Icono vacío: ${icon}`);
}

// Revisar únicamente código y documentación propios, nunca dependencias o artefactos.
const checkBranding = (path) => {
  const url = new URL(`../${path}`, import.meta.url);
  for (const entry of readdirSync(url, { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) checkBranding(child);
    else if (entry.isFile() && /\.(tsx?|rs|css)$/.test(entry.name)) {
      assert.doesNotMatch(read(child), /webp[-_]compressor|Krimage|OptIMG/, `Nombre anterior en ${child}`);
      assert.doesNotMatch(read(child), /(?:compres|compress)or[ _-]*pro\b/i, `Nombre anterior en ${child}`);
    }
  }
};
checkBranding("src");
checkBranding("src-tauri/src");
for (const path of ["README.md", "UPDATES.md"]) {
  // El nombre oficial permite la grafía Minimg en código y documentación.
  assert.doesNotMatch(read(path), /webp[-_]compressor|Krimage|OptIMG/, `Nombre anterior en ${path}`);
  assert.doesNotMatch(read(path), /(?:compres|compress)or[ _-]*pro\b/i, `Nombre anterior en ${path}`);
}
console.log(`Metadatos coherentes: ${config.productName} ${pkg.version}`);
