// sw.js
importScripts('assets.js');

const CACHE_STATIC = 'quickz-static-v3';
const CACHE_DYNAMIC = 'quickz-dynamic-v3';
const CACHE_API = 'quickz-api-v1';
const OFFLINE_PAGE = '/offline.html';

// ইনস্টল: সব স্ট্যাটিক ফাইল প্রি-ক্যাশ
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('📦 Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.warn('Pre-cache failed:', err))
  );
});

// এক্টিভেট: পুরনো ক্যাশ মুছে ফেলা
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_STATIC && key !== CACHE_DYNAMIC && key !== CACHE_API)
          .map(key => caches.delete(key))
    ))
  );
  return self.clients.claim();
});

// ফেচ ইভেন্ট
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API কল (firestore, realtime db, নিজস্ব API) - নেটওয়ার্ক ফার্স্ট + ক্যাশ ফলব্যাক
  if (url.pathname.includes('/api/') || url.hostname.includes('firebaseio') || url.hostname.includes('firestore')) {
    event.respondWith(networkFirstWithCache(event.request, CACHE_API));
    return;
  }

  // নেভিগেশন রিকোয়েস্ট (HTML পেজ)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // ক্যাশে এই রেসপন্স সংরক্ষণ (ডায়নামিক ক্যাশ)
          const cloned = response.clone();
          caches.open(CACHE_DYNAMIC).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          // নেটওয়ার্ক নেই -> প্রথমে ডায়নামিক ক্যাশ, তারপর স্ট্যাটিক ক্যাশ, শেষে offline.html
          return caches.match(event.request)
            .then(cached => cached || caches.match(OFFLINE_PAGE));
        })
    );
    return;
  }

  // স্ট্যাটিক অ্যাসেট (JS, CSS, images) - ক্যাশ ফার্স্ট, পরে নেটওয়ার্ক থেকে আপডেট
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const cloned = networkResponse.clone();
              caches.open(CACHE_STATIC).then(cache => cache.put(event.request, cloned));
            }
            return networkResponse;
          })
          .catch(err => console.warn('Network fetch failed for', url.pathname, err));
        return cached || fetchPromise;
      })
  );
});

// হেল্পার: নেটওয়ার্ক ফার্স্ট, তারপর ক্যাশ
function networkFirstWithCache(request, cacheName) {
  return fetch(request)
    .then(response => {
      if (!response || response.status !== 200) return response;
      const cloned = response.clone();
      caches.open(cacheName).then(cache => cache.put(request, cloned));
      return response;
    })
    .catch(() => caches.match(request));
}
