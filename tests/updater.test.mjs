import test from "node:test";
import assert from "node:assert/strict";
import { UpdaterController } from "../src/updater/controller.ts";
import { trackImageTask, getImageActivity } from "../src/updater/imageActivity.ts";
import { validateUpdater } from "../scripts/validate-updater.mjs";

function fixture(overrides = {}, busy = () => false) {
  const calls = [];
  const update = {
    version: "1.1.0", body: "Cambios de la versión\n<script>texto sin ejecutar</script>",
    close: async () => { calls.push("close"); },
    downloadAndInstall: async (onEvent) => {
      calls.push("install");
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 100 } });
      onEvent({ event: "Finished" });
    },
  };
  const api = {
    configured: async () => true,
    check: async () => { calls.push("check"); return update; },
    relaunch: async () => { calls.push("relaunch"); },
    ...overrides,
  };
  return { controller: new UpdaterController(api, busy), calls, update };
}

test("sin configuración no se consulta la red ni se instala", async () => {
  const { controller, calls } = fixture({ configured: async () => false });
  await controller.check(true);
  await controller.install();
  assert.equal(controller.getSnapshot().phase, "unconfigured");
  assert.deepEqual(calls, []);
});

test("desconexión automática silenciosa; búsqueda manual informa del error", async () => {
  const { controller } = fixture({ check: async () => { throw new Error("offline"); } });
  await controller.check(true);
  assert.equal(controller.getSnapshot().message, "");
  assert.equal(controller.getSnapshot().promptOpen, false);
  await controller.check();
  assert.equal(controller.getSnapshot().phase, "error");
  assert.match(controller.getSnapshot().message, /offline/);
});

test("sin nueva versión no se abre un aviso ni se descarga", async () => {
  const { controller, calls } = fixture({ check: async () => null });
  await controller.check();
  assert.equal(controller.getSnapshot().phase, "current");
  assert.equal(controller.getSnapshot().promptOpen, false);
  assert.deepEqual(calls, []);
});

test("versión y notas se ofrecen sin instalar; Más tarde permite retomar", async () => {
  const { controller, calls, update } = fixture();
  await controller.check(true);
  assert.equal(controller.getSnapshot().update.version, update.version);
  assert.equal(controller.getSnapshot().update.notes, update.body);
  controller.later();
  assert.equal(controller.getSnapshot().promptOpen, false);
  controller.show();
  assert.equal(controller.getSnapshot().promptOpen, true);
  assert.deepEqual(calls, ["check"]);
});

test("un lote activo impide instalar y reiniciar", async () => {
  const { controller, calls } = fixture({}, () => true);
  await controller.check();
  await controller.install();
  assert.match(controller.getSnapshot().message, /procesamiento/);
  assert.deepEqual(calls, ["check"]);
});

test("firma rechazada por el plugin informa del error y nunca reinicia", async () => {
  const { controller, update, calls } = fixture();
  update.downloadAndInstall = async () => { throw new Error("Invalid signature"); };
  await controller.check();
  await controller.install();
  assert.equal(controller.getSnapshot().phase, "error");
  assert.match(controller.getSnapshot().message, /Invalid signature/);
  assert.deepEqual(calls, ["check"]);
});

test("solo después de instalar se libera el recurso y se reinicia", async () => {
  const { controller, calls } = fixture();
  await controller.check();
  await controller.install();
  await controller.install();
  assert.equal(controller.getSnapshot().phase, "installed");
  assert.equal(controller.getSnapshot().downloaded, 100);
  assert.deepEqual(calls, ["check", "install", "close", "relaunch"]);
});

test("fallo de reinicio conserva el estado instalado y permite reintentarlo", async () => {
  let attempts = 0;
  const { controller, calls } = fixture({ relaunch: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("restart failed");
  } });
  await controller.check();
  await controller.install();
  assert.equal(controller.getSnapshot().phase, "installed");
  assert.match(controller.getSnapshot().message, /no se pudo reiniciar/);
  await controller.restart();
  assert.equal(attempts, 2);
  assert.equal(calls.filter((call) => call === "install").length, 1);
});

test("una comprobación que termina tras desmontar libera su recurso", async () => {
  let resolveCheck;
  const pending = new Promise((resolve) => { resolveCheck = resolve; });
  const { controller, update, calls } = fixture({ check: () => pending });
  const checking = controller.check();
  await new Promise((resolve) => setImmediate(resolve));
  controller.dispose();
  resolveCheck(update);
  await checking;
  assert.deepEqual(calls, ["close"]);
});

test("la actividad de dos lotes persiste hasta que ambos terminan, también al fallar", async () => {
  let complete;
  const first = trackImageTask(() => new Promise((resolve) => { complete = resolve; }));
  assert.equal(getImageActivity(), true);
  await assert.rejects(trackImageTask(async () => { throw new Error("image error"); }));
  assert.equal(getImageActivity(), true);
  complete();
  await first;
  assert.equal(getImageActivity(), false);
});

test("configuración desactivada válida; artefactos sin clave y claves privadas se rechazan", () => {
  validateUpdater({ bundle: { createUpdaterArtifacts: false } });
  assert.throws(() => validateUpdater({ bundle: { createUpdaterArtifacts: true } }));
  assert.throws(() => validateUpdater({ bundle: { createUpdaterArtifacts: true }, plugins: {
    updater: { pubkey: "PRIVATE KEY" },
  } }), /clave privada/);
});

test("clics repetidos comprueban e instalan una única vez", async () => {
  const { controller, calls } = fixture();
  await Promise.all([controller.check(), controller.check(), controller.check()]);
  await Promise.all([controller.install(), controller.install(), controller.install()]);
  assert.equal(calls.filter(call => call === "check").length, 1);
  assert.equal(calls.filter(call => call === "install").length, 1);
});
