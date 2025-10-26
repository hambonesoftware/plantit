const STATIC_CACHE = "plantit-static-v1";
const DATA_CACHE = "plantit-data-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles/base.css",
  "/js/main.js",
  "/js/router.js",
  "/js/state.js",
  "/js/ui/toast.js",
  "/js/ui/tabs.js",
  "/js/views/_shell.js",
  "/js/views/home-view.js",
  "/js/views/village-view.js",
  "/js/views/plant-view.js",
  "/js/views/tasks-view.js",
  "/js/views/today-panel.js",
  "/js/viewmodels/HomeVM.js",
  "/js/viewmodels/VillageVM.js",
  "/js/viewmodels/PlantVM.js",
  "/js/viewmodels/TasksVM.js",
  "/js/services/apiClient.js",
  "/js/services/requestQueue.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((error) => console.error("Failed to pre-cache", error))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(cacheFirst(new Request("/index.html", { cache: "reload" })));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cached ?? Response.error();
  }
}

async function networkFirst(request, cacheName = DATA_CACHE) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
