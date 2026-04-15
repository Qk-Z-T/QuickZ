// teacher/js/main.js
// ⚡ SUPER FAST BOOT & ANTI-AUTO-LOGOUT SYSTEM ⚡

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

// ✅ offline.js — await ছাড়া non-blocking import (যাতে স্প্ল্যাশ স্ক্রিন না আটকায়)
import('./offline.js').then(m => {
    if (m?.TeacherOffline) {
        m.TeacherOffline.init();
        Teacher.syncPending = () => m.TeacherOffline.syncPending();
        window.TeacherOffline = m.TeacherOffline;
        console.log('✅ TeacherOffline initialized');
    }
}).catch(e => console.warn('⚠️ TeacherOffline not loaded:', e.message));

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

// ✅ নিরাপদ গ্লোবাল ভেরিয়েবল ইনিশিয়ালাইজ
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
        setTimeout(() => { splash.style.display = 'none'; }, 300);
    }
}

// =========================================================================
// 🚀 FAST BOOT SYSTEM: ফায়ারবেসের জন্য অপেক্ষা না করে সাথে সাথে ড্যাশবোর্ড আনুন
// =========================================================================
const cachedTeacherData = localStorage.getItem('teacher_data');
const isExplicitLogout = localStorage.getItem('explicit_logout') === 'true';

if (cachedTeacherData && !isExplicitLogout) {
    console.log('⚡ Fast Booting from Local Storage...');
    AppState.currentUser = JSON.parse(cachedTeacherData);
    AppState.user = { uid: AppState.currentUser.id };
    
    // সাথে সাথে UI লোড করে দাও
    hideSplash();
    initRealTimeSync();
    Router.initTeacher();
}

// =========================================================================
// 🔒 FIREBASE BACKGROUND SYNC & ANTI-LOGOUT LOGIC
// =========================================================================
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
const auth = getAuth();

// ফায়ারবেস যদি কোনো কারণে আটকে যায়, ৩ সেকেন্ড পর স্প্ল্যাশ সরিয়ে দিবে
const fallbackTimer = setTimeout(() => {
    hideSplash();
    if (!AppState.currentUser) Router.showLogin();
}, 3000);

onAuthStateChanged(auth, async (user) => {
    clearTimeout(fallbackTimer);

    if (user) {
        // ইউজার লিগ্যাল ভাবে লগিন করেছে, তাই লগ-আউট ফ্ল্যাগ মুছে দাও
        localStorage.setItem('explicit_logout', 'false'); 
        AppState.user = user;
        
        if (!AppState.currentUser) {
            // যদি Fast Boot না হয়ে থাকে (যেমন প্রথমবার লগিন)
            try {
                if (navigator.onLine) {
                    await Auth.loadTeacherProfile(user.uid);
                }
                initRealTimeSync();
                Router.initTeacher();
            } catch (e) {
                console.error('Profile load error:', e);
                Router.initTeacher();
            }
            hideSplash();
        } else {
            // Fast Boot হয়ে গেছে, ব্যাকগ্রাউন্ডে শুধু প্রোফাইল আপডেট করে নাও
            if (navigator.onLine) {
                Auth.loadTeacherProfile(user.uid).catch(e => console.warn(e));
            }
        }
    } else {
        // ফায়ারবেস বলছে ইউজার লগ-আউট
        const explicit = localStorage.getItem('explicit_logout') === 'true';
        
        if (explicit) {
            // ইউজার নিজে বাটনে ক্লিক করে লগ-আউট করেছে, তাই বের করে দাও
            AppState.user = null;
            AppState.currentUser = null;
            Router.showLogin();
            hideSplash();
        } else {
            // 🛑 ফায়ারবেস অটোমেটিক লগ-আউট করতে চাইছে (অফলাইন বা ক্যাশ ইশুর কারণে)
            // আমরা ফায়ারবেসকে ব্লক করবো এবং মেমোরির ডেটা ধরে রাখবো।
            console.warn('🛡️ Blocked Firebase Auto-Logout. Keeping session active.');
            
            if (!AppState.currentUser) {
                // যদি মেমোরিতেও কিছু না থাকে (সত্যিই লগআউট অবস্থায় থাকে)
                Router.showLogin();
                hideSplash();
            }
        }
    }
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
