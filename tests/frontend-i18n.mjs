import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
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
const reload=async()=>{const previous=await evaluate('window.i18nDocumentId');await call('Page.reload');await waitFor(`window.i18nDocumentId===${previous+1} && !!document.querySelector('[data-step="6"]')`);};
const screenshot=async name=>{if(!process.env.MINIMG_TEST_SCREENSHOTS)return;const r=await call('Page.captureScreenshot',{format:'png'});writeFileSync(`${process.env.MINIMG_TEST_SCREENSHOTS}/${name}.png`,Buffer.from(r.data,'base64'));};
try {
 await call('Page.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1180,height:850,deviceScaleFactor:1,mobile:false});
 const fixture=tauriFixture.replace(/localStorage.clear\(\);[^\n]+/,`if(!sessionStorage.getItem('i18n-seeded')){localStorage.clear();sessionStorage.setItem('i18n-seeded','yes');}`);
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.i18nDocumentId=(Number(sessionStorage.getItem('i18n-document-id'))||0)+1;sessionStorage.setItem('i18n-document-id',String(window.i18nDocumentId));Object.defineProperty(navigator,'languages',{get:()=>['en-US']});${fixture}`});
 await call('Page.navigate',{url:app});await waitFor(`!!document.querySelector('[data-step="6"]')`);
 assert.equal(await evaluate(`document.documentElement.lang`),'en');
 assert.equal(await evaluate(`document.body.textContent.includes('Lighter images, step by step')`),true);
 await openSettings();assert.equal(await evaluate(`document.querySelector('#application-language').value`),'en');
 await screenshot('settings-en');await closeSettings();
 await evaluate(`nativeTest.dialogs.push(['/test/my-foto.jpg']);[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Drag images or click')).click();`);
 await waitFor(`document.querySelector('[data-step="1"] ul')?.children.length===1`);
 assert.equal(await evaluate(`document.body.textContent.includes('1 image selected')`),true);
 assert.equal(await evaluate(`document.querySelector('[data-step="4"] input[type="range"]').value`),'1000');
 await evaluate(`nativeTest.dialogs.push('/test/output');[...document.querySelectorAll('[data-step="5"] button')].find(b=>b.textContent.includes('Select output folder')).click()`);
 await waitFor(`!!document.querySelector('button.primary-action:not(:disabled)')`);
 await openSettings();await change('es');await closeSettings();
 assert.equal(await evaluate(`document.body.textContent.includes('1 imagen seleccionada')`),true);
 assert.equal(await evaluate(`document.body.textContent.includes('my-foto.jpg')`),true);
 await evaluate(`nativeTest.hold=true;document.querySelector('[data-step="6"] button.primary-action').click()`);
 await waitFor(`typeof nativeTest.resume==='function'`);
 await openSettings();await change('en');await closeSettings();
 assert.equal(await evaluate(`nativeTest.calls.filter(c=>c==='convert_images').length`),1);
 assert.equal(await evaluate(`document.querySelector('[data-step="1"] ul').children.length`),1);
 await evaluate(`nativeTest.resume()`);await waitFor(`document.body.textContent.includes('1 image saved')`);
 await screenshot('results-en');
 // Structured native rejection remains translatable after it has been displayed.
 await evaluate(`window.__TAURI_INTERNALS__.invoke=new Proxy(window.__TAURI_INTERNALS__.invoke,{apply:async(target,receiver,args)=>{if(args[0]==='plugin:opener|reveal_item_in_dir')throw {code:'directory_invalid',params:{}};return Reflect.apply(target,receiver,args);}})`);
 await click('Show files');await waitFor(`document.body.textContent.includes('The folder does not exist or is invalid.')`);
 await openSettings();await change('es');await closeSettings();
 assert.equal(await evaluate(`document.body.textContent.includes('La carpeta no existe o no es válida')`),true);
 await openSettings();await change('en');await closeSettings();
 // Watermark workspace also survives an in-place locale change.
 await click('Watermark');await waitFor(`!!document.querySelector('[data-step="watermark-1"]')`);
 await evaluate(`nativeTest.dialogs.push(['/test/watermark-source.png'])`);await click('Select or drag images');
 await waitFor(`!!document.querySelector('[data-step="watermark-1"] ul')`);
 await evaluate(`nativeTest.dialogs.push('/test/logo.png');document.querySelector('[data-step="watermark-2"] button').click()`);
 await waitFor(`document.querySelector('[data-step="watermark-2"]').dataset.complete==='true'`);
 await evaluate(`nativeTest.dialogs.push('/test/output');document.querySelector('[data-step="watermark-3"] button').click()`);
 await waitFor(`!!document.querySelector('button.primary-action:not(:disabled)')`);
 await openSettings();await change('es');await closeSettings();
 assert.equal(await evaluate(`document.querySelector('[data-step="watermark-1"] ul').children.length`),1);
 assert.equal(await evaluate(`document.body.textContent.includes('logo.png')`),true);
 await click('Aplicar marca de agua');await waitFor(`document.body.textContent.includes('1 imagen guardada')`);
 await openSettings();await change('en');await closeSettings();await waitFor(`document.body.textContent.includes('1 image saved')`);
 await screenshot('watermark-en');
 assert.deepEqual(await evaluate(`nativeTest.errors`),[]);
 // Reload retains English, while migration of an old installation keeps Spanish.
 await reload();
 assert.equal(await evaluate(`document.documentElement.lang`),'en');
 await evaluate(`localStorage.removeItem('minimg-language-v1');localStorage.setItem('image-compressor-settings-v1',JSON.stringify({theme:'dark',username:'Ana',soundOnFinish:false}));`);
 await reload();
 assert.equal(await evaluate(`document.documentElement.lang`),'es');
 assert.equal(await evaluate(`document.documentElement.dataset.theme`),'dark');
 assert.equal(await evaluate(`document.body.textContent.includes('Hola, Ana')`),true);
 await openSettings();await click('Restaurar');await waitFor(`document.documentElement.lang==='en'`);
 // Check both languages and themes at the minimum supported window width.
 await call('Emulation.setDeviceMetricsOverride',{width:760,height:620,deviceScaleFactor:1,mobile:false});
 for(const language of ['es','en']) {
   await change(language);
   assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`),true);
   assert.equal(await evaluate(`document.querySelector('[role="dialog"]').scrollWidth<=document.querySelector('[role="dialog"]').clientWidth`),true);
   await screenshot(`settings-${language}-760`);
 }
 assert.deepEqual(await evaluate(`nativeTest.errors`),[]);
 console.log('Bilingual React verified: fresh detection, migration, persistence, reset, locale changes during processing, native errors, watermark state and minimum-width layout.');
} finally { ws.close(); await fetch(`${debug}/json/close/${target.id}`); }
