// teacher/js/main.js
// প্রধান এন্ট্রি পয়েন্ট — FIXED (splash screen + login route)

import { AppState } from './core/state.js';
import { Auth } from './features/auth.js';
import { MathEditor } from './features/math-editor.js';
import { Router } from './router.js';
import { Teacher } from './teacher/teacher-core.js';
import { initRealTimeSync, clearListeners } from './features/realtime-sync.js';
import { autoResizeTextarea, toggleDarkMode, loadMathJax } from './core/utils.js';

// ফিচার মডিউল ইম্পোর্ট
import './teacher/dashboard.js';
import './teacher/exam-create.js';
import './teacher/library.js';
import './teacher/rankings.js';
import './teacher/management.js';
import './teacher/notice-poll.js';
import './teacher/groups.js';
import './teacher/profile.js';

// অফলাইন ম্যানেজার ইম্পোর্ট (নিরাপদে)
let TeacherOffline = null;
try {
    const offlineModule = await import('./offline.js');
    TeacherOffline = offlineModule.TeacherOffline;
} catch (e) {
    console.warn('⚠️ TeacherOffline module not loaded, offline features disabled.');
}

// গ্লোবাল এক্সপোজ
window.AppState = AppState;
window.MathEditor = MathEditor;
window.Router = Router;
window.Teacher = Teacher;
window.autoResizeTextarea = autoResizeTextarea;
window.toggleDarkMode = toggleDarkMode;
window.loadMathJax = loadMathJax;
window.clearListeners = clearListeners;
window.initRealTimeSync = initRealTimeSync;

// গ্লোবাল ভেরিয়েবল ইনিশিয়ালাইজ
window.ExamCache = {};
window.unsubscribes = [];
window.folderStructure = { live: [], mock: [], uncategorized: [] };
window.currentFocusedTextarea = null;
window.questionMode = 'manual';

// ডার্ক মোড ইনিশিয়ালাইজ
if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.classList.add('theme-dark');
    AppState.darkMode = true;
} else {
    document.documentElement.classList.remove('theme-dark');
    AppState.darkMode = false;
}

// ব্যাক বাটন হ্যান্ডলিং
window.addEventListener('popstate', (event) => {
    Router.handlePopState(event);
});

// ✅ FIX: splash screen হাইড করার utility function
function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('splash-hidden')) {
        splash.classList.add('splash-hidden');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
}

// Firebase Auth Observer
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const auth = getAuth();

// ✅ FIX: auth observer timeout — Firebase কখনো callback না দিলেও splash সরে যাবে
const authTimeout = setTimeout(() => {
    console.warn('⚠️ Firebase auth observer timed out — forcing splash hide & login screen');
    hideSplash();
    Router.showLogin();
}, 5000); // 5 সেকেন্ড

onAuthStateChanged(auth, async (user) => {
    clearTimeout(authTimeout); // auth response পেলে timeout বাতিল

    if (user) {
        AppState.user = user;
        try {
            await Auth.loadTeacherProfile(user.uid);
            initRealTimeSync();
            Router.initTeacher(); // ✅ সরাসরি initTeacher কল
        } catch (err) {
            console.error('Profile load error:', err);
            Router.initTeacher(); // error হলেও home-এ নিয়ে যাও
        }
    } else {
        AppState.user = null;
        Router.showLogin(); // ✅ সরাসরি showLogin কল
    }

    hideSplash(); // auth resolve হলে splash সরাও
});

// অফলাইন ম্যানেজার ইনিশিয়ালাইজ
if (TeacherOffline) {
    try {
        TeacherOffline.init();
        Teacher.syncPending = () => TeacherOffline.syncPending();
        console.log('✅ TeacherOffline initialized');
    } catch (e) {
        console.error('❌ Offline init error:', e);
    }
}

// গ্লোবাল ক্লিক হ্যান্ডলার
document.addEventListener('click', function (e) {
    if (!e.target.closest('.three-dot-menu') && !e.target.closest('.dot-menu-dropdown')) {
        document.querySelectorAll('.dot-menu-dropdown').forEach(d => d.classList.remove('show'));
    }
    if (!e.target.closest('#math-symbols-panel') && !e.target.closest('#floating-math-btn')) {
        const panel = document.getElementById('math-symbols-panel');
        if (panel) panel.classList.remove('show');
    }
    if (!e.target.closest('.hamburger-menu')) {
        const hm = document.getElementById('hamburger-menu');
        if (hm) hm.classList.remove('show');
    }
    if (!e.target.closest('.group-switcher')) {
        const dropdown = document.getElementById('group-switcher-dropdown');
        if (dropdown) dropdown.classList.remove('show');
    }
    if (!e.target.closest('.student-three-dot-menu')) {
        document.querySelectorAll('.student-dot-menu-dropdown').forEach(d => d.classList.remove('show'));
    }
});
