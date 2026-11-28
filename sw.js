const VERSION='4.0';
const CACHE='dream-stories-v40';
const ROOT=self.registration.scope;
const INDEX=new URL('index.html',ROOT).href;
const MANIFEST=new URL('offline-manifest.json',ROOT).href;
const safeURL=path=>new URL(path,ROOT).href;
async function digest(response){const bytes=await response.clone().arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')}
async function prepare(){
 const res=await fetch(MANIFEST,{cache:'no-store'});if(!res.ok)throw Error('manifest unavailable');const manifest=await res.clone().json();
 if(manifest.version!==VERSION||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('manifest version');
 const cache=await caches.open(CACHE);const oldKeys=(await caches.keys()).filter(k=>k.startsWith('dream-stories-')&&k!==CACHE);
 const previous=[];for(const key of oldKeys){const c=await caches.open(key);try{const m=await c.match(MANIFEST);if(m){const j=await m.json();previous.push({c,hashes:new Map(j.files.map(f=>[f.path,f.sha256]))})}}catch(e){}}
 for(const file of manifest.files){const url=safeURL(file.path);if(!url.startsWith(ROOT))throw Error('invalid path');let item=await cache.match(url);if(!item||await digest(item)!==file.sha256){item=null;for(const prev of previous){if(prev.hashes.get(file.path)===file.sha256){const candidate=await prev.c.match(url);if(candidate&&await digest(candidate)===file.sha256){item=candidate;break}}}if(!item){item=await fetch(url,{cache:'no-store'});if(!item.ok||await digest(item)!==file.sha256)throw Error('invalid file '+file.path)}await cache.put(url,item)}}
 await cache.put(MANIFEST,res);await self.skipWaiting();
}
self.addEventListener('install',event=>event.waitUntil(prepare().catch(async error=>{await caches.delete(CACHE);throw error})));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();const keys=(await caches.keys()).filter(k=>k.startsWith('dream-stories-')&&k!==CACHE);for(const key of keys.slice(0,Math.max(0,keys.length-1)))await caches.delete(key)})()));
self.addEventListener('message',event=>{if(event.data?.type!=='LIBRARY_STATUS'||!event.ports[0])return;event.waitUntil((async()=>{let complete=false,count=0,total=0;try{const c=await caches.open(CACHE);const m=await c.match(MANIFEST);if(m){const j=await m.json();total=j.files.length;const checks=await Promise.all(j.files.map(f=>c.match(safeURL(f.path))));count=checks.filter(Boolean).length;complete=j.version===VERSION&&count===total&&total>0}}catch(e){}event.ports[0].postMessage({version:VERSION,complete,count,total})})())});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET'||!req.url.startsWith(ROOT))return;const url=new URL(req.url);if(url.pathname===new URL('version.json',ROOT).pathname){event.respondWith(fetch(req,{cache:'no-store'}));return}event.respondWith((async()=>{const c=await caches.open(CACHE);if(req.mode==='navigate'&&(url.pathname===new URL(ROOT).pathname||url.pathname===new URL(INDEX).pathname)){const shell=await c.match(INDEX);if(shell)return shell}const hit=await c.match(req,{ignoreSearch:true});if(hit)return hit;try{return await fetch(req)}catch(e){const keys=(await caches.keys()).filter(k=>k.startsWith('dream-stories-')&&k!==CACHE);for(const key of keys){const old=await (await caches.open(key)).match(req,{ignoreSearch:true});if(old)return old}return new Response('Offline resource unavailable',{status:503})}})())});
