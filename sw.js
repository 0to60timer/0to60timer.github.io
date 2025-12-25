// Service Worker for 0to60 Timer Website
// Version 1.0 - Basic caching for performance optimization

const CACHE_NAME = '0to60-timer-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/features.html',
  '/how-it-works.html',
  '/accuracy.html',
  '/faq.html',
  '/privacy.html',
  '/terms.html',
  '/access.html',
  '/tracker.html',
  'img/tracker-images/homescreen-tracker-image.jpeg',
  'img/stock-images/cityline.avif',
  'img/stock-images/cityline.webp',
  'img/stock-images/park-new-york-city-nyc-manhattan-162024.jpeg'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});