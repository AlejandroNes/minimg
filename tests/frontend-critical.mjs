import assert from 'node:assert/strict';
import { tauriFixture } from './frontend-fixture.mjs';
const debug=process.env.MINIMG_TEST_DEBUG_URL ?? 'http://127.0.0.1:9239';
const app=process.env.MINIMG_TEST_APP_URL ?? 'http://127.0.0.1:1441/';
const target=await(await fetch(`${debug}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression:`(() => eval(${JSON.stringify(expression)}))()`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timeout: '+expression);};
const click=async text=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);
const change=async language=>{await evaluate(`const input=document.querySelector('#application-language');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,${JSON.stringify(language)});input.dispatchEvent(new Event('change',{bubbles:true}));`);await waitFor(`document.documentElement.lang===${JSON.stringify(language)}`);};
const openSettings=async()=>{await evaluate(`document.querySelector('header button[title="Settings"],header button[title="Configuración"]').click()`);await waitFor(`!!document.querySelector('#application-language')`);};
const closeSettings=()=>evaluate(`document.querySelector('[aria-label="Close settings"],[aria-label="Cerrar configuración"]').click()`);
const findings = [];
const check = (actual, expected, label) => { if (actual !== expected) findings.push({label,actual,expected}); };
try {
 await call('Page.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1180,height:850,deviceScaleFactor:1,mobile:false});
 const fixture = tauriFixture.replace("soundOnFinish:false", "soundOnFinish:true").replace("width:path.includes('/a.')?300:1000", "width:path.includes('/a.')?300:1003");
 await call('Page.addScriptToEvaluateOnNewDocument',{source:fixture+`
 nativeTest.requests=[];nativeTest.soundCount=0;
 window.__TAURI_INTERNALS__.invoke=new Proxy(window.__TAURI_INTERNALS__.invoke,{apply:(target,receiver,args)=>{if(args[0]==='convert_images'||args[0]==='apply_watermark')nativeTest.requests.push(args[1].request);return Reflect.apply(target,receiver,args);}});
 class FakeAudioContext {
  constructor(){nativeTest.soundCount++;this.currentTime=0;this.destination={};}
  createOscillator(){return {frequency:{value:0},connect(){},start(){},stop(){}};}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
  close(){return Promise.resolve();}
 }
 window.AudioContext=FakeAudioContext;
 `});
 await call('Page.navigate',{url:app});await waitFor(`!!document.querySelector('[data-step="6"]')`);
 await evaluate(`nativeTest.dialogs.push(['/test/odd.jpg']);[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Arrastra imágenes')).click()`);
 await waitFor(`!!document.querySelector('[data-step="1"] ul')`);
 check(await evaluate(`document.querySelector('[data-step="4"] input[type="range"]').value`),'1003','Resize control must preserve widths that are not multiples of ten');
 await evaluate(`nativeTest.dialogs.push('/test/output');[...document.querySelectorAll('[data-step="5"] button')].find(b=>b.textContent.includes('Seleccionar carpeta')).click()`);
 await waitFor(`!!document.querySelector('button.primary-action:not(:disabled)')`);
 await evaluate(`document.querySelector('button.primary-action').click()`);await waitFor(`nativeTest.requests.length===1 && document.body.textContent.includes('1 imagen guardada')`);
 check(await evaluate(`nativeTest.requests[0].resizeWidth`),null,'Keeping original size must not send a resize limit');
 check(await evaluate(`nativeTest.requests[0].applyOrientation`),true,'Default conversion must normalize camera orientation before removing EXIF');
 await evaluate(`document.querySelector('details.advanced-panel').open=true`);
 await evaluate(`document.querySelector('[aria-label="Activar ajustes avanzados"]').click()`);
 await evaluate(`[...document.querySelectorAll('label.option-toggle')].find(label=>label.textContent.includes('Corregir fotos giradas')).querySelector('input').click()`);
 await evaluate(`document.querySelector('button.primary-action').click()`);await waitFor(`nativeTest.requests.length===2 && document.body.textContent.includes('1 imagen guardada')`);
 check(await evaluate(`nativeTest.requests[1].applyOrientation`),false,'Explicit advanced orientation opt-out must be respected');
 await click('Marca de agua');await waitFor(`!!document.querySelector('[data-step="watermark-1"]')`);
 await evaluate(`nativeTest.dialogs.push(['/test/source.png'])`);await click('Seleccionar o arrastrar imágenes');await waitFor(`!!document.querySelector('[data-step="watermark-1"] ul')`);
 await evaluate(`nativeTest.dialogs.push('/test/logo.png');document.querySelector('[data-step="watermark-2"] button').click()`);await waitFor(`document.querySelector('[data-step="watermark-2"]').dataset.complete==='true'`);
 await evaluate(`nativeTest.dialogs.push('/test/output');document.querySelector('[data-step="watermark-3"] button').click()`);await waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Aplicar marca de agua'&&!b.disabled)`);
 // Disable sounds while the watermark tool is already mounted; persistence fails.
 await openSettings();
 await evaluate(`Object.defineProperty(Storage.prototype,'setItem',{configurable:true,value(){throw Error('Storage full')}});[...document.querySelectorAll('label.option-toggle')].find(label=>label.textContent.includes('Sonido al terminar')).querySelector('input').click();nativeTest.soundCount=0;`);
 await closeSettings();await click('Aplicar marca de agua');await waitFor(`nativeTest.requests.length===3 && document.querySelector('[data-step="watermark-1"]').parentElement.parentElement.textContent.includes('1 imagen guardada')`);
 check(await evaluate(`nativeTest.soundCount`),0,'Watermark must use current sound preference, including when storage is unavailable');
 await click('Optimizar imágenes');await evaluate(`nativeTest.soundCount=0;document.querySelector('button.primary-action').click()`);await waitFor(`nativeTest.requests.length===4 && document.body.textContent.includes('1 imagen guardada')`);
 check(await evaluate(`nativeTest.soundCount`),0,'Optimization must use in-memory settings when storage is unavailable');
 // Changing the preference during an active batch must also take effect at completion.
 await openSettings();await evaluate(`[...document.querySelectorAll('label.option-toggle')].find(label=>label.textContent.includes('Sonido al terminar')).querySelector('input').click()`);await closeSettings();
 await evaluate(`nativeTest.hold=true;nativeTest.resume=null;nativeTest.soundCount=0;document.querySelector('button.primary-action').click()`);await waitFor(`typeof nativeTest.resume==='function'`);
 await openSettings();await evaluate(`[...document.querySelectorAll('label.option-toggle')].find(label=>label.textContent.includes('Sonido al terminar')).querySelector('input').click()`);await closeSettings();
 await evaluate(`nativeTest.resume()`);await waitFor(`nativeTest.requests.length===5 && document.body.textContent.includes('1 imagen guardada')`);
 check(await evaluate(`nativeTest.soundCount`),0,'Preference changes during a batch must be applied at completion');
 // Camera metadata must update sizing when orientation correction is toggled.
 await evaluate(`window.__TAURI_INTERNALS__.invoke=new Proxy(window.__TAURI_INTERNALS__.invoke,{apply:(target,receiver,args)=>args[0]==='inspect_images'&&args[1].paths.includes('/test/camera.jpg')?Promise.resolve([{path:'/test/camera.jpg',name:'camera.jpg',width:800,height:1200,encodedWidth:1200,encodedHeight:800,size:100000}]):Reflect.apply(target,receiver,args)});nativeTest.hold=false;`);
 await click('Quitar todas');
 await evaluate(`nativeTest.dialogs.push(['/test/camera.jpg']);[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Arrastra imágenes')).click()`);
 await waitFor(`document.querySelector('[data-step="1"]').textContent.includes('camera.jpg')`);
 check(await evaluate(`document.querySelector('[data-step="4"] input[type="range"]').value`),'1200','Orientation opt-out uses encoded dimensions');
 await evaluate(`[...document.querySelectorAll('label.option-toggle')].find(label=>label.textContent.includes('Corregir fotos giradas')).querySelector('input').click()`);
 await waitFor(`document.querySelector('[data-step="4"] input[type="range"]').value==='800'`);
 await evaluate(`document.querySelector('button.primary-action').click()`);await waitFor(`nativeTest.requests.length===6 && document.body.textContent.includes('1 imagen guardada')`);
 check(await evaluate(`nativeTest.requests[5].resizeWidth`),null,'Original size remains unchanged after correcting camera orientation');
 await evaluate(`const range=document.querySelector('[data-step="4"] input[type="range"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(range,'600');range.dispatchEvent(new Event('input',{bubbles:true}));range.dispatchEvent(new Event('change',{bubbles:true}));`);
 await evaluate(`[...document.querySelectorAll('label.option-toggle')].find(label=>label.textContent.includes('Corregir fotos giradas')).querySelector('input').click()`);
 check(await evaluate(`document.querySelector('[data-step="4"] input[type="range"]').value`),'600','Changing orientation retains an explicit resize choice');
 assert.deepEqual(await evaluate(`nativeTest.errors`),[]);
 assert.deepEqual(findings,[]);
 console.log('Critical regressions verified: EXIF defaults and opt-out, exact resize widths, shared live settings, blocked storage and preference changes during processing.');
} catch(error) { console.log(await evaluate(`({requests:nativeTest.requests.length,sound:nativeTest.soundCount,body:document.body.textContent,errors:nativeTest.errors})`));throw error; } finally { ws.close(); await fetch(`${debug}/json/close/${target.id}`); }
