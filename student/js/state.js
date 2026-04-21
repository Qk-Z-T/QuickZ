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
    joinedGroups: [],
    // নতুন ফিল্ড: শিক্ষার্থীর ক্লাস/লেভেল
    classLevel: localStorage.getItem('studentClassLevel') || '',
    admissionStream: localStorage.getItem('studentAdmissionStream') || ''
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
    document.getElementById('mobileDrawer')?.classList.toggle('open');
    document.getElementById('drawerOverlay')?.classList.toggle('open');
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

// Header renderer (সাইডবারে নতুন 'কোর্সসমূহ' মেনু যোগ করা হবে পরে)
export function renderHeader(activePage) {
    const user = AppState.userProfile || {};
    const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    
    // জয়েন করা কোর্সের তালিকা থেকে বর্তমান সক্রিয় কোর্সের নাম বের করা
    let currentCourseName = 'কোর্স নির্বাচন করুন';
    if (AppState.activeGroupId && AppState.joinedGroups) {
        const active = AppState.joinedGroups.find(g => g.groupId === AppState.activeGroupId);
        if (active) currentCourseName = active.groupName || 'অজানা কোর্স';
    }
    
    return `
    <!-- ডেস্কটপ সাইডবার (বাম পাশে স্থির) -->
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
            <button onclick="Router.student('courses')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activePage === 'courses' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}">
                <i class="fas fa-book-open w-5 text-lg"></i> কোর্সসমূহ
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

    <!-- মোবাইল হেডার (শুধু ছোট স্ক্রিনে) -->
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
    </header>

    <!-- ডেস্কটপ টপ বার (কোর্স সুইচার ও প্রোফাইল) -->
    <div class="hidden md:block fixed top-0 left-[250px] right-0 z-40 px-6 py-2 border-b shadow-sm" style="background-color:var(--header-bg);border-color:var(--header-border);">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <span class="text-sm font-medium" style="color:var(--text-secondary);">বর্তমান কোর্স:</span>
                <div class="relative course-switcher-dropdown">
                    <button id="course-switcher-btn" onclick="Student.toggleCourseSwitcher()" class="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition" style="background-color:var(--card-bg);border-color:var(--border-light);color:var(--text-primary);">
                        <i class="fas fa-book-open text-indigo-500"></i>
                        <span id="current-course-name-display">${currentCourseName}</span>
                        <i class="fas fa-chevron-down text-xs opacity-60"></i>
                    </button>
                    <div id="course-switcher-menu" class="hidden absolute top-full left-0 mt-2 w-64 rounded-xl shadow-lg border z-50 max-h-80 overflow-y-auto" style="background-color:var(--card-bg);border-color:var(--border-light);">
                        <div id="course-switcher-list" class="py-2">
                            ${AppState.joinedGroups && AppState.joinedGroups.length > 0 ? 
                                AppState.joinedGroups.map(g => `
                                    <div class="px-4 py-3 hover:bg-slate-50 dark:hover:bg-dark-tertiary cursor-pointer transition flex items-center justify-between ${g.groupId === AppState.activeGroupId ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}" onclick="Student.switchCourseFromDropdown('${g.groupId}')">
                                        <div class="flex-1">
                                            <div class="font-medium text-sm" style="color:var(--text-primary);">${g.groupName || 'অজানা কোর্স'}</div>
                                        </div>
                                        ${g.groupId === AppState.activeGroupId ? '<i class="fas fa-check text-indigo-600 text-xs"></i>' : ''}
                                    </div>
                                `).join('') 
                                : '<div class="px-4 py-3 text-center text-sm text-slate-400">কোনো কোর্সে জয়েন নেই</div>'
                            }
                        </div>
                        <div class="border-t p-2" style="border-color:var(--border-light);">
                            <button onclick="Router.student('courses'); Student.toggleCourseSwitcher();" class="w-full text-center text-xs text-indigo-600 font-bold py-2 hover:underline">
                                <i class="fas fa-plus mr-1"></i> নতুন কোর্স খুঁজুন
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="Router.student('notices')" class="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-dark-tertiary transition">
                    <i class="fas fa-bell text-lg" style="color:var(--text-secondary);"></i>
                    <span id="notification-badge-desktop" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center hidden">0</span>
                </button>
                <button onclick="Router.student('profile')" class="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-base border-2 border-white shadow-sm">
                    ${initial}
                </button>
            </div>
        </div>
    </div>

    <!-- মোবাইল ড্রয়ার (সাইডবারের পরিবর্তে) -->
    <div class="mobile-drawer" id="mobileDrawer">
        <div class="flex justify-between items-center mb-6">
            <div class="text-xl font-bold quickz-logo">
                <span class="quick">Quick</span><span class="z">Z</span>
            </div>
            <button onclick="toggleMobileDrawer()" class="text-2xl" style="color:var(--text-primary);">&times;</button>
        </div>
        <!-- মোবাইল ড্রয়ারে কোর্স সুইচার -->
        <div class="mb-4 px-2">
            <label class="text-xs font-bold text-slate-500 mb-2 block">বর্তমান কোর্স</label>
            <select id="mobile-course-switcher" class="w-full p-3 rounded-xl border text-sm" style="background-color:var(--input-bg);border-color:var(--border-light);color:var(--text-primary);" onchange="Student.switchCourseFromMobile(this.value)">
                ${AppState.joinedGroups && AppState.joinedGroups.length > 0 ? 
                    AppState.joinedGroups.map(g => `<option value="${g.groupId}" ${g.groupId === AppState.activeGroupId ? 'selected' : ''}>${g.groupName || 'অজানা কোর্স'}</option>`).join('') 
                    : '<option disabled>কোনো কোর্স নেই</option>'
                }
            </select>
        </div>
        <div class="drawer-item" onclick="Router.student('dashboard'); toggleMobileDrawer()">
            <i class="fas fa-home"></i> হোম
        </div>
        <div class="drawer-item" onclick="Router.student('courses'); toggleMobileDrawer()">
            <i class="fas fa-book-open"></i> কোর্সসমূহ
        </div>
        <div class="drawer-item" onclick="Router.student('rank'); toggleMobileDrawer()">
            <i class="fas fa-trophy"></i> র‍্যাংক
        </div>
        <div class="drawer-item" onclick="Router.student('results'); toggleMobileDrawer()">
            <i class="fas fa-clipboard-list"></i> ফলাফল
        </div>
        <div class="drawer-item" onclick="Router.student('analysis'); toggleMobileDrawer()">
            <i class="fas fa-chart-pie"></i> অগ্রগতি
        </div>
        <div class="drawer-item" onclick="Router.student('notices'); toggleMobileDrawer()">
            <i class="fas fa-bell"></i> নোটিস
        </div>
        <div class="drawer-item" onclick="Router.student('management'); toggleMobileDrawer()">
            <i class="fas fa-cogs"></i> ম্যানেজমেন্ট
        </div>
        <div class="drawer-item" onclick="ThemeManager.openThemeModal(); toggleMobileDrawer()">
            <i class="fas fa-palette"></i> থিম পরিবর্তন
        </div>
    </div>
    `;
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
