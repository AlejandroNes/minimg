// Prueba del React real mediante CDP. Tauri se simula; Rust se prueba con cargo test.
// Requiere Vite y Chrome de pruebas ya iniciados (ver CONTRIBUTING.md).
import assert from 'node:assert/strict';
const debug=process.env.MINIMG_TEST_DEBUG_URL ?? 'http://127.0.0.1:9239';
const app=process.env.MINIMG_TEST_APP_URL ?? 'http://127.0.0.1:1441/';
const target=await(await fetch(`${debug}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression:`(() => eval(${JSON.stringify(expression)}))()`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Tiempo de espera: '+expression);};
const click=async text=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);
const sectionCount=()=>evaluate(`document.querySelector('[data-step="1"] ul')?.children.length ?? 0`);
try {
await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1180,height:850,deviceScaleFactor:1,mobile:false});
await call('Page.addScriptToEvaluateOnNewDocument',{source:`
localStorage.clear();localStorage.setItem('image-compressor-settings-v1',JSON.stringify({username:42,theme:'invalid',soundOnFinish:false}));localStorage.setItem('image-compressor-preferences-v1',JSON.stringify({outputFormat:42,advancedEnabled:'yes'}));
window.nativeTest={calls:[],dialogs:[],hold:false,fail:false,cancelled:false,failCancel:false,failShow:false,errors:[],urls:new Set(),holdThumb:false};
window.addEventListener('error',e=>nativeTest.errors.push(String(e.error)));window.addEventListener('unhandledrejection',e=>nativeTest.errors.push(String(e.reason)));
const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const value=create(blob);nativeTest.urls.add(value);return value;};URL.revokeObjectURL=value=>{nativeTest.urls.delete(value);revoke(value);};
let callback=0,listener=0;const callbacks=new Map(),listeners=new Map();
window.emitDrop=paths=>{for(const [id,item] of listeners)if(item.event==='tauri://drag-drop')callbacks.get(item.handler)?.({event:item.event,id,payload:{paths,position:{x:0,y:0}}});};
window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:fn=>{callbacks.set(++callback,fn);return callback;},unregisterCallback:id=>callbacks.delete(id),invoke:async(command,args)=>{
 nativeTest.calls.push(command);
 if(command==='plugin:event|listen'){listeners.set(++listener,args);return listener;}
 if(command==='plugin:event|unlisten'){listeners.delete(args.eventId);return;}
 if(command==='plugin:app|version')return '1.0.0';
 if(command==='updates_configured')return false;
 if(command==='plugin:dialog|open'){await new Promise(r=>setTimeout(r,30));const next=nativeTest.dialogs.shift();if(next==='ERROR')throw new Error('Diálogo no disponible');return next??null;}
 if(command==='inspect_images'){if(args.paths.some(p=>p.includes('corrupt')))throw new Error('Archivo corrupto');return args.paths.map(path=>({path,name:path.split('/').pop(),width:path.includes('/a.')?300:1000,height:600,size:100000}));}
 if(command==='get_thumbnail'){if(nativeTest.holdThumb)await new Promise(r=>nativeTest.resumeThumb=r);if(args.path.includes('missing'))throw new Error('Archivo eliminado');return Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEFcAAAAASUVORK5CYII='),c=>c.charCodeAt(0)).buffer;}
 if(command==='convert_images'||command==='apply_watermark'){
  nativeTest.cancelled=false;nativeTest.lastChannel=args.onProgress;
  if(nativeTest.hold)await new Promise(r=>nativeTest.resume=r);
  const paths=nativeTest.cancelled?args.request.paths.slice(0,1):args.request.paths;
  const results=paths.map(sourcePath=>({sourcePath,outputPath:nativeTest.fail?null:'/test/output/'+sourcePath.split('/').pop()+'.webp',originalSize:100000,convertedSize:nativeTest.fail?null:60000,savingsPercent:40,finalWidth:300,finalHeight:200,qualityUsed:'85',visualScore:0.98,visualRating:'Excelente',outputFormat:'WebP',preservedOriginal:false,optimized:!nativeTest.fail,success:!nativeTest.fail,error:nativeTest.fail?'Sin espacio disponible':null}));
  results.forEach((result,index)=>args.onProgress.onmessage({completed:index+1,total:args.request.paths.length,result}));return results;
 }
 if(command==='cancel_conversion'){if(nativeTest.failCancel)throw new Error('Cancelación fallida');nativeTest.cancelled=true;nativeTest.resume?.();return;}
 if(command==='plugin:opener|reveal_item_in_dir'||command==='open_output_directory'){if(nativeTest.failShow)throw new Error('Carpeta eliminada');return;}
 return 1;
}};
`});
await call('Page.navigate',{url:app});await waitFor(`!!document.querySelector('[data-step="6"]')`);
assert.equal(await evaluate(`document.body.textContent.includes('Minimg')`),true);
await evaluate(`nativeTest.dialogs.push(['/test/A.jpg','/test/A.jpg','/test/a.jpg','/test/corrupt.png','/test/missing.png','/test/ignored.gif']);const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Arrastra imágenes'));b.click();b.click();`);
await waitFor(`document.querySelector('[data-step="1"] ul')?.children.length===2`);
assert.equal(await evaluate(`nativeTest.calls.filter(c=>c==='plugin:dialog|open').length`),1);
assert.equal(await evaluate(`nativeTest.urls.size`),2);
assert.equal(await evaluate(`document.querySelector('[data-step="1"]').textContent.includes('300 × 600 px')`),true);
await evaluate(`emitDrop(['/test/A.jpg','/test/a.jpg'])`);await new Promise(r=>setTimeout(r,80));assert.equal(await sectionCount(),2);
await evaluate(`nativeTest.dialogs.push('/test/output')`);
// El botón incluye texto descriptivo: localizar por su contenido.
await evaluate(`[...document.querySelectorAll('[data-step="5"] button')].find(b=>b.textContent.includes('Seleccionar carpeta de destino')).click()`);
await waitFor(`document.querySelector('[data-step="6"] button.primary-action:not(:disabled)')`);
await evaluate(`nativeTest.hold=true;const b=document.querySelector('[data-step="6"] button.primary-action');b.click();b.click();`);
await waitFor(`typeof nativeTest.resume==='function'`);
assert.equal(await evaluate(`nativeTest.calls.filter(c=>c==='convert_images').length`),1);
assert.equal(await evaluate(`document.querySelector('[aria-label="Limpiar caché y memoria"]').disabled`),true);
await click('Marca de agua');await click('Quitar todas');await evaluate(`emitDrop(['/test/new.png'])`);
assert.equal(await sectionCount(),2);assert.equal(await evaluate(`!!document.querySelector('[data-step="watermark-1"]')`),false);
await evaluate(`nativeTest.resume()`);await waitFor(`document.body.textContent.includes('2 imágenes guardadas')`);
await evaluate(`nativeTest.lastChannel.onmessage({completed:1,total:99,result:{sourcePath:'/stale'}})`);
assert.equal(await evaluate(`document.body.textContent.includes('100%')`),true);
assert.equal(await evaluate(`document.body.textContent.includes('stale')`),false);
await click('Quitar todas');await waitFor(`!document.querySelector('[data-step="1"] ul')`);assert.equal(await evaluate(`nativeTest.urls.size`),0);
await evaluate(`nativeTest.hold=false;emitDrop(['/test/one.png','/test/two.png'])`);await waitFor(`document.querySelector('[data-step="1"] ul')?.children.length===2`);
await evaluate(`nativeTest.hold=true;nativeTest.resume=null;document.querySelector('[data-step="6"] button.primary-action').click()`);await waitFor(`typeof nativeTest.resume==='function'`);
await click('Detener proceso');await waitFor(`document.body.textContent.includes('Proceso detenido')`);assert.equal(await evaluate(`document.body.textContent.includes('1 de 2 imágenes procesadas')`),true);
await click('Quitar todas');await click('Marca de agua');await waitFor(`!!document.querySelector('[data-step="watermark-1"]')`);
await evaluate(`nativeTest.dialogs.push(['/test/watermark-source.png'])`);await click('Seleccionar o arrastrar imágenes');await waitFor(`!!document.querySelector('[data-step="watermark-1"] ul')`);
await evaluate(`nativeTest.dialogs.push('/test/logo.png')`);
await evaluate(`[...document.querySelectorAll('[data-step="watermark-2"] button')][0].click()`);await waitFor(`document.querySelector('[data-step="watermark-2"]').dataset.complete==='true'`);
await evaluate(`nativeTest.dialogs.push('/test/output')`);await evaluate(`[...document.querySelectorAll('[data-step="watermark-3"] button')][0].click()`);
await waitFor(`!!document.querySelector('button.primary-action:not(:disabled)')`);
await evaluate(`nativeTest.hold=true;nativeTest.fail=true;nativeTest.failCancel=true;nativeTest.resume=null;document.querySelector('button.primary-action:not(:disabled)').click()`);await waitFor(`typeof nativeTest.resume==='function'`);
await click('Detener proceso');await waitFor(`document.body.textContent.includes('Cancelación fallida')`);
assert.equal(await evaluate(`document.querySelector('header nav button').disabled`),true);
await evaluate(`nativeTest.resume()`);await waitFor(`document.body.textContent.includes('Sin espacio disponible')`);
await evaluate(`nativeTest.failShow=true`);await click('Mostrar resultados');await waitFor(`document.body.textContent.includes('Carpeta eliminada')`);
await click('Nuevo lote');await waitFor(`!document.querySelector('[data-step="watermark-1"] ul')`);
await evaluate(`nativeTest.dialogs.push('ERROR')`);await click('Seleccionar o arrastrar imágenes');await waitFor(`document.body.textContent.includes('Diálogo no disponible')`);
await click('Optimizar imágenes');await evaluate(`Object.defineProperty(Storage.prototype,'setItem',{configurable:true,value(){throw new Error('Cuota agotada')}});void 0;`);
await evaluate(`document.querySelector('[aria-label="Abrir configuración"]').click()`);await waitFor(`!!document.querySelector('[role="dialog"]')`);
await click('Oscuro');
await waitFor(`document.documentElement.dataset.theme==='dark'`);
assert.deepEqual(await evaluate(`nativeTest.errors`),[]);
console.log('React verificado: selección mixta, duplicados, drop, doble clic, bloqueos de lote, progreso, resultados finales, cancelación, errores de marca/carpeta/diálogo y preferencias corruptas. Sin errores globales.');
} finally { await call('Page.close').catch(()=>{});ws.close(); }
