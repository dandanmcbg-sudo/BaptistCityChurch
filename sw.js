const CACHE="bcc-attendance-lease-fix-2026-11-03-1914-v1";
const CORE=["./","./index.html","./admin.html","./firebase-config.js","./firebase-data.js","./assets/bcc-logo.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil((async()=>{for(const k of await caches.keys()){if(k!==CACHE&&k.startsWith("bcc-attendance-"))await caches.delete(k);}await self.clients.claim();})()));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(
    fetch(e.request).then(r=>{
      if(e.request.url.startsWith(self.location.origin) && !e.request.url.includes("admin.html")) { const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{}); }
      return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))
  );
});