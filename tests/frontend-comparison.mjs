import { tauriFixture } from "./frontend-fixture.mjs";
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
 await call('Network.setCacheDisabled',{cacheDisabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:1180,height:850,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:tauriFixture+`
 window.__TAURI_INTERNALS__.invoke=new Proxy(window.__TAURI_INTERNALS__.invoke,{apply:(target,receiver,args)=>Reflect.apply(target,receiver,args[0]==='read_file_bytes'?['get_thumbnail',args[1]]:args)});
 `});
 await call('Page.navigate',{url:app});await waitFor(`!!document.querySelector('[data-step="6"]')`);
 await evaluate(`nativeTest.dialogs.push(['/test/photo.jpg']);[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Arrastra imágenes')).click()`);
 await waitFor(`!!document.querySelector('[data-step="1"] ul')`);
 await evaluate(`nativeTest.dialogs.push('/test/output');[...document.querySelectorAll('[data-step="5"] button')].find(b=>b.textContent.includes('Seleccionar carpeta')).click()`);
 await waitFor(`!!document.querySelector('button.primary-action:not(:disabled)')`);
 await evaluate(`document.querySelector('button.primary-action').click()`);await waitFor(`document.body.textContent.includes('1 imagen guardada')`);
 await click('Comparar');await waitFor(`!!document.querySelector('[role="slider"]')`);
 await new Promise(resolve=>setTimeout(resolve,300));
 const rect=await evaluate(`const rect=document.querySelector('[role="slider"]').parentElement.getBoundingClientRect();({left:rect.left,right:rect.right,width:rect.width,y:rect.top+rect.height/2})`);

 const move=x=>call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:rect.y,button:'left',buttons:1});
 const position=()=>evaluate(`Number(document.querySelector('[role="slider"]').getAttribute('aria-valuenow'))`);
 await move(rect.left+rect.width/2);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.left+rect.width/2,y:rect.y,button:'left',buttons:1,clickCount:1});
 await move(rect.left-30);assert.equal(await position(),0);
 await move(rect.left+rect.width*0.25);assert.equal(await position(),25,'Dragging must resume from the left edge without pressing again');
 await move(rect.right+30);assert.equal(await position(),100);
 await move(rect.left+rect.width*0.75);assert.equal(await position(),75,'Dragging must resume from the right edge without pressing again');
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.left+rect.width*0.75,y:rect.y,button:'left',buttons:0,clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.left+rect.width/2,y:rect.y,buttons:0});
 assert.equal(await position(),75,'Releasing the pointer must stop dragging');
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.left+rect.width*0.75,y:rect.y,button:'left',buttons:1,clickCount:1});
 await move(rect.left+rect.width/2);assert.equal(await position(),50,'A new drag works after release');
 await evaluate(`const container=document.querySelector('[role="slider"]').parentElement;container.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}));`);
 await move(rect.left+rect.width*0.25);assert.equal(await position(),50,'Pointer cancellation must stop dragging');
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.left+rect.width*0.25,y:rect.y,button:'left',buttons:0,clickCount:1});
 assert.deepEqual(await evaluate(`nativeTest.errors`),[]);
 console.log('Comparison verified: drag beyond both edges and back without releasing, release, subsequent drag and cancellation.');
} finally { ws.close(); await fetch(`${debug}/json/close/${target.id}`); }
