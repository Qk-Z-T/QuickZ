const CACHE_NAME = 'quickz-offline-v1';

// এই ফাইলগুলো অ্যাপ ইনস্টল হওয়ার সাথে সাথেই সেভ হয়ে যাবে
const PRE_CACHE_URLS = [
    './',
    './index.html',
    './student.html',
    './teacher.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRE_CACHE_URLS);
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache); // পুরোনো ক্যাশ ডিলিট করে নতুনটা রাখবে
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// স্মার্ট অফলাইন সিস্টেম (Dynamic Caching)
self.addEventListener('fetch', event => {
    // যদি ব্রাউজার কোনো পেজ (HTML) খুঁজতে যায়
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // ইন্টারনেট না থাকলে সরাসরি index.html (হোমপেজ) ওপেন করে দেবে
                return caches.match('./index.html');
            })
        );
        return;
    }

    // অন্যান্য ফাইল (CSS, JS, Images, Icons) এর জন্য
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            // যদি আগে থেকে সেভ করা থাকে, তবে অফলাইন থেকে দেবে
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // আর যদি সেভ করা না থাকে, তবে ইন্টারনেট থেকে আনবে এবং ভবিষ্যতে অফলাইনের জন্য সেভ করে রাখবে
            return fetch(event.request).then(networkResponse => {
                // শুধুমাত্র ভ্যালিড রেসপন্স ক্যাশ করবে
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    return networkResponse;
                }
                
                // ডাইনামিক ক্যাশিং (যেমন: FontAwesome এর ভেতরের ফন্ট ফাইলগুলো)
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    if(event.request.url.startsWith('http')) {
                        cache.put(event.request, responseToCache);
                    }
                });
                return networkResponse;
            }).catch(() => {
                // ইন্টারনেট না থাকলে এবং ক্যাশে না থাকলে কিছুই করবে না
                return new Response('You are offline.', { status: 503 });
            });
        })
    );
});
