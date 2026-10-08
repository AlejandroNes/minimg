import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { es } from '../src/i18n/es.ts';
import { en } from '../src/i18n/en.ts';
import { translate, message, renderMessage, plural, formatNumber, LocalizedError } from '../src/i18n/index.ts';
import { detectLanguage, resolveLanguage, loadLanguage, setLanguage, getLanguage, LANGUAGE_KEY, subscribeLanguage } from '../src/i18n/language.ts';
import { loadSettings } from '../src/settings.ts';
import { formatBytes } from '../src/formatters.ts';
import { UpdaterController } from '../src/updater/controller.ts';

const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
const storage = entries => {
  const values = new Map(Object.entries(entries));
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return values;
};

test('catalogs contain the same keys and interpolation parameters', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  for (const key of Object.keys(es)) {
    assert.ok(en[key].trim(), `Empty translation: ${key}`);
    assert.deepEqual(placeholders(en[key]), placeholders(es[key]), key);
    const params = Object.fromEntries(placeholders(es[key]).map(name => [name, 'VALUE']));
    for (const language of ['es', 'en']) assert.doesNotMatch(translate(key, params, language), /\{\w+\}/, key);
  }
});
test('every native error code and result identifier has a translation', () => {
  for (const name of ['security', 'processor', 'commands']) {
    const source = readFileSync(new URL(`../src-tauri/src/${name}.rs`, import.meta.url), 'utf8').split('#[cfg(test)]')[0];
    for (const match of source.matchAll(/app_error!\("([^"]+)"/g)) assert.ok(`errors.${match[1]}` in en, match[1]);
  }
  for (const code of ['not_generated', 'quality_high', 'watermark', 'excellent', 'very_good', 'good', 'review', 'lossless', 'original', 'automatic', 'already_optimized']) assert.ok(`results.${code}` in en);
});
test('locale detection and migration preserve existing Spanish installations', () => {
  assert.equal(detectLanguage(['en-GB']), 'en');
  assert.equal(detectLanguage(['es-BO', 'en']), 'es');
  assert.equal(detectLanguage(['fr', 'en-US']), 'en');
  assert.equal(detectLanguage(['fr']), 'es');
  assert.equal(resolveLanguage(undefined, true, ['en']), 'es');
  assert.equal(resolveLanguage(undefined, false, ['en']), 'en');
  assert.equal(resolveLanguage('en', true, ['es']), 'en');
  assert.equal(resolveLanguage('invalid', true, ['en']), 'es');
  storage({'image-compressor-settings-v1': JSON.stringify({theme:'dark',username:'Ana'})});
  assert.equal(loadLanguage(), 'es');
  const settings = loadSettings();
  assert.equal(settings.theme, 'dark'); assert.equal(settings.username, 'Ana'); assert.equal(settings.language, 'es');
  storage({'image-compressor-preferences-v1': '{}'}); assert.equal(loadLanguage(), 'es');
});
test('language persists separately and notifies subscribers even when storage is blocked', () => {
  const values = storage({}); let notifications = 0;
  const unsubscribe = subscribeLanguage(() => notifications++);
  setLanguage('en'); assert.equal(values.get(LANGUAGE_KEY), 'en'); assert.equal(loadLanguage(), 'en');
  globalThis.localStorage = {getItem: () => {throw Error('blocked');},setItem: () => {throw Error('blocked');}};
  setLanguage('es'); assert.equal(getLanguage(), 'es'); assert.equal(notifications, 2); unsubscribe();
});
test('pluralization and numerical formats match the selected language', () => {
  for (const [language, one, many] of [['es','1 imagen guardada','2 imágenes guardadas'],['en','1 image saved','2 images saved']]) {
    setLanguage(language); assert.equal(plural('images.saved.other',1),one); assert.equal(plural('images.saved.other',2),many);
  }
  setLanguage('es'); assert.equal(formatBytes(1536),'1,5 KB'); assert.equal(formatNumber(40.5),'40,5');
  setLanguage('en'); assert.equal(formatBytes(1536),'1.5 KB'); assert.equal(formatNumber(40.5),'40.5');
});
test('visible messages, nested native errors and user filenames survive language changes', () => {
  const error = {code:'image_invalid',params:{detail:'decoder detail'}};
  const notice = message('watermarkTool.someFilesCouldNotBeAdded', {p0:['my-foto.jpg: ',error]});
  assert.match(renderMessage(notice,'es'),/my-foto.jpg: Imagen inválida: decoder detail/);
  assert.match(renderMessage(notice,'en'),/my-foto.jpg: Invalid image: decoder detail/);
  assert.equal(renderMessage({code:'unrecognized'},'en'),'The operation could not be completed. ');
  const localized = new LocalizedError(message('imageActivity.waitForTheCurrentOperationTo'));
  assert.match(renderMessage(localized,'en'),/Wait for the current operation/);
  assert.match(renderMessage(localized,'es'),/operación actual/);
});
test('an update message changes language without another network request', async () => {
  let checks=0;
  const controller=new UpdaterController({configured:async()=>true,check:async()=>{checks++;throw Error('offline');},relaunch:async()=>{}},()=>false);
  await controller.check(); const state=controller.getSnapshot();
  assert.match(renderMessage(state.message,'en'),/Updates could not be checked/);
  assert.match(renderMessage(state.message,'es'),/No se pudieron comprobar/);
  assert.equal(checks,1); assert.equal(controller.getSnapshot(),state);
});
