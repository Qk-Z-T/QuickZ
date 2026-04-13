// js/router.js
// রাউটিং, পেজ নেভিগেশন, এবং ব্রাউজার ব্যাক/ফরওয়ার্ড সাপোর্ট

import { AppState } from './core/state.js';
import { db } from './config/firebase.js';
import { Teacher } from './teacher/teacher-core.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { clearListeners, initRealTimeSync } from './features/realtime-sync.js';

// হিস্ট্রি স্ট্যাক ম্যানেজ করার জন্য
let isInternalNavigation = false;
const validPages = ['home', 'create', 'rank', 'folders', 'management'];

export const Router = {
    initTeacher: () => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('show');
        const websiteLayout = document.getElementById('website-layout');
        if (websiteLayout) websiteLayout.classList.remove('hidden');
        
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('teacher-nav').classList.remove('hidden');
        document.getElementById('teacher-header').classList.remove('hidden');
        
        Teacher.loadGroupsForSwitcher();
        
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('home');
        } else {
            // প্রথম লোডে বর্তমান URL হিসেবে home সেট করে রাখি
            const currentPage = 'home';
            AppState.currentPage = currentPage;
            window.history.replaceState({ page: currentPage }, '', `#${currentPage}`);
            Router.teacher(currentPage);
        }
    },
    
    showTeacherProfileForm: () => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('show');
        const websiteLayout = document.getElementById('website-layout');
        if (websiteLayout) websiteLayout.classList.remove('hidden');
        
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').innerHTML = `
            <div class="p-0 max-w-2xl">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white text-2xl mb-3 mx-auto">
                        <i class="fas fa-user-graduate"></i>
                    </div>
                    <h2 class="text-xl font-bold dark:text-white bengali-text">আপনার প্রোফাইল সম্পূর্ণ করুন</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 bengali-text">চালিয়ে যেতে আপনার তথ্য প্রদান করুন</p>
                </div>
                <div class="teacher-profile-form">
                    <div class="mb-4">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">পূর্ণ নাম</label>
                        <input type="text" id="teacher-fullname" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="আপনার পূর্ণ নাম লিখুন" required>
                    </div>
                    <div class="mb-6">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">ফোন নম্বর</label>
                        <input type="tel" id="teacher-phone" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="আপনার ফোন নম্বর লিখুন" required>
                    </div>
                    <button onclick="Router.saveTeacherProfile()" class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-bold shadow-lg bengali-text">
                        প্রোফাইল সংরক্ষণ করুন ও চালিয়ে যান
                    </button>
                </div>
            </div>
        `;
    },
    
    saveTeacherProfile: async () => {
        const fullName = document.getElementById('teacher-fullname').value.trim();
        const phone = document.getElementById('teacher-phone').value.trim();
        
        if (!fullName || !phone) {
            Swal.fire('ত্রুটি', 'সবগুলো ঘর পূরণ করুন', 'error');
            return;
        }
        
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        let teacherCode = '';
        
        for (let i = 0; i < 5; i++) { teacherCode += letters.charAt(Math.floor(Math.random() * letters.length)); }
        teacherCode += '-';
        for (let i = 0; i < 5; i++) { teacherCode += numbers.charAt(Math.floor(Math.random() * numbers.length)); }
        
        try {
            await updateDoc(doc(db, "teachers", AppState.currentUser.id), {
                fullName: fullName,
                phone: phone,
                teacherCode: teacherCode,
                profileCompleted: true,
                updatedAt: new Date()
            });
            
            AppState.currentUser.fullName = fullName;
            AppState.currentUser.phone = phone;
            AppState.currentUser.teacherCode = teacherCode;
            AppState.currentUser.profileCompleted = true;
            
            localStorage.setItem('teacher_data', JSON.stringify(AppState.currentUser));
            
            Swal.fire('সফল', 'প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে!', 'success').then(() => {
                Router.initTeacher();
            });
        } catch (error) {
            Swal.fire('ত্রুটি', 'প্রোফাইল সংরক্ষণ ব্যর্থ: ' + error.message, 'error');
        }
    },
    
    // পেজ নেভিগেট করার মূল ফাংশন
    navigateTo: (page, addToHistory = true) => {
        if (!validPages.includes(page)) {
            console.error('Invalid page:', page);
            return;
        }
        
        if (!AppState.selectedGroup && page !== 'management') {
            Swal.fire({
                title: 'কোর্স নির্বাচন করুন',
                text: 'এই অপশনটি ব্যবহার করতে আগে একটি কোর্স সিলেক্ট করুন।',
                icon: 'warning',
                confirmButtonColor: '#4f46e5'
            });
            Teacher.selectGroupView(page);
            return;
        }

        clearListeners();
        AppState.currentPage = page;
        console.log('Router: Navigating to', page);
        
        if (typeof Teacher.closeMobileSidebar === 'function') {
            Teacher.closeMobileSidebar();
        }
        
        document.querySelectorAll('.sidebar-nav-item.nav-item').forEach(el => {
            el.classList.remove('active');
        });
        const activeNav = document.getElementById('nav-' + page);
        if (activeNav) activeNav.classList.add('active');
        
        const titles = {home: 'ড্যাশবোর্ড হোম', create: 'পরীক্ষা তৈরি', rank: 'র‍্যাংকিং', folders: 'লাইব্রেরি', management: 'ম্যানেজমেন্ট'};
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerHTML = (titles[page] || 'শিক্ষক') + ' <span style="color:#4f46e5">প্যানেল</span>';
        
        if (page !== 'create') {
            document.getElementById('floating-math-btn').classList.add('hidden');
            document.getElementById('math-symbols-panel').classList.remove('show');
        }
        
        const pagesRequiringGroup = ['home', 'create', 'rank', 'folders', 'management'];
        if (pagesRequiringGroup.includes(page) && !AppState.selectedGroup) {
            Teacher.selectGroupView(page);
            return;
        }
        
        if(page === 'home') Teacher.homeView();
        if(page === 'create') Teacher.createView();
        if(page === 'rank') Teacher.rankView();
        if(page === 'folders') Teacher.foldersView();
        if(page === 'management') Teacher.managementView();
        
        // ব্রাউজার হিস্ট্রিতে যুক্ত করা (যাতে ব্যাক বাটন কাজ করে)
        if (addToHistory) {
            window.history.pushState({ page: page }, '', `#${page}`);
        }
    },
    
    // পুরনো মেথডটি navigateTo ব্যবহার করবে
    teacher: (p) => {
        Router.navigateTo(p, true);
    },
    
    // ব্যাক বাটন চাপলে এই ফাংশন কল হবে (main.js থেকে ডাকা হবে)
    handlePopState: (event) => {
        const state = event.state;
        if (state && state.page && validPages.includes(state.page)) {
            console.log('Popstate: navigating back to', state.page);
            Router.navigateTo(state.page, false); // হিস্ট্রিতে আবার যুক্ত করবে না
        } else {
            // যদি কোনো স্টেট না থাকে, তাহলে হোমে যাও
            console.log('Popstate: no state, going home');
            Router.navigateTo('home', false);
        }
    }
};

window.Router = Router;
