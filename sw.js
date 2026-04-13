const CACHE_NAME = 'quickz-pro-v1'; // ভার্সন নাম পরিবর্তন করা হলো

// কোর ফাইলগুলো যা ইনস্টল হওয়ার সাথে সাথে ডাউনলোড হয়ে যাবে
const APP_FILES = [
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

// ইনস্টল ইভেন্ট: ফাইলগুলো ব্যাকগ্রাউন্ডে ডাউনলোড করে স্টোরেজে সেভ করবে
self.addEventListener('install', event => {
    self.skipWaiting(); // নতুন আপডেট আসলে সাথে সাথে একটিভ হবে
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('📥 Downloading core files for offline use...');
            // Promise.allSettled ব্যবহার করা হলো যাতে কোনো বাইরের লিংক ফেইল করলেও বাকিগুলো সেভ হয়
            return Promise.allSettled(APP_FILES.map(url => cache.add(url).catch(err => console.warn('Cache add failed for:', url))));
        })
    );
});

// একটিভ ইভেন্ট: পুরনো ক্যাশ ক্লিয়ার করে নতুনটা জায়গা নেবে
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
    self.clients.claim(); // পেজ রিলোড ছাড়াই কন্ট্রোল নিয়ে নেবে
});

// স্মার্ট ফেচিং (Stale-While-Revalidate) - আল্টিমেট অফলাইন এক্সপেরিয়েন্স
self.addEventListener('fetch', event => {
    // শুধুমাত্র GET রিকোয়েস্টগুলো ক্যাশ করবে
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            
            // ব্যাকগ্রাউন্ডে ইন্টারনেটের মাধ্যমে ফাইল আপডেট করার কাজ
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // ইন্টারনেট না থাকলে এবং ফাইল ক্যাশে না থাকলে হোমপেজে রিডাইরেক্ট করবে
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });

            // ম্যাজিক এখানে: যদি ক্যাশে (স্টোরেজে) ফাইল থাকে, তবে ইন্টারনেট চেক না করেই সাথে সাথে দিয়ে দাও!
            // আর ক্যাশে না থাকলে ইন্টারনেট থেকে আনো।
            return cachedResponse || fetchPromise;
        })
    );
});
