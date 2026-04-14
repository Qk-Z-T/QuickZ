// js/app.js
// Main application entry point

import { auth, db } from './config.js';
import { AppState, ThemeManager, refreshExamCache } from './state.js';
import { Auth, AuthUI } from './auth.js';
import { Router } from './router.js';
import { Student } from './student.js';
import { Exam } from './exam.js';
import { OfflineManager } from './offline.js';

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Make modules globally available for onclick handlers
window.AppState = AppState;
window.Auth = Auth;
window.AuthUI = AuthUI;
window.Router = Router;
window.Student = Student;
window.Exam = Exam;
window.OfflineManager = OfflineManager;
window.ThemeManager = ThemeManager;

// Review panel button click handler
document.getElementById('review-panel-btn').addEventListener('click', function() {
    document.getElementById('review-panel').classList.toggle('show');
});

// Close review panel when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('#review-panel') && !e.target.closest('#review-panel-btn')) {
        document.getElementById('review-panel').classList.remove('show');
    }
});

// Global error handler
window.addEventListener('unhandledrejection', function(event) {
    console.error(event.reason);
});

// Check if user was logged in from localStorage
const cachedUserLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
if (cachedUserLoggedIn) {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

// Auth state observer
onAuthStateChanged(auth, async (u) => {
    if (!u) { 
        AuthUI.showAuthScreen();
        document.getElementById('splash-screen').classList.add('hidden');
        localStorage.removeItem('userLoggedIn');
        return;
    }
    
    try {
        // ১. সর্বপ্রথম Firebase থেকে সর্বশেষ ডেটা আনার চেষ্টা করব
        const userDocRef = doc(db, "students", u.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let userData = null;
        if (userDocSnap.exists()) {
            userData = userDocSnap.data();
            // Firebase ডেটাকে লোকাল ক্যাশে আপডেট করে দিই
            localStorage.setItem('userProfile', JSON.stringify(userData));
        } else {
            // যদি ডকুমেন্ট না থাকে, তাহলে ক্যাশে পড়ে দেখি (নতুন অ্যাকাউন্টের জন্য)
            const cached = localStorage.getItem('userProfile');
            if (cached) {
                userData = JSON.parse(cached);
            } else {
                // একেবারে নতুন ইউজার — ডকুমেন্ট তৈরি
                userData = {
                    uid: u.uid,
                    email: u.email,
                    name: "",
                    phone: "",
                    fatherPhone: "",
                    motherPhone: "",
                    schoolName: "",
                    collegeName: "",
                    teacherCodes: [],
                    groupCode: "",
                    joinedGroups: [],
                    profileCompleted: false,
                    blocked: false,
                    disabled: false,
                    joined: new Date()
                };
                await setDoc(userDocRef, userData);
                localStorage.setItem('userProfile', JSON.stringify(userData));
            }
        }
        
        // ২. ব্লক চেক
        if (userData.blocked) {
            await signOut(auth);
            Swal.fire('ব্লক', 'আপনার অ্যাকাউন্ট ব্লক করা আছে।', 'error');
            AuthUI.showAuthScreen();
            document.getElementById('splash-screen').classList.add('hidden');
            return;
        }
        
        // ৩. AppState আপডেট
        AppState.user = u;
        AppState.userDisabled = userData.disabled || false;
        AppState.profileCompleted = userData.profileCompleted || false;
        AppState.userProfile = userData;
        AppState.teacherCodes = userData.teacherCodes || [];
        AppState.activeTeacherCode = AppState.teacherCodes.find(tc => tc.active)?.code || null;
        AppState.joinedGroups = userData.joinedGroups || [];
        
        // ৪. activeGroupId রিস্টোর
        const storedGroupId = localStorage.getItem('activeGroupId');
        if (storedGroupId && AppState.joinedGroups.find(g => g.groupId === storedGroupId)) {
            AppState.activeGroupId = storedGroupId;
        } else if (AppState.joinedGroups.length > 0) {
            AppState.activeGroupId = AppState.joinedGroups[0].groupId;
            localStorage.setItem('activeGroupId', AppState.activeGroupId);
        } else {
            AppState.activeGroupId = null;
        }
        
        // ৫. শিক্ষকের নাম লোড
        if (AppState.teacherCodes.length > 0) {
            await Student.loadTeacherNames();
        }
        
        // ৬. সঠিক স্ক্রিন দেখানো
        if (!AppState.profileCompleted) {
            Router.showProfileForm();
        } else {
            Router.initStudent();
        }
        
    } catch (error) {
        console.error('Auth state error:', error);
        // কোনো কারণে ব্যর্থ হলে ক্যাশে থেকে পড়ার চেষ্টা
        const cached = localStorage.getItem('userProfile');
        if (cached) {
            const userData = JSON.parse(cached);
            if (!userData.blocked) {
                AppState.user = u;
                AppState.userDisabled = userData.disabled || false;
                AppState.profileCompleted = userData.profileCompleted || false;
                AppState.userProfile = userData;
                AppState.teacherCodes = userData.teacherCodes || [];
                AppState.activeTeacherCode = AppState.teacherCodes.find(tc => tc.active)?.code || null;
                AppState.joinedGroups = userData.joinedGroups || [];
                
                const storedGroupId = localStorage.getItem('activeGroupId');
                if (storedGroupId && AppState.joinedGroups.find(g => g.groupId === storedGroupId)) {
                    AppState.activeGroupId = storedGroupId;
                } else if (AppState.joinedGroups.length > 0) {
                    AppState.activeGroupId = AppState.joinedGroups[0].groupId;
                    localStorage.setItem('activeGroupId', AppState.activeGroupId);
                }
                
                if (AppState.teacherCodes.length > 0) await Student.loadTeacherNames();
                
                if (!AppState.profileCompleted) Router.showProfileForm();
                else Router.initStudent();
                document.getElementById('splash-screen').classList.add('hidden');
                return;
            }
        }
        AuthUI.showAuthScreen();
    }
    
    document.getElementById('splash-screen').classList.add('hidden');
});

// Initialize theme and offline manager on load
window.addEventListener('load', () => {
    ThemeManager.loadTheme();
    setTimeout(() => OfflineManager.init(), 1000);
    setTimeout(() => {
        if (!document.getElementById('splash-screen').classList.contains('hidden')) {
            document.getElementById('splash-screen').classList.add('hidden');
            AuthUI.showAuthScreen();
        }
    }, 3000);
});
