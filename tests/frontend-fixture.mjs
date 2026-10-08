// Shared Tauri IPC simulation for browser interaction tests.
export const tauriFixture = `
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
`;
