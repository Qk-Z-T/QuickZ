// teacher/js/main.js
// মোবাইল ডিবাগ ভার্সন – স্ক্রিনে সরাসরি লগ দেখাবে

// ---------- ডিবাগ প্যানেল তৈরি (মোবাইলের জন্য) ----------
function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'mobile-debug-panel';
    panel.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; background: #1e293b; color: #e2e8f0;
        z-index: 99999; max-height: 60vh; overflow-y: auto; padding: 12px; font-size: 12px;
        font-family: monospace; border-bottom: 3px solid #3b82f6; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        white-space: pre-wrap; word-break: break-word;
    `;
    panel.innerHTML = '<b style="color:#60a5fa;">🔍 QuickZ Debug Panel</b><br>Initializing...';
    document.body.appendChild(panel);
    return panel;
}

const debugPanel = createDebugPanel();

function debugLog(msg, isError = false) {
    console.log(msg);
    const line = document.createElement('div');
    line.style.color = isError ? '#f87171' : '#cbd5e1';
    line.style.marginTop = '4px';
    line.textContent = (isError ? '❌ ' : '✅ ') + msg;
    debugPanel.appendChild(line);
    debugPanel.scrollTop = debugPanel.scrollHeight;
}

function debugError(msg) {
    console.error(msg);
    debugLog(msg, true);
}

// গ্লোবাল এরর হ্যান্ডলার
window.addEventListener('error', (e) => {
    debugError(`JS Error: ${e.message} at ${e.filename}:${e.lineno}`);
});

window.addEventListener('unhandledrejection', (e) => {
    debugError(`Promise Rejection: ${e.reason}`);
});

// ---------- স্প্ল্যাশ হাইড করে ডিবাগ প্যানেল দেখান ----------
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.display = 'none';
        debugLog('Splash screen hidden manually');
    }
    // লেআউট দেখানোর চেষ্টা
    const layout = document.getElementById('website-layout');
    if (layout) {
        layout.classList.remove('hidden');
        debugLog('Website layout unhidden');
    } else {
        debugError('website-layout element not found!');
    }
}, 500);

// ---------- মডিউল ইম্পোর্ট শুরু ----------
debugLog('Starting module imports...');

import { AppState } from './core/state.js';
import { Auth } from './features/auth.js';
import { MathEditor } from './features/math-editor.js';
import { Router } from './router.js';
import { Teacher } from './teacher/teacher-core.js';
import { initRealTimeSync, clearListeners } from './features/realtime-sync.js';
import { autoResizeTextarea, toggleDarkMode, loadMathJax } from './core/utils.js';

debugLog('Core modules imported');

// ফিচার মডিউল ইম্পোর্ট
try {
    await import('./teacher/dashboard.js');
    debugLog('dashboard.js loaded');
} catch(e) { debugError('dashboard.js: ' + e.message); }
try {
    await import('./teacher/exam-create.js');
    debugLog('exam-create.js loaded');
} catch(e) { debugError('exam-create.js: ' + e.message); }
try {
    await import('./teacher/library.js');
    debugLog('library.js loaded');
} catch(e) { debugError('library.js: ' + e.message); }
try {
    await import('./teacher/rankings.js');
    debugLog('rankings.js loaded');
} catch(e) { debugError('rankings.js: ' + e.message); }
try {
    await import('./teacher/management.js');
    debugLog('management.js loaded');
} catch(e) { debugError('management.js: ' + e.message); }
try {
    await import('./teacher/notice-poll.js');
    debugLog('notice-poll.js loaded');
} catch(e) { debugError('notice-poll.js: ' + e.message); }
try {
    await import('./teacher/groups.js');
    debugLog('groups.js loaded');
} catch(e) { debugError('groups.js: ' + e.message); }
try {
    await import('./teacher/profile.js');
    debugLog('profile.js loaded');
} catch(e) { debugError('profile.js: ' + e.message); }

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

window.ExamCache = {};
window.unsubscribes = [];
window.folderStructure = { live: [], mock: [], uncategorized: [] };
window.currentFocusedTextarea = null;
window.questionMode = 'manual';

debugLog('Global variables initialized');

// ডার্ক মোড
if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.classList.add('theme-dark');
    AppState.darkMode = true;
} else {
    document.documentElement.classList.remove('theme-dark');
    AppState.darkMode = false;
}

// ---------- Firebase Auth Observer ----------
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const auth = getAuth();
debugLog('Firebase Auth initialized');

onAuthStateChanged(auth, async (user) => {
    debugLog(`Auth state changed: ${user ? user.email : 'No user'}`);
    
    const splash = document.getElementById('splash-screen');
    const layout = document.getElementById('website-layout');
    const authScreen = document.getElementById('auth-screen');
    
    if (user) {
        AppState.user = user;
        try {
            debugLog('Loading teacher profile...');
            await Auth.loadTeacherProfile(user.uid);
            debugLog(`Profile loaded: ${AppState.currentUser?.fullName || 'Name missing'}`);
            
            if (!AppState.currentUser?.profileCompleted) {
                debugLog('Profile incomplete, showing form');
                Router.showTeacherProfileForm();
            } else {
                debugLog('Profile complete, initializing teacher panel');
                initRealTimeSync();
                Router.initTeacher();
            }
        } catch (err) {
            debugError('Profile load error: ' + err.message);
            Router.showTeacherProfileForm();
        }
        
        if (authScreen) authScreen.classList.add('hidden');
        if (layout) layout.classList.remove('hidden');
        debugLog('Layout visible, auth screen hidden');
    } else {
        AppState.user = null;
        debugLog('No user, showing login screen');
        if (layout) layout.classList.add('hidden');
        if (authScreen) authScreen.classList.remove('hidden');
    }
    
    if (splash) {
        splash.classList.add('splash-hidden');
        setTimeout(() => splash.style.display = 'none', 500);
        debugLog('Splash hidden via auth observer');
    }
});

// ---------- ব্যাকআপ টাইমআউট ----------
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    const layout = document.getElementById('website-layout');
    const authScreen = document.getElementById('auth-screen');
    
    if (splash && !splash.classList.contains('splash-hidden')) {
        debugLog('Fallback: forcing splash hide');
        splash.classList.add('splash-hidden');
        setTimeout(() => splash.style.display = 'none', 300);
        
        if (!AppState.user) {
            if (layout) layout.classList.add('hidden');
            if (authScreen) authScreen.classList.remove('hidden');
        } else {
            if (layout) layout.classList.remove('hidden');
            if (authScreen) authScreen.classList.add('hidden');
        }
    }
    
    // Teacher methods check
    debugLog(`Teacher.homeView exists: ${typeof Teacher?.homeView === 'function'}`);
    debugLog(`Teacher.foldersView exists: ${typeof Teacher?.foldersView === 'function'}`);
    debugLog(`Router.teacher exists: ${typeof Router?.teacher === 'function'}`);
    
}, 4000);

// ---------- গ্লোবাল ক্লিক হ্যান্ডলার (সাধারণ) ----------
document.addEventListener('click', function(e) {
    // শুধু ডিবাগ প্যানেল টগল করার জন্য ট্যাপ
    if (e.target.id === 'mobile-debug-panel') {
        debugPanel.style.maxHeight = debugPanel.style.maxHeight === '60vh' ? '20px' : '60vh';
    }
    
    if (!e.target.closest('.three-dot-menu') && !e.target.closest('.dot-menu-dropdown')) {
        document.querySelectorAll('.dot-menu-dropdown').forEach(d => d.classList.remove('show'));
    }
    if (!e.target.closest('#math-symbols-panel') && !e.target.closest('#floating-math-btn')) {
        const panel = document.getElementById('math-symbols-panel');
        if (panel) panel.classList.remove('show');
    }
});

debugLog('Main.js execution completed. Waiting for auth...');
debugPanel.style.cursor = 'pointer';
debugPanel.title = 'Tap to expand/collapse';
