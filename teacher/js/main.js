// js/main.js
// প্রধান এন্ট্রি পয়েন্ট - সমস্ত মডিউল ইম্পোর্ট ও অ্যাসেম্বল
// ব্যাক বাটন হ্যান্ডলিং সহ

import { AppState } from './core/state.js';
import { Auth } from './features/auth.js';
import { MathEditor } from './features/math-editor.js';
import { Router } from './router.js';
import { Teacher } from './teacher/teacher-core.js';
import { initRealTimeSync, clearListeners } from './features/realtime-sync.js';
import { autoResizeTextarea, toggleDarkMode } from './core/utils.js';

// ফিচার মডিউল ইম্পোর্ট (সাইড-ইফেক্টের জন্য - এরা Teacher অবজেক্টে মেথড যোগ করে)
import './teacher/dashboard.js';
import './teacher/exam-create.js';
import './teacher/library.js';
import './teacher/rankings.js';
import './teacher/management.js';
import './teacher/notice-poll.js';
import './teacher/groups.js';
import './teacher/profile.js';

// গ্লোবাল এক্সপোজ
window.AppState = AppState;
window.MathEditor = MathEditor;
window.Router = Router;
window.Teacher = Teacher;
window.autoResizeTextarea = autoResizeTextarea;
window.toggleDarkMode = toggleDarkMode;
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
    document.documentElement.classList.add('dark');
    AppState.darkMode = true;
} else {
    document.documentElement.classList.add('light-mode');
}

// ---------- ব্যাক বাটন হ্যান্ডলিং ----------
window.addEventListener('popstate', (event) => {
    // হিস্ট্রি ব্যাক করলে Router দিয়ে পেজ ম্যানেজ করবো
    Router.handlePopState(event);
});

// স্প্ল্যাশ স্ক্রিন ও অথেনটিকেশন
window.addEventListener('load', () => {
    const hasTeacherSession = localStorage.getItem('teacher_sess');
    
    if (hasTeacherSession) {
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('splash-hidden');
            setTimeout(() => {
                document.getElementById('splash-screen').style.display = 'none';
                Auth.reloadTeacherSession();
            }, 500);
        }, 1000);
    } else {
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('splash-hidden');
            setTimeout(() => {
                document.getElementById('splash-screen').style.display = 'none';
                document.getElementById('auth-screen').classList.add('show');
            }, 500);
        }, 1500);
    }
});

// গ্লোবাল ক্লিক হ্যান্ডলার
document.addEventListener('click', function(e) {
    if (!e.target.closest('.three-dot-menu') && !e.target.closest('.dot-menu-dropdown')) {
        document.querySelectorAll('.dot-menu-dropdown').forEach(d => d.classList.remove('show'));
    }
    if (!e.target.closest('#math-symbols-panel') && !e.target.closest('#floating-math-btn')) {
        document.getElementById('math-symbols-panel').classList.remove('show');
    }
    if (!e.target.closest('.hamburger-menu')) {
        const hm = document.getElementById('hamburger-menu');
        if (hm) hm.classList.remove('show');
    }
    if (!e.target.closest('.group-switcher')) {
        document.getElementById('group-switcher-dropdown').classList.remove('show');
    }
    if (!e.target.closest('.student-three-dot-menu')) {
        document.querySelectorAll('.student-dot-menu-dropdown').forEach(d => d.classList.remove('show'));
    }
});
