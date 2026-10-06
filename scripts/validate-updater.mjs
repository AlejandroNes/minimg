import assert from "node:assert/strict";

export function validateUpdater(config) {
  const updater = config.plugins?.updater;
  if (!updater) {
    assert.equal(config.bundle.createUpdaterArtifacts, false,
      "Sin configuración del updater, createUpdaterArtifacts debe permanecer en false");
    return;
  }
  assert.ok(typeof updater.pubkey === "string" && updater.pubkey.trim(),
    "El updater necesita el contenido de la clave PÚBLICA real");
  // Evita pegar por error el archivo privado en pubkey, incluso si está en base64.
  const keyText = `${updater.pubkey}\n${Buffer.from(updater.pubkey, "base64").toString("utf8")}`;
  assert.ok(!/private key|secret key|BEGIN .*PRIVATE KEY/i.test(keyText),
    "No se permite incluir una clave privada en la configuración");
  assert.ok(Array.isArray(updater.endpoints) && updater.endpoints.length,
    "El updater necesita al menos un endpoint real");
  for (const endpoint of updater.endpoints) {
    const url = new URL(endpoint);
    assert.ok(endpoint.startsWith("https://") && url.protocol === "https:" && !url.username && !url.password,
      "Los endpoints deben usar HTTPS y no contener credenciales");
  }
  for (const [option, value] of Object.entries(updater)) {
    if (option.startsWith("dangerous") || option.startsWith("dangerous-")) {
      assert.ok(!value, "No se permite desactivar las comprobaciones de transporte o TLS");
    }
  }
  assert.ok(!updater.allowDowngrades && !updater["allow-downgrades"],
    "No se permiten downgrades automáticos");
  assert.equal(config.bundle.createUpdaterArtifacts, true,
    "La distribución con updater debe generar artefactos oficiales firmados");
}
