// teacher/js/main.js
// প্রধান এন্ট্রি পয়েন্ট — FIXED for Offline and Splash Screen Issues

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

// ✅ offline.js — await ছাড়া non-blocking import
import('./offline.js').then(m => {
    const TeacherOffline = m?.TeacherOffline;
    if (TeacherOffline) {
        try {
            TeacherOffline.init();
            Teacher.syncPending = () => TeacherOffline.syncPending();
            window.TeacherOffline = TeacherOffline;
            console.log('✅ TeacherOffline initialized');
        } catch (e) {
            console.error('❌ Offline init error:', e);
        }
    }
}).catch(e => {
    console.warn('⚠️ TeacherOffline not loaded:', e.message);
});

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

// ✅ নিরাপদ গ্লোবাল ভেরিয়েবল ইনিশিয়ালাইজ (যাতে অন্য ফাইলে ক্র্যাশ না করে)
if (!window.ExamCache) window.ExamCache = {};
if (!window.unsubscribes) window.unsubscribes = [];
if (!window.folderStructure) window.folderStructure = { live: [], mock: [], uncategorized: [] };

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

// splash hide utility
function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('splash-hidden')) {
        splash.classList.add('splash-hidden');
        setTimeout(() => { splash.style.display = 'none'; }, 500);
    }
}

// Firebase Auth Observer
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const auth = getAuth();

// ✅ FIX: ৫ সেকেন্ডের মধ্যে Firebase সাড়া না দিলে ক্যাশ চেক করে অফলাইন মোডে ড্যাশবোর্ড দেখাবে
const authTimeout = setTimeout(() => {
    console.warn('⚠️ Firebase auth timeout — checking offline cache');
    hideSplash();
    
    const cachedData = localStorage.getItem('teacher_data');
    if (cachedData && !navigator.onLine) {
        // অফলাইন থাকলে এবং ক্যাশ থাকলে সরাসরি লগিন
        AppState.currentUser = JSON.parse(cachedData);
        AppState.user = { uid: AppState.currentUser.id }; 
        console.log('✅ Logged in via Offline Cache');
        Router.initTeacher();
    } else {
        Router.showLogin();
    }
}, 5000);

onAuthStateChanged(auth, async (user) => {
    clearTimeout(authTimeout);

    if (user) {
        AppState.user = user;
        try {
            // অনলাইনে থাকলে ফায়ারবেস থেকে প্রোফাইল আনবে, না থাকলে ক্যাশ থেকে
            if (navigator.onLine) {
                await Auth.loadTeacherProfile(user.uid);
            } else {
                const cachedData = localStorage.getItem('teacher_data');
                if (cachedData) AppState.currentUser = JSON.parse(cachedData);
            }
            initRealTimeSync();
            Router.initTeacher();
        } catch (err) {
            console.error('Profile load error:', err);
            // এরর হলেও ক্যাশ থেকে ডাটা নিয়ে চালিয়ে নেওয়ার চেষ্টা
            const cachedData = localStorage.getItem('teacher_data');
            if (cachedData) AppState.currentUser = JSON.parse(cachedData);
            Router.initTeacher();
        }
    } else {
        AppState.user = null;
        Router.showLogin();
    }

    hideSplash();
});

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
