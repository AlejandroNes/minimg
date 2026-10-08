import { setLanguage, detectLanguage } from "../src/i18n/language.ts";
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
setLanguage("es");
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadImageItems } from '../src/imageLoading.ts';
import { loadPreferences } from '../src/preferences.ts';
import { loadSettings, DEFAULT_SETTINGS } from '../src/settings.ts';
import { formatBytes, resizedDimensions } from '../src/formatters.ts';

function fixture() {
  const alive = new Set(); let count=0, pending=0, peak=0;
  const info = path => ({path,name:path.split('/').pop(),width:100,height:80,size:1024});
  const api = {
    inspect: async paths => { if(paths.some(path=>path.includes('corrupt')))throw new Error('Imagen corrupta'); return paths.map(info); },
    thumbnail: async path => {pending++;peak=Math.max(peak,pending);await new Promise(resolve=>setImmediate(resolve));pending--;if(path.includes('missing'))throw new Error('Archivo eliminado');return new ArrayBuffer(1);},
    createUrl:()=>{const url=`blob:${++count}`;alive.add(url);return url;},
    revokeUrl:url=>alive.delete(url),
  };
  return {api,alive,peak:()=>peak};
}

test('selección mixta conserva válidos y comunica corruptos y no compatibles',async()=>{
  const {api,alive}=fixture();
  const result=await loadImageItems(['/foto.png','/corrupt.png','/empty.txt','/missing.jpg'],[],api);
  assert.deepEqual(result.items.map(item=>item.path),['/foto.png']);
  assert.equal(result.errors.length,3);assert.equal(alive.size,1);
});
test('duplicados y selecciones ya existentes no generan miniaturas; distingue mayúsculas',async()=>{
  const {api,alive}=fixture();
  const result=await loadImageItems(['/foto.png','/foto.png','/Foto.png','/old.png'],['/old.png'],api);
  assert.deepEqual(result.items.map(item=>item.path),['/foto.png','/Foto.png']);assert.equal(alive.size,2);
});
test('carga grande limita las miniaturas simultáneas a cuatro',async()=>{
  const f=fixture();const result=await loadImageItems(Array.from({length:100},(_,i)=>`/${i}.png`),[],f.api);
  assert.equal(result.items.length,100);assert.ok(f.peak()<=4);
});
test('desmontar durante la carga libera todas las miniaturas creadas',async()=>{
  const f=fixture();let current=true;const thumbnail=f.api.thumbnail;let calls=0;
  f.api.thumbnail=async path=>{const result=await thumbnail(path);if(++calls===5)current=false;return result;};
  const result=await loadImageItems(Array.from({length:8},(_,i)=>`/${i}.png`),[],f.api,()=>current);
  assert.equal(result.items.length,0);assert.equal(f.alive.size,0);
});
test('un fallo al crear una URL libera las anteriores',async()=>{
  const f=fixture();const create=f.api.createUrl;let calls=0;
  f.api.createUrl=bytes=>{if(++calls===2)throw new Error('Sin memoria');return create(bytes);};
  await assert.rejects(loadImageItems(['/1.png','/2.png'],[],f.api),/Sin memoria/);assert.equal(f.alive.size,0);
});
test('el límite de lote falla antes de llamar al backend',async()=>{
  const f=fixture();f.api.inspect=()=>{throw new Error('No debe ejecutarse');};
  await assert.rejects(loadImageItems(Array.from({length:10001},(_,i)=>`/${i}.png`),[],f.api),/10 000/);
});
test('preferencias corruptas, tipos inválidos y almacenamiento bloqueado usan valores válidos',()=>{
  for(const value of [null,42,[],{username:42,theme:'invalid',soundOnFinish:'yes',watermarkDefaults:{sizePercent:-1,opacity:200,position:'unknown'}}]){
    globalThis.localStorage={getItem:()=>JSON.stringify(value)};
    assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
  }
  globalThis.localStorage={getItem:()=>JSON.stringify({mode:'unknown',outputFormat:42,advancedEnabled:'true',resizeWidth:0,filenameSuffix:[],effort:'invalid'})};
  assert.deepEqual(loadPreferences(),{});
  globalThis.localStorage={getItem:()=>{throw new Error('Storage bloqueado');}};
  assert.deepEqual(loadSettings(),{...DEFAULT_SETTINGS,language:detectLanguage()});assert.deepEqual(loadPreferences(),{});
});
test('preferencias válidas conservan calidad, formato, destino y opciones avanzadas',()=>{
  const stored={mode:'recommended',outputFormat:'jpeg',effort:'maximum',filenameSuffix:'-東京',outputDir:'/destino',advancedEnabled:true,resizeWidth:1500,targetSizeKb:100,applyOrientation:false};
  globalThis.localStorage={getItem:()=>JSON.stringify(stored)};
  assert.deepEqual(loadPreferences(),stored);
});
test('la predicción de redimensionado no amplía imágenes pequeñas',()=>{
  assert.deepEqual(resizedDimensions(300,200,1500,null,true),[300,200]);
  assert.deepEqual(resizedDimensions(2000,1000,1500,null,true),[1500,750]);
  assert.deepEqual(resizedDimensions(100,200,50,50,true),[25,50]);
  assert.deepEqual(resizedDimensions(100,200,50,50,false),[50,50]);
  for(const value of [0,NaN,Infinity,-1])assert.equal(formatBytes(value),'0 B');
  assert.equal(formatBytes(1024),'1,0 KB');
});

test('la instalación bloquea el inicio de imágenes y libera el bloqueo también al fallar',async()=>{
  const {trackUpdateTask,getProcessingActivity}=await import('../src/updater/imageActivity.ts');
  let finish;
  const pending=trackUpdateTask(()=>new Promise(resolve=>{finish=resolve;}));
  assert.equal(getProcessingActivity(),true);
  await assert.rejects(trackUpdateTask(async()=>{}),/operación actual/);
  finish();await pending;assert.equal(getProcessingActivity(),false);
  await assert.rejects(trackUpdateTask(async()=>{throw new Error('Firma incorrecta');}),/Firma/);
  assert.equal(getProcessingActivity(),false);
});
