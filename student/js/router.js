// js/router.js
// Router module

import { auth, db } from './config.js';
import { AppState, clearListeners, refreshExamCache, renderHeader } from './state.js';
import { Student } from './student.js';
import { renderRankSkeleton, renderAnalysisSkeleton, renderProfileSkeleton, renderManagementSkeleton } from './ui.js';

export const Router = {
    initStudent: () => {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        refreshExamCache();
        Student.loadDashboard();
        Student.initNotificationListener();
        
        // FIX 5: ব্যাক বাটন হ্যান্ডেলিং
        window.history.pushState({ route: 'dashboard', internal: true }, '');
        
        setTimeout(() => {
            if (navigator.onLine && AppState.activeGroupId) {
                import('./offline.js').then(({ OfflineManager }) => {
                    OfflineManager.cacheAllExams();
                });
            }
        }, 2000);
    },
    
    showProfileForm: () => {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').innerHTML = renderHeader('profile') + `
            <div class="p-5 max-w-md mx-auto">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl mb-3 mx-auto">
                        <i class="fas fa-user-graduate"></i>
                    </div>
                    <h2 class="text-xl font-bold">Complete Your Profile</h2>
                    <p class="text-sm text-slate-500 mt-1">Please provide your information to continue</p>
                </div>
                
                <div class="profile-form-container">
                    <form id="profile-form">
                        <div class="form-group">
                            <label class="form-label">Full Name <span class="required">*</span></label>
                            <input type="text" id="full-name" class="form-input" placeholder="Enter your full name" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Phone Number <span class="optional">(Optional)</span></label>
                            <input type="tel" id="phone" class="form-input" placeholder="Enter your phone number">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Father's Phone Number <span class="required">*</span></label>
                            <input type="tel" id="father-phone" class="form-input" placeholder="Enter father's phone number" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Mother's Phone Number <span class="required">*</span></label>
                            <input type="tel" id="mother-phone" class="form-input" placeholder="Enter mother's phone number" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">School Name <span class="required">*</span></label>
                            <input type="text" id="school-name" class="form-input" placeholder="Enter school name" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">College/University Name <span class="optional">(Optional)</span></label>
                            <input type="text" id="college-name" class="form-input" placeholder="Enter college/university name">
                        </div>

                        <!-- নতুন: ক্লাস/লেভেল -->
                        <div class="form-group">
                            <label class="form-label">Class/Level <span class="required">*</span></label>
                            <select id="class-level" class="form-input" required>
                                <option value="">Select your class</option>
                                <option value="6">6th Grade</option>
                                <option value="7">7th Grade</option>
                                <option value="8">8th Grade</option>
                                <option value="SSC">SSC</option>
                                <option value="HSC">HSC</option>
                                <option value="Admission">Admission</option>
                            </select>
                        </div>

                        <!-- নতুন: শাখা (শুধু Admission এর জন্য) -->
                        <div class="form-group" id="admission-stream-group" style="display:none;">
                            <label class="form-label">Stream <span class="required">*</span></label>
                            <select id="admission-stream" class="form-input">
                                <option value="">Select stream</option>
                                <option value="Science">Science</option>
                                <option value="Humanities">Humanities</option>
                                <option value="Commerce">Commerce</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Teacher's Code <span class="required">*</span></label>
                            <input type="text" id="teacher-code" class="form-input" placeholder="Enter teacher code" required>
                            <p class="text-xs text-slate-500 mt-1">Ask your teacher for the code</p>
                        </div>
                        
                        <button type="button" onclick="Student.saveProfile()" class="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg mt-4">
                            Save Profile & Continue
                        </button>
                    </form>
                </div>
            </div>
        `;
        
        // Admission সিলেক্ট করলে স্ট্রিম দেখানোর লজিক
        const classSelect = document.getElementById('class-level');
        const streamGroup = document.getElementById('admission-stream-group');
        classSelect.addEventListener('change', function() {
            if (this.value === 'Admission') {
                streamGroup.style.display = 'block';
            } else {
                streamGroup.style.display = 'none';
            }
        });
        
        window.history.pushState({ route: 'profile' }, '');
    },
    
    student: (p) => {
        window.currentRouteId++;
        const myRouteId = window.currentRouteId;

        clearListeners();
        
        if (!AppState.profileCompleted) {
            Swal.fire('প্রোফাইল প্রয়োজন', 'প্রথমে প্রোফাইল সম্পূর্ণ করুন', 'warning').then(() => {
                Router.showProfileForm();
            });
            return;
        }
        
        if (AppState.teacherCodes.length === 0) {
            Swal.fire('শিক্ষক কোড প্রয়োজন', 'অন্তত একটি শিক্ষক কোড যোগ করুন', 'warning').then(() => {
                Router.student('management');
            });
            return;
        }
        
        // courses পেজের জন্য activeGroupId এর বাধ্যবাধকতা থাকবে না
        if (p !== 'dashboard' && p !== 'profile' && p !== 'analysis' && p !== 'management' && p !== 'notices' && p !== 'courses' && !AppState.activeGroupId) {
            Swal.fire({
                title: 'কোর্সে জয়েন নেই',
                text: 'এই ফিচারটি ব্যবহার করতে আগে একটি কোর্সে জয়েন করুন।',
                icon: 'warning',
                confirmButtonText: 'জয়েন করুন'
            }).then(() => {
                Student.showGroupCodeModal();
            });
            return;
        }
        
        if (AppState.userDisabled && p !== 'profile' && p !== 'management') {
            Swal.fire({
                title: 'প্রবেশাধিকার নেই',
                text: 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়।',
                icon: 'warning',
                confirmButtonText: 'ঠিক আছে'
            }).then(() => {
                Router.student('profile');
            });
            return;
        }
        
        if (p === 'profile') {
            const c = document.getElementById('app-container');
            c.innerHTML = renderHeader('profile') + renderProfileSkeleton();
            setTimeout(() => Student.profile(), 100);
            window.history.pushState({ route: 'profile' }, '');
        } else if (p === 'dashboard') {
            Student.loadDashboard();
            window.history.pushState({ route: 'dashboard' }, '');
        } else if (p === 'courses') {
            Student.loadCourses();
            window.history.pushState({ route: 'courses' }, '');
        } else if (p === 'rank') {
            const c = document.getElementById('app-container');
            c.innerHTML = renderHeader('rank') + renderRankSkeleton();
            setTimeout(() => Student.loadRankings(), 100);
            window.history.pushState({ route: 'rank' }, '');
        } else if (p === 'results') {
            Student.loadResults();
            window.history.pushState({ route: 'results' }, '');
        } else if (p === 'analysis') {
            const c = document.getElementById('app-container');
            c.innerHTML = renderHeader('analysis') + renderAnalysisSkeleton();
            setTimeout(() => Student.loadAnalysis(), 100);
            window.history.pushState({ route: 'analysis' }, '');
        } else if (p === 'notices') {
            Student.loadNotices();
            window.history.pushState({ route: 'notices' }, '');
        } else if (p === 'management') {
            const c = document.getElementById('app-container');
            c.innerHTML = renderHeader('management') + renderManagementSkeleton();
            setTimeout(() => Student.loadManagement(), 100);
            window.history.pushState({ route: 'management' }, '');
        }
    }
};

window.Router = Router;

// FIX 5: popstate listener for back button
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.route) {
        // আমরা অ্যাপের ভিতরে আছি
        if (event.state.route === 'dashboard') Student.loadDashboard();
        else if (event.state.route === 'rank') Student.loadRankings();
        else if (event.state.route === 'results') Student.loadResults();
        else if (event.state.route === 'analysis') Student.loadAnalysis();
        else if (event.state.route === 'notices') Student.loadNotices();
        else if (event.state.route === 'management') Student.loadManagement();
        else if (event.state.route === 'profile') Student.profile();
        else if (event.state.route === 'courses') Student.loadCourses();
        else Student.loadDashboard();
    } else {
        // কোনো স্টেট না থাকলে ড্যাশবোর্ড
        Student.loadDashboard();
        window.history.pushState({ route: 'dashboard' }, '');
    }
});
