// js/router.js
// রাউটিং এবং পেজ নেভিগেশন ম্যানেজ করে

import { AppState } from './core/state.js';
import { db } from './config/firebase.js';
import { Teacher } from './teacher-core.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// গ্লোবাল আনসাবস্ক্রাইব ক্লিয়ার ফাংশন (teacher-core.js থেকে ইম্পোর্ট হবে)
import { clearListeners, initRealTimeSync } from './teacher-core.js';

export const Router = {
    initTeacher: () => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('show');
        const websiteLayout = document.getElementById('website-layout');
        if (websiteLayout) websiteLayout.classList.remove('hidden');
        
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('pt-16');
        document.getElementById('teacher-nav').classList.remove('hidden');
        document.getElementById('teacher-nav').classList.add('flex');
        document.getElementById('teacher-header').classList.remove('hidden');
        document.getElementById('teacher-header').classList.add('flex');
        
        Teacher.loadGroupsForSwitcher();
        
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('home');
        } else {
            Router.teacher('home');
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
    
    teacher: (p) => {
        if (!AppState.selectedGroup && p !== 'management') {
            Swal.fire({
                title: 'কোর্স নির্বাচন করুন',
                text: 'এই অপশনটি ব্যবহার করতে আগে একটি কোর্স সিলেক্ট করুন।',
                icon: 'warning',
                confirmButtonColor: '#4f46e5'
            });
            Teacher.selectGroupView(p);
            return;
        }

        clearListeners();
        AppState.currentPage = p;
        
        if (typeof Teacher.closeMobileSidebar === 'function') {
            Teacher.closeMobileSidebar();
        }
        
        document.querySelectorAll('.sidebar-nav-item.nav-item').forEach(el => {
            el.classList.remove('active');
        });
        const activeNav = document.getElementById('nav-' + p);
        if (activeNav) activeNav.classList.add('active');
        
        const titles = {home: 'ড্যাশবোর্ড হোম', create: 'পরীক্ষা তৈরি', rank: 'র‍্যাংকিং', folders: 'লাইব্রেরি', management: 'ম্যানেজমেন্ট'};
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerHTML = (titles[p] || 'শিক্ষক') + ' <span style="color:#4f46e5">প্যানেল</span>';
        
        document.querySelectorAll('#teacher-nav .nav-item').forEach(el => {
            el.classList.remove('active', 'text-indigo-600');
            el.classList.add('text-slate-400');
        });
        
        if (p !== 'create') {
            document.getElementById('floating-math-btn').classList.add('hidden');
            document.getElementById('math-symbols-panel').classList.remove('show');
        }
        
        const pagesRequiringGroup = ['home', 'create', 'rank', 'folders', 'management'];
        if (pagesRequiringGroup.includes(p) && !AppState.selectedGroup) {
            Teacher.selectGroupView(p);
            return;
        }
        
        if(p==='home') Teacher.homeView();
        if(p==='create') Teacher.createView();
        if(p==='rank') Teacher.rankView();
        if(p==='folders') Teacher.foldersView();
        if(p==='management') Teacher.managementView();
    }
};

// গ্লোবাল এক্সপোজ
window.Router = Router;
