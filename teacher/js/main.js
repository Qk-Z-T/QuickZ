// teacher/js/main.js
// প্রধান এন্ট্রি পয়েন্ট - Firebase Auth Observer সহ পূর্ণাঙ্গ সংস্করণ (স্প্ল্যাশ ফিক্সসহ)

import { AppState } from './core/state.js';
import { Auth } from './features/auth.js';
import { MathEditor } from './features/math-editor.js';
import { Router } from './router.js';
import { Teacher } from './teacher/teacher-core.js';
import { initRealTimeSync, clearListeners } from './features/realtime-sync.js';
import { autoResizeTextarea, toggleDarkMode, loadMathJax } from './core/utils.js';

// ফিচার মডিউল ইম্পোর্ট (সাইড-ইফেক্টের জন্য - এরা Teacher অবজেক্টে মেথড যোগ করে)
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

// MathHelper ইতিমধ্যে math-editor.js এ গ্লোবালি সেট করা আছে

// গ্লোবাল ভেরিয়েবল ইনিশিয়ালাইজ
window.ExamCache = {};
window.unsubscribes = [];
window.folderStructure = { live: [], mock: [], uncategorized: [] };
window.currentFocusedTextarea = null;
window.questionMode = 'manual';

// ডার্ক মোড ইনিশিয়ালাইজ (থিম সিস্টেম)
if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.classList.add('theme-dark');
    AppState.darkMode = true;
} else {
    document.documentElement.classList.remove('theme-dark');
    AppState.darkMode = false;
}

// ---------- ব্যাক বাটন হ্যান্ডলিং ----------
window.addEventListener('popstate', (event) => {
    Router.handlePopState(event);
});

// ---------- Firebase Auth Observer ----------
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const auth = getAuth();

onAuthStateChanged(auth, async (user) => {
    console.log('🔥 Auth state changed. User:', user ? user.email : 'No user');
    
    // UI এলিমেন্ট রেফারেন্স
    const splash = document.getElementById('splash-screen');
    const layout = document.getElementById('website-layout');
    const authScreen = document.getElementById('auth-screen');
    
    if (user) {
        AppState.user = user;
        try {
            console.log('⏳ Loading teacher profile...');
            await Auth.loadTeacherProfile(user.uid);
            console.log('✅ Profile loaded');
            initRealTimeSync();
            Router.teacher('home');
        } catch (err) {
            console.error('❌ Profile load error:', err);
            Router.teacher('home');
        }
        
        // লগইন অবস্থায় লেআউট দেখান, অথ স্ক্রিন লুকান
        if (authScreen) authScreen.classList.add('hidden');
        if (layout) layout.classList.remove('hidden');
    } else {
        console.log('👤 No user, showing login screen');
        AppState.user = null;
        Router.teacher('login');
        
        // লগইন স্ক্রিন দেখান, লেআউট লুকান
        if (layout) layout.classList.add('hidden');
        if (authScreen) authScreen.classList.remove('hidden');
    }
    
    // স্প্ল্যাশ স্ক্রিন হাইড
    if (splash) {
        splash.classList.add('splash-hidden');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
        console.log('🎬 Splash hidden');
    }
});

// ---------- অফলাইন ম্যানেজার ইনিশিয়ালাইজ ----------
if (TeacherOffline) {
    try {
        TeacherOffline.init();
        Teacher.syncPending = () => TeacherOffline.syncPending();
        console.log('✅ TeacherOffline initialized');
    } catch (e) {
        console.error('❌ Offline init error:', e);
    }
}

// ---------- ব্যাকআপ: ৩ সেকেন্ড পরেও স্প্ল্যাশ হাইড না হলে জোর করে হাইড এবং লগইন স্ক্রিন দেখান ----------
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    const layout = document.getElementById('website-layout');
    const authScreen = document.getElementById('auth-screen');
    
    if (splash && !splash.classList.contains('splash-hidden')) {
        console.warn('⚠️ Fallback: hiding splash after timeout');
        splash.classList.add('splash-hidden');
        setTimeout(() => splash.style.display = 'none', 300);
        
        // যদি এখনো ইউজার নির্ধারিত না হয়, তাহলে লগইন স্ক্রিন দেখিয়ে দিই
        if (!AppState.user) {
            if (layout) layout.classList.add('hidden');
            if (authScreen) authScreen.classList.remove('hidden');
            console.warn('⚠️ Fallback: showing auth screen because user is not logged in');
        } else {
            // ইউজার থাকলেও যদি লেআউট হিডেন থাকে, তবে দেখাই
            if (layout && layout.classList.contains('hidden')) {
                layout.classList.remove('hidden');
            }
            if (authScreen) authScreen.classList.add('hidden');
        }
    }
}, 3000);

// ---------- গ্লোবাল ক্লিক হ্যান্ডলার ----------
document.addEventListener('click', function(e) {
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
