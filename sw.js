// تشكيل مو — Service Worker
// بيخزّن كل ملفات الأداة (النموذج + القاموس + محرك التشغيل) مرة واحدة،
// وبعدها الأداة تشتغل حتى من غير إنترنت خالص (وضع الطيران).

const CACHE_NAME = "tashkeel-mo-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./ort.wasm.min.js",
  "./ort-wasm-simd-threaded.wasm",
  "./ort-wasm-simd-threaded.mjs",
  "./nspell.bundle.js",
  "./model.onnx",
  "./input_id_map.json",
  "./target_id_map.json",
  "./hint_id_map.json",
  "./ar.aff",
  "./ar.dic",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // نتجاهل طلبات الخطوط الخارجية (Google Fonts) ونسيبها تروح للشبكة عادي؛
  // أي حاجة تانية بنجرب الكاش الأول وبعدين الشبكة كخطة بديلة
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
      );
    })
  );
});
