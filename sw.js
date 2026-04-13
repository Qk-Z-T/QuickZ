const CACHE_NAME = 'quickz-modular-v1'; // ক্যাশ ভার্সন পরিবর্তন করা হয়েছে

const APP_FILES = [
    // Core files
    './',
    './index.html',
    './manifest.json',
    './tamim.png',
    './icon-192.png',
    './icon-512.png',

    // Student Portal files
    './student/',
    './student/index.html',

    // Teacher Portal files
    './teacher/',
    './teacher/index.html',

    // External assets
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('📥 Caching modular app structure...');
            return Promise.allSettled(APP_FILES.map(url => cache.add(url).catch(err => console.warn(`Cache add failed for: ${url}`, err))));
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('🧹 Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If navigation fails, and it's a page, try to serve the main index.
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });

            return cachedResponse || fetchPromise;
        })
    );
});
