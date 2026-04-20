
// js/router.js
// Routing and page navigation — FIXED

import { AppState } from './core/state.js';
import { db } from './config/firebase.js';
import { Teacher } from './teacher/teacher-core.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { clearListeners, initRealTimeSync } from './features/realtime-sync.js';

const validPages = ['home', 'create', 'rank', 'folders', 'management'];

export const Router = {
    // ✅ FIX: login route — auth screen দেখানো
    showLogin: () => {
        const authScreen = document.getElementById('auth-screen');
        const websiteLayout = document.getElementById('website-layout');
        const appContainer = document.getElementById('app-container');
        const teacherNav = document.getElementById('teacher-nav');
        const teacherHeader = document.getElementById('teacher-header');

        if (authScreen) {
            authScreen.classList.remove('hidden');
            authScreen.classList.add('show');
        }
        if (websiteLayout) websiteLayout.classList.add('hidden');
        if (appContainer) appContainer.classList.add('hidden');
        if (teacherNav) teacherNav.classList.add('hidden');
        if (teacherHeader) teacherHeader.classList.add('hidden');
    },

    initTeacher: () => {
        const authScreen = document.getElementById('auth-screen');
        const websiteLayout = document.getElementById('website-layout');
        const appContainer = document.getElementById('app-container');
        const teacherNav = document.getElementById('teacher-nav');
        const teacherHeader = document.getElementById('teacher-header');

        if (authScreen) {
            authScreen.classList.add('hidden');
            authScreen.classList.remove('show');
        }
        if (websiteLayout) websiteLayout.classList.remove('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        if (teacherNav) teacherNav.classList.remove('hidden');
        if (teacherHeader) teacherHeader.classList.remove('hidden');

        Teacher.loadGroupsForSwitcher?.();

        if (!AppState.selectedGroup) {
            Teacher.selectGroupView?.('home');
        } else {
            AppState.currentPage = 'home';
            window.history.replaceState({ page: 'home' }, '', `#home`);
            Router.navigateTo('home', false);
        }
    },

    showTeacherProfileForm: () => {
        const authScreen = document.getElementById('auth-screen');
        const websiteLayout = document.getElementById('website-layout');
        const appContainer = document.getElementById('app-container');

        if (authScreen) authScreen.classList.add('hidden');
        if (websiteLayout) websiteLayout.classList.remove('hidden');
        if (appContainer) {
            appContainer.classList.remove('hidden');
            appContainer.innerHTML = `
            <div class="p-0 max-w-2xl">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white text-2xl mb-3 mx-auto">
                        <i class="fas fa-user-graduate"></i>
                    </div>
                    <h2 class="text-xl font-bold dark:text-white">Complete Your Profile</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Please provide your information to continue</p>
                </div>
                <div class="teacher-profile-form">
                    <div class="mb-4">
                        <label class="block text-sm font-bold mb-1 dark:text-white">Full Name</label>
                        <input type="text" id="teacher-fullname" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="Enter your full name" required>
                    </div>
                    <div class="mb-6">
                        <label class="block text-sm font-bold mb-1 dark:text-white">Phone Number</label>
                        <input type="tel" id="teacher-phone" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="Enter your phone number" required>
                    </div>
                    <button onclick="Router.saveTeacherProfile()" class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-bold shadow-lg">
                        Save Profile & Continue
                    </button>
                </div>
            </div>
        `;
        }
    },

    saveTeacherProfile: async () => {
        const fullName = document.getElementById('teacher-fullname')?.value.trim();
        const phone = document.getElementById('teacher-phone')?.value.trim();
        if (!fullName || !phone) { Swal.fire('Error', 'Please fill all fields', 'error'); return; }

        // আর teacherCode জেনারেট করছি না
        try {
            await updateDoc(doc(db, "teachers", AppState.currentUser.id), {
                fullName, phone, profileCompleted: true, updatedAt: new Date()
            });
            AppState.currentUser.fullName = fullName;
            AppState.currentUser.phone = phone;
            AppState.currentUser.profileCompleted = true;
            localStorage.setItem('teacher_data', JSON.stringify(AppState.currentUser));
            Swal.fire('Success', 'Profile saved!', 'success').then(() => Router.initTeacher());
        } catch (error) {
            Swal.fire('Error', 'Failed to save profile: ' + error.message, 'error');
        }
    },

    navigateTo: (page, addToHistory = true) => {
        if (!validPages.includes(page)) return;
        if (!AppState.selectedGroup && page !== 'management') {
            Swal.fire({ title: 'Select Course', text: 'Please select a course first.', icon: 'warning' });
            Teacher.selectGroupView?.(page);
            return;
        }
        clearListeners();
        AppState.currentPage = page;
        Teacher.closeMobileSidebar?.();
        document.querySelectorAll('.sidebar-nav-item.nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById('nav-' + page)?.classList.add('active');

        const titles = { home: 'Dashboard Home', create: 'Create Exam', rank: 'Rankings', folders: 'Library', management: 'Management' };
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.innerHTML = (titles[page] || 'Teacher') + ' <span style="color:#4f46e5">Panel</span>';

        const floatingMath = document.getElementById('floating-math-btn');
        const mathPanel = document.getElementById('math-symbols-panel');
        if (page !== 'create') {
            floatingMath?.classList.add('hidden');
            mathPanel?.classList.remove('show');
        }

        if (page === 'home') Teacher.homeView?.();
        if (page === 'create') Teacher.createView?.();
        if (page === 'rank') Teacher.rankView?.();
        if (page === 'folders') Teacher.foldersView?.();
        if (page === 'management') Teacher.managementView?.();

        if (addToHistory) window.history.pushState({ page }, '', `#${page}`);
    },

    // ✅ FIX: teacher(p) — 'login' হলে showLogin(), বাকি সব navigateTo()
    teacher: (p) => {
        if (p === 'login') {
            Router.showLogin();
        } else if (p === 'home' && AppState.user) {
            Router.initTeacher();
        } else {
            Router.navigateTo(p, true);
        }
    },

    handlePopState: (event) => {
        const state = event.state;
        if (state && state.page && validPages.includes(state.page)) {
            Router.navigateTo(state.page, false);
        } else {
            Router.navigateTo('home', false);
        }
    }
};

window.Router = Router;
