
// js/features/auth.js
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export const AuthUI = {
    togglePass: (id, el) => {
        const i = document.getElementById(id);
        if(i.type === 'password') { i.type = 'text'; el.classList.remove('fa-eye'); el.classList.add('fa-eye-slash'); }
        else { i.type = 'password'; el.classList.remove('fa-eye-slash'); el.classList.add('fa-eye'); }
    },
    showLoginLoading: (btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) { btn.classList.add('loading'); btn.disabled = true; }
    },
    hideLoginLoading: (btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
    }
};

export const Auth = {
    teacherLogin: async () => {
        AuthUI.showLoginLoading('teacher-login-btn');
        const email = document.getElementById('t-email').value.trim();
        const password = document.getElementById('t-pass').value.trim();
        
        if (!email || !password) {
            AuthUI.hideLoginLoading('teacher-login-btn');
            Swal.fire('Error', 'Please enter email and password', 'error');
            return;
        }
        
        try {
            const teachersQuery = query(collection(db, "teachers"), where("email", "==", email));
            const querySnapshot = await getDocs(teachersQuery);
            
            if (querySnapshot.empty) {
                AuthUI.hideLoginLoading('teacher-login-btn');
                Swal.fire('Error', 'Teacher not found', 'error');
                return;
            }
            
            let teacherFound = false;
            let teacherData = null;
            let teacherId = null;
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.password === password) {
                    teacherFound = true;
                    teacherData = data;
                    teacherId = doc.id;
                }
            });
            
            if (teacherFound) {
                if (teacherData.disabled) {
                    AuthUI.hideLoginLoading('teacher-login-btn');
                    Swal.fire('Account Disabled', 'Your account has been disabled by admin. Please contact administrator.', 'error');
                    return;
                }
                
                AppState.role = 'teacher';
                AppState.currentUser = { id: teacherId, ...teacherData };
                AuthUI.hideLoginLoading('teacher-login-btn');
                Auth.finalizeTeacher();
            } else {
                AuthUI.hideLoginLoading('teacher-login-btn');
                Swal.fire('Error', 'Invalid email or password', 'error');
            }
        } catch(e) { 
            AuthUI.hideLoginLoading('teacher-login-btn');
            Swal.fire('Error', 'Connection Error: ' + e.message, 'error'); 
        }
    },
    
    finalizeTeacher: () => {
        // ✅ ফাস্ট বুটের জন্য ফ্ল্যাগ রিসেট করুন
        localStorage.setItem('explicit_logout', 'false'); 

        localStorage.setItem('teacher_sess','true'); 
        localStorage.setItem('teacher_email', AppState.currentUser.email);
        localStorage.setItem('teacher_data', JSON.stringify(AppState.currentUser));
        
        // এখন শুধু fullName ও phone চেক করব, teacherCode আর চেক করব না
        if (!AppState.currentUser.fullName || !AppState.currentUser.phone) {
            if (window.Router && typeof window.Router.showTeacherProfileForm === 'function') {
                window.Router.showTeacherProfileForm();
            } else {
                console.warn('Router not loaded yet, cannot show profile form.');
            }
        } else {
            if (window.Router && typeof window.Router.initTeacher === 'function') {
                window.Router.initTeacher();
            }
        }
    },
    
    reloadTeacherSession: async () => {
        const storedData = localStorage.getItem('teacher_data');
        if (!storedData) {
            document.getElementById('auth-screen').classList.add('show');
            return;
        }
        
        try {
            const teacherData = JSON.parse(storedData);
            const docRef = doc(db, "teachers", teacherData.id);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                AppState.role = 'teacher';
                AppState.currentUser = { id: docSnap.id, ...docSnap.data() };
                
                if (!AppState.currentUser.fullName || !AppState.currentUser.phone) {
                    if (window.Router && typeof window.Router.showTeacherProfileForm === 'function') {
                        window.Router.showTeacherProfileForm();
                    }
                    return;
                }
                
                const lastGroupId = localStorage.getItem('selectedGroup');
                if (lastGroupId && lastGroupId !== 'undefined') {
                    AppState.selectedGroup = JSON.parse(lastGroupId);
                }
                
                if (typeof window.initRealTimeSync === 'function') {
                    window.initRealTimeSync();
                }
                if (window.Router && typeof window.Router.initTeacher === 'function') {
                    window.Router.initTeacher();
                }
            } else {
                Auth.logout();
            }
        } catch (e) {
            console.error("Session Error:", e);
            Auth.logout();
        }
    },
    
    confirmLogout: async () => { 
        // teacherCode আর লাগবে না, তাই সরাসরি লগআউট কনফার্মেশন
        const result = await Swal.fire({
            title: 'Confirm Logout',
            text: "Are you sure you want to logout?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, logout',
            confirmButtonColor: '#ef4444'
        });
        
        if (result.isConfirmed) {
            Auth.logout();
        }
    },
    
    logout: async () => { 
        // ✅ নিজে লগআউট বাটনে ক্লিক করেছে তা সিস্টেমকে বুঝিয়ে দেওয়া হচ্ছে
        localStorage.setItem('explicit_logout', 'true'); 

        if (typeof window.clearListeners === 'function') {
            window.clearListeners();
        }
        
        // সব লোকাল ডেটা ক্লিয়ার
        localStorage.removeItem('teacher_sess');
        localStorage.removeItem('teacher_email');
        localStorage.removeItem('teacher_data');
        localStorage.removeItem('selectedGroup');
        localStorage.removeItem('folderStructure');
        
        AppState.role = null;
        AppState.currentUser = null;
        AppState.selectedGroup = null;
        
        // Firebase Session Clear
        import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js").then(({ getAuth, signOut }) => {
            const auth = getAuth();
            signOut(auth).then(() => {
                location.reload();
            });
        }).catch(() => {
            // যদি অফলাইনে থাকে, তবুও রিলোড নেবে
            location.reload();
        });
    }
};

// Expose globally
window.AuthUI = AuthUI;
window.Auth = Auth;
