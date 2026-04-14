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
  '/student/css/styles.css',
  '/student/js/config.js',
  '/student/js/state.js',
  '/student/js/auth.js',
  '/student/js/ui.js',
  '/student/js/student.js',
  '/student/js/exam.js',
  '/student/js/offline.js',
  '/student/js/router.js',
  '/student/js/app.js',

  // টিচার পোর্টাল
  '/teacher/',
  '/teacher/index.html',
  '/teacher/css/teacher.css',
  '/teacher/js/config/firebase.js',
  '/teacher/js/core/state.js',
  '/teacher/js/core/utils.js',
  '/teacher/js/features/math-editor.js',
  '/teacher/js/features/auth.js',
  '/teacher/js/features/realtime-sync.js',
  '/teacher/js/router.js',
  '/teacher/js/teacher/teacher-core.js',
  '/teacher/js/teacher/dashboard.js',
  '/teacher/js/teacher/exam-create.js',
  '/teacher/js/teacher/library.js',
  '/teacher/js/teacher/rankings.js',
  '/teacher/js/teacher/management.js',
  '/teacher/js/teacher/notice-poll.js',
  '/teacher/js/teacher/groups.js',
  '/teacher/js/teacher/profile.js',
  '/teacher/js/main.js',

  // CDN (ফলব্যাক ক্যাশিং)
  'https://cdn.tailwindcss.com/',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap'
];

self.STATIC_ASSETS = STATIC_ASSETS;
