const STATIC_CACHE = "plantit-static-v1";
const VM_CACHE = "plantit-vm-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles/tokens.css",
  "/styles/base.css",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/js/router.js",
  "/js/services/apiClient.js",
  "/js/services/offlineQueue.js",
  "/js/thinvms/HomeThinVM.js",
  "/js/thinvms/VillagesThinVM.js",
  "/js/thinvms/VillageDetailThinVM.js",
  "/js/thinvms/PlantDetailThinVM.js",
  "/js/views/home-view.js",
  "/js/views/villages-view.js",
  "/js/views/village-detail-view.js",
  "/js/views/plant-detail-view.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== VM_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function networkFirst(event, cacheName) {
  const { request } = event;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(cacheName).then((cache) => cache.put(request, clone));
          return response;
        }
        if (response.status === 304) {
          return caches
            .open(cacheName)
            .then((cache) => cache.match(request))
            .then((match) => match || response);
        }
        return response;
      })
      .catch(() =>
        caches
          .open(cacheName)
          .then((cache) => cache.match(request))
          .then(
            (match) =>
              match ||
              new Response(
                JSON.stringify({
                  error: {
                    code: "OFFLINE",
                    message: "Offline cache miss.",
                    field: null,
                  },
                }),
                {
                  status: 503,
                  headers: { "Content-Type": "application/json" },
                },
              ),
          ),
      ),
  );
}

function cacheFirst(event, cacheName) {
  const { request } = event;
  event.respondWith(
    caches
      .open(cacheName)
      .then((cache) => cache.match(request))
      .then((match) => {
        if (match) {
          return match;
        }
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(cacheName).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (STATIC_ASSETS.includes(url.pathname) || url.pathname === "/") {
      cacheFirst(event, STATIC_CACHE);
      return;
    }
  }
  if (url.pathname.startsWith("/api/v1/vm/")) {
    networkFirst(event, VM_CACHE);
    return;
  }
});
