// assets.js ফাইলটিকে ইম্পোর্ট করা হচ্ছে
importScripts('assets.js');

const CACHE_NAME = 'quickz-auth-aware-v1';

// ইনস্টল ইভেন্ট: assets.js থেকে পাওয়া সব ফাইল ডাউনলোড করে নেবে
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('📥 Caching all required app assets...');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// একটিভ ইভেন্ট: পুরনো ক্যাশ ডিলিট করবে
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cache => {
                if (cache !== CACHE_NAME) {
                    console.log('🧹 Clearing old cache:', cache);
                    return caches.delete(cache);
                }
            })
        ))
    );
    return self.clients.claim();
});

// Fetch ইভেন্ট: আগের মতোই "Network First" থাকবে
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // ইন্টারনেট থেকে পেলে, ক্যাশে সেভ করে রাখবে
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            })
            .catch(() => {
                // ইন্টারনেট না পেলে, ক্যাশ থেকে দেখাবে
                console.log('🔌 Serving from cache (offline):', event.request.url);
                return caches.match(event.request);
            })
    );
});
