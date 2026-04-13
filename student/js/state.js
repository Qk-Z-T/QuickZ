// js/state.js
// Global application state management

// Global State Object
export const AppState = { 
    role: 'student', 
    user: null, 
    userDisabled: false, 
    profileCompleted: false,
    userProfile: null,
    teacherCodes: [],
    teacherNames: {},
    groupCode: null,
    hasGroupCode: false,
    activeTeacherCode: null,
    activeGroupId: localStorage.getItem('activeGroupId') || null,
    joinedGroups: []
};

// Cache for exams data
export let ExamCache = {};

// Array to store unsubscribe functions for Firestore listeners
export let unsubscribes = [];

// Pagination and filter state
export let currentResultPage = 1;
export let resultFilter = 'all';
export let filteredQuestions = [];
export let resultTypeFilter = 'live';
export let pastSubjectFilter = 'all';
export let resultsSubjectFilter = 'all';
export let lastMockContext = { subject: null, chapter: null, teacherId: null };
export let pastLiveExamSearchQuery = '';
export let liveExamSearchQuery = '';
export let currentRouteId = 0;
export let rankSearchQuery = '';
export let allRankAttempts = [];

// Helper to clear all Firestore listeners
export const clearListeners = () => { 
    unsubscribes.forEach(u => u()); 
    unsubscribes = []; 
};

// Debounce utility
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Mobile drawer toggle
export function toggleMobileDrawer() {
    document.getElementById('mobileDrawer').classList.toggle('open');
    document.getElementById('drawerOverlay').classList.toggle('open');
}
window.toggleMobileDrawer = toggleMobileDrawer;

// MathJax loader
export function loadMathJax(callback, targetElement) {
    setTimeout(() => {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            if (window.MathJax.typesetClear) {
                window.MathJax.typesetClear();
            }
            MathJax.typesetPromise(targetElement ? [targetElement] : undefined)
                .then(() => { if (callback) callback(); })
                .catch(err => console.warn('MathJax error', err));
            return;
        }
        if (!document.getElementById('mathjax-script')) {
            const script = document.createElement('script');
            script.id = 'mathjax-script';
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
            script.async = true;
            script.onload = () => {
                MathJax.typesetPromise(targetElement ? [targetElement] : undefined)
                    .then(() => { if (callback) callback(); })
                    .catch(err => console.warn('MathJax error', err));
            };
            document.head.appendChild(script);
        }
    }, 50);
}
window.loadMathJax = loadMathJax;

// Star Rating component
export function StarRating(percentage) {
    const fullStars = Math.floor(percentage / 20);
    const remainder = percentage % 20;
    const halfStar = remainder >= 10 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    
    let starsHTML = '';
    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star text-yellow-400"></i>';
    if (halfStar) starsHTML += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star text-yellow-400"></i>';
    return `<div class="flex items-center gap-1 text-sm star-rating">${starsHTML}</div>`;
}
window.StarRating = StarRating;

// Math Helper for rendering exam content
export const MathHelper = {
    renderExamContent: (text) => {
        if (!text) return '';
        text = String(text)
            .replace(/\\propotional/g, '\\propto')
            .replace(/\\div/g, '\\div')
            .replace(/\\times/g, '\\times')
            .replace(/\\approx/g, '\\approx')
            .replace(/\\degree/g, '^{\\circ}');
        const hasBengali = /[\u0980-\u09FF]/.test(text);
        const hasMathDelimiters = text.includes('$') || text.includes('\\(') || text.includes('\\[');
        const hasMathSymbols = /[_^\\]/.test(text);
        if (hasMathDelimiters) {
            return `<span class="bengali-text">${text}</span>`;
        }
        if (!hasBengali && hasMathSymbols) {
            return `<span class="bengali-text">\\(${text}\\)</span>`;
        }
        if (hasBengali && hasMathSymbols) {
            let autoFixedText = text.replace(/([A-Za-z0-9]*[_^\\][A-Za-z0-9{}\\\-+=.]+)/g, '$$$1$$');
            return `<span class="bengali-text">${autoFixedText}</span>`;
        }
        return `<span class="bengali-text">${text}</span>`;
    },
    processOptions: (options) => {
        return options.map((opt, index) => {
            return `<div class="option-math flex items-start gap-2">
                <span class="font-bold">${String.fromCharCode(65 + index)}.</span>
                <div class="flex-1">${MathHelper.renderExamContent(opt)}</div>
            </div>`;
        });
    }
};
window.MathHelper = MathHelper;

// Header renderer
export function renderHeader(activePage) {
    const user = AppState.userProfile || {};
    const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    return `
    <aside class="desktop-sidebar hidden md:flex flex-col bg-white border-r fixed left-0 top-0 h-screen w-[250px] z-50 shadow-sm">
        <div class="p-6 flex items-center border-b border-slate-100">
            <div class="flex-1">
                <div class="text-xl font-bold quickz-logo">
                    <span class="quick">Quick</span><span class="z">Z</span>
                </div>
                <div class="text-[10px] text-slate-500">The ultimate exam platform</div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="Router.student('notices')" class="relative p-2 rounded-full hover:bg-slate-100 transition">
                    <i class="fas fa-bell text-xl text-slate-600"></i>
                    <span id="notification-badge" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hidden">0</span>
                </button>
                <button onclick="Router.student('profile')" class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg border-2 border-white shadow-md">
                    ${initial}
                </button>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto py-6 px-4 space-y-2">
            <button onclick="Router.student('dashboard')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activePage === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}">
                <i class="fas fa-home w-5 text-lg"></i> হোম
            </button>
            <button onclick="Router.student('rank')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activePage === 'rank' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}">
                <i class="fas fa-trophy w-5 text-lg"></i> র‍্যাংক
            </button>
            <button onclick="Router.student('results')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activePage === 'results' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}">
                <i class="fas fa-clipboard-list w-5 text-lg"></i> ফলাফল
            </button>
            <button onclick="Router.student('analysis')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activePage === 'analysis' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}">
                <i class="fas fa-chart-pie w-5 text-lg"></i> অগ্রগতি
            </button>
            <button onclick="Router.student('notices')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activePage === 'notices' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}">
                <i class="fas fa-bell w-5 text-lg"></i> নোটিস
            </button>
            <button onclick="Router.student('management')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activePage === 'management' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}">
                <i class="fas fa-cogs w-5 text-lg"></i> ম্যানেজমেন্ট
            </button>
            <button onclick="ThemeManager.openThemeModal()" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all" style="color:var(--text-muted);">
                <i class="fas fa-palette w-5 text-lg"></i> থিম পরিবর্তন
            </button>
        </div>
    </aside>
    <header class="md:hidden sticky top-0 z-50 px-5 py-3 backdrop-blur-md border-b flex items-center justify-between shadow-sm" style="background-color:var(--header-bg);border-color:var(--header-border);">
        <div class="flex items-center gap-3">
            <div>
                <div class="text-xl font-bold quickz-logo">
                    <span class="quick">Quick</span><span class="z">Z</span>
                </div>
                <div class="text-[8px] text-slate-500">The ultimate exam platform</div>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <button onclick="Router.student('notices')" class="relative p-2">
                <i class="fas fa-bell text-xl"></i>
                <span id="notification-badge-mobile" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center hidden">0</span>
            </button>
            <button onclick="Router.student('profile')" class="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-base border-2 border-white shadow-sm">
                ${initial}
            </button>
            <button onclick="toggleMobileDrawer()" class="p-2 rounded-xl bg-slate-50 text-slate-600 transition-colors border border-slate-100">
                <i class="fas fa-bars text-lg"></i>
            </button>
        </div>
    </header>`;
}
window.renderHeader = renderHeader;

// Theme Manager
export const ThemeManager = {
    openThemeModal: () => {
        const current = localStorage.getItem('theme') || 'light';
        Swal.fire({
            title: 'থিম নির্বাচন করুন',
            html: `
                <div style="display:flex;gap:16px;justify-content:center;margin-top:12px;">
                    <button onclick="ThemeManager.setTheme('light')" 
                        style="padding:18px 32px;border-radius:14px;border:2px solid ${current==='light'?'#4f46e5':'#e2e8f0'};background:#f8fafc;color:#1e293b;font-weight:bold;cursor:pointer;font-size:16px;min-width:110px;transition:all 0.2s;">
                        ☀️<br><span style="font-size:13px;margin-top:6px;display:block;">লাইট</span>
                    </button>
                    <button onclick="ThemeManager.setTheme('dark')" 
                        style="padding:18px 32px;border-radius:14px;border:2px solid ${current==='dark'?'#6366f1':'#374155'};background:#1a1f2e;color:#e8ecf4;font-weight:bold;cursor:pointer;font-size:16px;min-width:110px;transition:all 0.2s;">
                        🌙<br><span style="font-size:13px;margin-top:6px;display:block;">ডার্ক</span>
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'বন্ধ'
        });
    },
    setTheme: (theme) => {
        document.documentElement.classList.remove('theme-dark');
        if (theme === 'dark') document.documentElement.classList.add('theme-dark');
        localStorage.setItem('theme', theme);
        Swal.close();
    },
    loadTheme: () => {
        const saved = localStorage.getItem('theme') || 'light';
        ThemeManager.setTheme(saved);
    }
};
window.ThemeManager = ThemeManager;

// Refresh Exam Cache
export const refreshExamCache = () => {
    clearListeners();
    if (!AppState.activeGroupId) {
        ExamCache = {};
        return;
    }
    
    import("./config.js").then(({ db }) => {
        import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js").then(({ collection, query, where, onSnapshot }) => {
            const q = query(collection(db, "exams"), where("groupId", "==", AppState.activeGroupId));
            const unsubscribe = onSnapshot(q, (snap) => {
                ExamCache = {};
                snap.forEach(d => ExamCache[d.id] = { id: d.id, ...d.data() });
                // Also save to offline cache
                const examCache = {};
                snap.forEach(d => { examCache[d.id] = { id: d.id, ...d.data() }; });
                localStorage.setItem('offlineExamCache_' + AppState.activeGroupId, JSON.stringify(examCache));
            });
            unsubscribes.push(unsubscribe);
        });
    });
};
window.refreshExamCache = refreshExamCache;
