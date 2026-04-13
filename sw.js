// ১. নতুন ক্যাশ ভার্সন। কোড আপডেট করলে এই নাম পরিবর্তন করা ভালো।
const CACHE_NAME = 'quickz-network-first-v1';

// ২. অ্যাপের কোর ফাইল, যা ইনস্টল হওয়ার সময় একবার ডাউনলোড হবে।
const CORE_FILES_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './tamim.png',
    './icon-192.png',
    './icon-512.png',
    './student/',
    './student/index.html',
    './teacher/',
    './teacher/index.html',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ৩. ইনস্টল ইভেন্ট: কোর ফাইলগুলো ডাউনলোড করে ক্যাশে সেভ করে।
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('📥 Service Worker installing and caching core files...');
            return cache.addAll(CORE_FILES_TO_CACHE);
        })
    );
});

// ৪. একটিভ ইভেন্ট: পুরোনো ভার্সনের ক্যাশ ডিলিট করে দেয়।
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

// ৫. Fetch ইভেন্ট: এটিই মূল ম্যাজিক (Network First Strategy)
self.addEventListener('fetch', event => {
    // শুধু GET রিকোয়েস্ট হ্যান্ডেল করবে
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        // প্রথমে ইন্টারনেট থেকে আনার চেষ্টা করবে
        fetch(event.request)
            .then(networkResponse => {
                // ইন্টারনেট থেকে সফলভাবে পেলে...
                console.log('🌐 Serving from network:', event.request.url);

                // একটি কপি ক্যাশে সেভ করে রাখবে ভবিষ্যতের জন্য
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                // আসল রেসপন্সটি ব্রাউজারকে পাঠিয়ে দেবে
                return networkResponse;
            })
            .catch(() => {
                // যদি ইন্টারনেট থেকে আনতে ফেইল করে (অর্থাৎ অফলাইন)...
                console.log('🔌 Serving from cache (offline):', event.request.url);
                
                // তখন ক্যাশ থেকে খুঁজে দেখাবে
                return caches.match(event.request);
            })
    );
});
