// js/router.js

import { auth, db } from './config.js';
import { AppState, clearListeners, refreshExamCache, renderHeader } from './state.js';
import { Student } from './student.js';
import { renderRankSkeleton, renderAnalysisSkeleton, renderProfileSkeleton, renderManagementSkeleton } from './ui.js';

function renderPage(pageId, contentCallback) {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;
    
    appContainer.innerHTML = renderHeader(pageId);
    
    const pageContent = document.getElementById('page-content');
    if (pageContent && contentCallback) {
        contentCallback(pageContent);
    }
    appContainer.classList.remove('hidden');
}

export const Router = {
    initStudent: () => {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        
        refreshExamCache();
        renderPage('dashboard', (contentEl) => {
            contentEl.innerHTML = `<div class="p-10 text-center"><div class="loader mx-auto"></div></div>`;
            Student.loadDashboard();
        });
        Student.initNotificationListener();
        
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
        
        renderPage('profile', (contentEl) => {
            // Profile Form Code... (একই আছে)
            contentEl.innerHTML = `
                <div class="p-5 max-w-md mx-auto">
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl mb-3 mx-auto">
                            <i class="fas fa-user-graduate"></i>
                        </div>
                        <h2 class="text-xl font-bold">Complete Your Profile</h2>
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
                                <label class="form-label">College/University Name</label>
                                <input type="text" id="college-name" class="form-input" placeholder="Enter college/university name">
                            </div>
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
                            </div>
                            <button type="button" onclick="Student.saveProfile()" class="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-3 rounded-xl font-bold mt-4">
                                Save Profile & Continue
                            </button>
                        </form>
                    </div>
                </div>
            `;
            
            const classSelect = document.getElementById('class-level');
            const streamGroup = document.getElementById('admission-stream-group');
            if (classSelect) {
                classSelect.addEventListener('change', function() {
                    streamGroup.style.display = this.value === 'Admission' ? 'block' : 'none';
                });
            }
        });
        
        window.history.pushState({ route: 'profile' }, '');
    },
    
    student: (p) => {
        window.currentRouteId = (window.currentRouteId || 0) + 1;
        
        clearListeners();
        
        // Fix 1: প্রোফাইল পেজে যাওয়ার অনুমতি দিন যদি প্রোফাইল অসম্পূর্ণ থাকে
        if (!AppState.profileCompleted && p !== 'profile') {
            Swal.fire('প্রোফাইল প্রয়োজন', 'প্রথমে প্রোফাইল সম্পূর্ণ করুন', 'warning').then(() => {
                Router.showProfileForm();
            });
            return;
        }
        
        // Fix 2: ম্যানেজমেন্ট পেজে যাওয়ার অনুমতি দিন যদি টিচার কোড না থাকে
        if (AppState.teacherCodes.length === 0 && p !== 'profile' && p !== 'management') {
            Swal.fire('শিক্ষক কোড প্রয়োজন', 'অন্তত একটি শিক্ষক কোড যোগ করুন', 'warning').then(() => {
                Router.student('management');
            });
            return;
        }
        
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
            Swal.fire('প্রবেশাধিকার নেই', 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়।', 'warning').then(() => {
                Router.student('profile');
            });
            return;
        }
        
        // Page Routing Logic
        if (p === 'profile') {
            renderPage('profile', (contentEl) => {
                contentEl.innerHTML = renderProfileSkeleton ? renderProfileSkeleton() : '<div class="loader mx-auto"></div>';
                setTimeout(() => Student.profile(), 100);
            });
            window.history.pushState({ route: 'profile' }, '');
        } else if (p === 'dashboard') {
            renderPage('dashboard', (contentEl) => {
                contentEl.innerHTML = `<div class="p-10 text-center"><div class="loader mx-auto"></div></div>`;
                Student.loadDashboard();
            });
            window.history.pushState({ route: 'dashboard' }, '');
        } else if (p === 'courses') {
            renderPage('courses', (contentEl) => {
                contentEl.innerHTML = `<div class="p-10 text-center"><div class="loader mx-auto"></div></div>`;
                Student.loadCourses();
            });
            window.history.pushState({ route: 'courses' }, '');
        } else if (p === 'rank') {
            renderPage('rank', (contentEl) => {
                contentEl.innerHTML = renderRankSkeleton ? renderRankSkeleton() : '<div class="loader mx-auto"></div>';
                setTimeout(() => Student.loadRankings(), 100);
            });
            window.history.pushState({ route: 'rank' }, '');
        } else if (p === 'results') {
            renderPage('results', (contentEl) => {
                contentEl.innerHTML = `<div class="p-10 text-center"><div class="loader mx-auto"></div></div>`;
                Student.loadResults();
            });
            window.history.pushState({ route: 'results' }, '');
        } else if (p === 'analysis') {
            renderPage('analysis', (contentEl) => {
                contentEl.innerHTML = renderAnalysisSkeleton ? renderAnalysisSkeleton() : '<div class="loader mx-auto"></div>';
                setTimeout(() => Student.loadAnalysis(), 100);
            });
            window.history.pushState({ route: 'analysis' }, '');
        } else if (p === 'notices') {
            renderPage('notices', (contentEl) => {
                contentEl.innerHTML = `<div class="p-10 text-center"><div class="loader mx-auto"></div></div>`;
                Student.loadNotices();
            });
            window.history.pushState({ route: 'notices' }, '');
        } else if (p === 'management') {
            renderPage('management', (contentEl) => {
                contentEl.innerHTML = renderManagementSkeleton ? renderManagementSkeleton() : '<div class="loader mx-auto"></div>';
                setTimeout(() => Student.loadManagement(), 100);
            });
            window.history.pushState({ route: 'management' }, '');
        }
    }
};

window.Router = Router;

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.route) {
        Router.student(event.state.route);
    } else {
        Router.student('dashboard');
    }
});
