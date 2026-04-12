const CACHE_NAME = 'quickz-v5'; // ভার্সন আপডেট করা হয়েছে
const urlsToCache = [
    './',
    './index.html',
    './student.html',     // নতুন যুক্ত করা হলো
    './teacher.html',     // নতুন যুক্ত করা হলো
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// অফলাইনেও কাজ করার জন্য Fetch Strategy
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request, { ignoreSearch: true }).then(response => {
                if (response) return response;
                return new Response('You are offline and the page is not cached.', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            });
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});
