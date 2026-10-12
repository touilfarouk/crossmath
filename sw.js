/* Math Crossword — service worker.
 * Cache-first offline support. Bump VERSION whenever the app shell changes
 * so installed clients fetch the new files on their next visit.
 */
const VERSION = "math-crossword-v1";

const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./generator.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin GETs; let every other request go to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // App navigation: serve the cached shell (offline still works).
  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match(request)
        .then((hit) => hit || caches.match("./index.html"))
        .then((hit) => {
          if (hit) return hit;
          return fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put("./index.html", copy));
            return response;
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          // Cache successful same-origin responses for next time.
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});