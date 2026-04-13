// js/auth.js
// Authentication module

import { auth, db } from './config.js';
import { AppState } from './state.js';
import { Router } from './router.js';
import { Student } from './student.js';

import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export const AuthUI = {
    togglePass: (id, el) => {
        const i = document.getElementById(id);
        if(i.type === 'password') { 
            i.type = 'text'; 
            el.classList.remove('fa-eye'); 
            el.classList.add('fa-eye-slash'); 
        } else { 
            i.type = 'password'; 
            el.classList.remove('fa-eye-slash'); 
            el.classList.add('fa-eye'); 
        }
    },
    showLoginLoading: (btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.add('loading');
            btn.disabled = true;
            const loaderContainer = btn.querySelector('.loader-container');
            if (loaderContainer) loaderContainer.classList.remove('hidden');
        }
    },
    hideLoginLoading: (btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
            const loaderContainer = btn.querySelector('.loader-container');
            if (loaderContainer) loaderContainer.classList.add('hidden');
        }
    },
    showSignupForm: () => {
        document.getElementById('signup-modal').classList.remove('hidden');
    },
    closeSignupForm: () => {
        document.getElementById('signup-modal').classList.add('hidden');
    },
    showAuthScreen: () => {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    },
    hideAuthScreen: () => {
        document.getElementById('auth-screen').classList.add('hidden');
    }
};
window.AuthUI = AuthUI;

export const Auth = {
    studentLogin: async () => {
        AuthUI.showLoginLoading('student-login-btn');
        try {
            const email = document.getElementById('s-email').value;
            const password = document.getElementById('s-pass').value;
            
            if (!email || !password) {
                Swal.fire('ত্রুটি', 'ইমেইল ও পাসওয়ার্ড দিন', 'error');
                AuthUI.hideLoginLoading('student-login-btn');
                return;
            }
            
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, "students", cred.user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                if (userData.blocked) {
                    await signOut(auth);
                    Swal.fire('অবরুদ্ধ', 'আপনার অ্যাকাউন্ট ব্লক করা হয়েছে।', 'error');
                    AuthUI.hideLoginLoading('student-login-btn');
                    return;
                }
                
                if (userData.disabled) AppState.userDisabled = true;
                
                AppState.profileCompleted = userData.profileCompleted || false;
                AppState.userProfile = userData;
                
                localStorage.setItem('userProfile', JSON.stringify(userData));
                localStorage.setItem('userLoggedIn', 'true');
                
                let teacherCodes = userData.teacherCodes || [];
                if (teacherCodes.length > 0 && typeof teacherCodes[0] === 'string') {
                    teacherCodes = teacherCodes.map(code => ({ code, active: false }));
                    if (teacherCodes.length > 0) teacherCodes[0].active = true;
                    await updateDoc(doc(db, "students", cred.user.uid), { teacherCodes });
                }
                
                AppState.teacherCodes = teacherCodes;
                AppState.activeTeacherCode = teacherCodes.find(tc => tc.active)?.code || null;
                AppState.groupCode = userData.groupCode || null;
                AppState.hasGroupCode = !!userData.groupCode;
                AppState.joinedGroups = userData.joinedGroups || [];
                
                if (!AppState.activeGroupId && AppState.joinedGroups.length > 0) {
                    AppState.activeGroupId = AppState.joinedGroups[0].groupId;
                    localStorage.setItem('activeGroupId', AppState.activeGroupId);
                }
                
                if (AppState.teacherCodes.length > 0) {
                    await Student.loadTeacherNames();
                }
                
                if (!AppState.profileCompleted) {
                    Router.showProfileForm();
                } else {
                    Router.initStudent();
                }
                
                AuthUI.hideLoginLoading('student-login-btn');
            } else {
                await setDoc(doc(db, "students", cred.user.uid), {
                    uid: cred.user.uid,
                    email: email,
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
                });
                
                AppState.profileCompleted = false;
                Router.showProfileForm();
                AuthUI.hideLoginLoading('student-login-btn');
            }
        } catch(e) { 
            console.error(e);
            Swal.fire('ত্রুটি', 'লগইন করা সম্ভব হয়নি। আবার চেষ্টা করুন।', 'error'); 
            AuthUI.hideLoginLoading('student-login-btn');
        }
    },
    
    studentSignup: async () => {
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value.trim();
        const confirmPassword = document.getElementById('signup-confirm').value.trim();
        
        if (!email || !password || !confirmPassword) {
            Swal.fire('ত্রুটি', 'সব তথ্য পূরণ করুন', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            Swal.fire('ত্রুটি', 'পাসওয়ার্ড মিলছে না', 'error');
            return;
        }
        
        if (password.length < 6) {
            Swal.fire('ত্রুটি', 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে', 'error');
            return;
        }
        
        try {
            const studentsQuery = query(collection(db, "students"), where("email", "==", email));
            const querySnapshot = await getDocs(studentsQuery);
            
            if (!querySnapshot.empty) {
                Swal.fire('ত্রুটি', 'ইমেইল আগে থেকেই আছে। লগইন করুন।', 'error');
                return;
            }
            
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            
            await setDoc(doc(db, "students", cred.user.uid), {
                uid: cred.user.uid,
                email: email,
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
            });
            
            AuthUI.closeSignupForm();
            Swal.fire('সফল', 'অ্যাকাউন্ট তৈরি হয়েছে! প্রোফাইল সম্পূর্ণ করুন।', 'success').then(() => {
                Router.showProfileForm();
            });
        } catch(e) { 
            console.error(e);
            Swal.fire('ত্রুটি', 'অ্যাকাউন্ট তৈরি ব্যর্থ। আবার চেষ্টা করুন।', 'error'); 
        }
    },
    
    confirmLogout: () => { 
        Swal.fire({ 
            title: 'লগআউট?', 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonText: 'হ্যাঁ', 
            confirmButtonColor: '#ef4444' 
        }).then((r)=>{if(r.isConfirmed) Auth.logout()}) 
    },
    
    logout: async () => { 
        import('./state.js').then(({ clearListeners }) => {
            clearListeners(); 
        });
        await signOut(auth);
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('userProfile');
        location.reload();
    }
};
window.Auth = Auth;
