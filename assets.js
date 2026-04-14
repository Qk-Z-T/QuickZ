// assets.js
const STATIC_ASSETS = [
  // রুট লেভেল
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/css/style.css',
  '/js/main.js',
  '/js/db.js',
  
  // স্টুডেন্ট পোর্টাল
  '/student/',
  '/student/index.html',
  '/student/css/student.css',
  '/student/js/student.js',
  '/student/js/exam.js',
  
  // টিচার পোর্টাল
  '/teacher/',
  '/teacher/index.html',
  '/teacher/css/teacher.css',
  '/teacher/js/teacher.js',
  '/teacher/js/questions.js',
  
  // কন্ট্রিবিউটর পেজ (যদি থাকে)
  '/contributor/',
  '/contributor/index.html',
  
  // ফন্ট ও লাইব্রেরি (CDN ফাইলগুলোর ফলব্যাক সংস্করণ ক্যাশ করা ভালো)
  'https://cdn.tailwindcss.com/',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap'
];

// PWA তে এটি গ্লোবাল হিসেবে ব্যবহৃত হবে
self.STATIC_ASSETS = STATIC_ASSETS;
