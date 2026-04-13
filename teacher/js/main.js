// js/main.js
import { AppState } from './core/state.js';
import { Auth } from './features/auth.js';
import { MathEditor } from './features/math-editor.js';
import { Router } from './router.js';
import { Teacher, initRealTimeSync, clearListeners } from './teacher-core.js';
import { autoResizeTextarea, toggleDarkMode } from './core/utils.js';

// গ্লোবাল ভেরিয়েবল সেট
window.AppState = AppState;
window.MathEditor = MathEditor;
window.Router = Router;
window.Teacher = Teacher;
window.autoResizeTextarea = autoResizeTextarea;
window.toggleDarkMode = toggleDarkMode;
window.clearListeners = clearListeners;
window.initRealTimeSync = initRealTimeSync;

// স্প্ল্যাশ স্ক্রিন লজিক
window.addEventListener('load', () => {
    const hasTeacherSession = localStorage.getItem('teacher_sess');
    
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.add('light-mode');
    }
    
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
