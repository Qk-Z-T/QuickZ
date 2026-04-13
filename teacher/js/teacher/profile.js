// js/teacher/profile.js
// শিক্ষক প্রোফাইল ব্যবস্থাপনা

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ------------- প্রোফাইল ভিউ -------------
Teacher.viewProfile = function() {
    if (!AppState.currentUser) return;
    
    document.getElementById('app-container').innerHTML = `
    <div class="p-0 max-w-2xl">
        <button onclick="Router.teacher(AppState.currentPage)" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 bengali-text">
            <i class="fas fa-arrow-left"></i> ফিরে যান
        </button>
        
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-3">
                <div class="w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg">
                    <i class="fas fa-user-tie"></i>
                </div>
                <div>
                    <h2 class="text-xl font-bold dark:text-white bengali-text">আমার প্রোফাইল</h2>
                    <p class="text-xs text-slate-500 dark:text-slate-400 bengali-text">শিক্ষক অ্যাকাউন্ট</p>
                </div>
            </div>
            <button id="profile-edit-btn" onclick="Teacher.enableProfileEdit()" class="bg-slate-100 hover:bg-slate-200 dark:bg-dark-tertiary text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold transition bengali-text">
                <i class="fas fa-edit mr-1"></i> সম্পাদনা
            </button>
        </div>
        
        <div class="teacher-profile-form">
            <div class="mb-4">
                <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">পূর্ণ নাম</label>
                <input type="text" id="profile-fullname" class="w-full p-3 border border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 rounded-xl bengali-text" value="${AppState.currentUser.fullName || ''}" readonly>
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">ইমেইল <span class="text-[10px] text-red-500 ml-2 font-normal">(পরিবর্তনযোগ্য নয়)</span></label>
                <input type="email" id="profile-email" class="w-full p-3 border border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 rounded-xl" value="${AppState.currentUser.email}" readonly>
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">ফোন নম্বর</label>
                <input type="tel" id="profile-phone" class="w-full p-3 border border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 rounded-xl" value="${AppState.currentUser.phone || ''}" readonly>
            </div>
            
            <div class="mb-6">
                <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">শিক্ষক কোড</label>
                <div class="teacher-code-badge flex justify-between items-center">
                    <span>${AppState.currentUser.teacherCode}</span>
                    <button onclick="Teacher.copyTeacherCode()" class="text-white hover:text-slate-200">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 bengali-text">এই কোডটি শিক্ষার্থীদের সাথে শেয়ার করুন</p>
            </div>

            <button id="profile-save-btn" onclick="Teacher.saveProfile()" class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-bold hidden shadow-lg bengali-text">
                <i class="fas fa-save mr-2"></i> পরিবর্তন সংরক্ষণ
            </button>
        </div>
    </div>`;
};

Teacher.enableProfileEdit = function() {
    const inputs = ['profile-fullname', 'profile-phone'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.removeAttribute('readonly');
        el.classList.remove('bg-slate-50', 'dark:bg-black/50', 'text-slate-500', 'dark:text-slate-400');
        el.classList.add('bg-white', 'dark:bg-black', 'text-slate-800', 'dark:text-white', 'focus:border-emerald-500', 'focus:ring-2', 'focus:ring-emerald-200', 'dark:focus:ring-emerald-900', 'outline-none');
    });
    
    document.getElementById('profile-edit-btn').classList.add('hidden');
    document.getElementById('profile-save-btn').classList.remove('hidden');
    document.getElementById('profile-fullname').focus();
};

Teacher.copyTeacherCode = function() {
    navigator.clipboard.writeText(AppState.currentUser.teacherCode).then(() => {
        Swal.fire('কপি হয়েছে!', 'শিক্ষক কোড কপি করা হয়েছে', 'success');
    }).catch(() => {
        Swal.fire('ত্রুটি', 'কোড কপি করতে ব্যর্থ', 'error');
    });
};

Teacher.saveProfile = async function() {
    const fullName = document.getElementById('profile-fullname').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();

    if (!fullName || !phone) {
        Swal.fire('ত্রুটি', 'সব ঘর পূরণ করুন', 'error');
        return;
    }

    try {
        await updateDoc(doc(db, "teachers", AppState.currentUser.id), {
            fullName: fullName,
            phone: phone,
            updatedAt: new Date()
        });

        AppState.currentUser.fullName = fullName;
        AppState.currentUser.phone = phone;
        localStorage.setItem('teacher_data', JSON.stringify(AppState.currentUser));

        Swal.fire('সফল', 'প্রোফাইল আপডেট হয়েছে', 'success').then(() => {
            Teacher.viewProfile(); 
        });
    } catch (error) {
        Swal.fire('ত্রুটি', 'প্রোফাইল আপডেট ব্যর্থ: ' + error.message, 'error');
    }
};

Teacher.changePassword = async function() {
    const { value: formValues } = await Swal.fire({
        title: 'পাসওয়ার্ড পরিবর্তন',
        html:
            '<input id="swal-old" class="swal2-input" placeholder="বর্তমান পাসওয়ার্ড" type="password">' +
            '<input id="swal-new" class="swal2-input" placeholder="নতুন পাসওয়ার্ড" type="password">' +
            '<input id="swal-conf" class="swal2-input" placeholder="নতুন পাসওয়ার্ড নিশ্চিত করুন" type="password">',
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            return [
                document.getElementById('swal-old').value,
                document.getElementById('swal-new').value,
                document.getElementById('swal-conf').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass, confPass] = formValues;
        if(!oldPass || !newPass || !confPass) {
            Swal.fire('ত্রুটি', 'সব ঘর পূরণ করুন', 'error');
            return;
        }
        if(newPass !== confPass) {
            Swal.fire('ত্রুটি', 'নতুন পাসওয়ার্ড মিলছে না', 'error');
            return;
        }

        if (oldPass !== AppState.currentUser.password) {
            Swal.fire('ত্রুটি', 'বর্তমান পাসওয়ার্ড ভুল', 'error');
            return;
        }

        try {
            await updateDoc(doc(db, "teachers", AppState.currentUser.id), {
                password: newPass,
                updatedAt: new Date()
            });

            AppState.currentUser.password = newPass;
            localStorage.setItem('teacher_data', JSON.stringify(AppState.currentUser));

            Swal.fire('সফল', 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে', 'success');
        } catch (error) {
            Swal.fire('ত্রুটি', 'পাসওয়ার্ড পরিবর্তন ব্যর্থ: ' + error.message, 'error');
        }
    }
};

// স্টুডেন্ট প্রোফাইল এডিট (শিক্ষক কর্তৃক)
Teacher.viewStudentProfile = async (studentId, groupId) => {
    try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) return;
        const s = studentDoc.data();

        document.getElementById('app-container').innerHTML = `
        <div class="p-0 max-w-2xl">
            <button onclick="Teacher.viewGroupStudents('${groupId}')" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 bengali-text">
                <i class="fas fa-arrow-left"></i> কোর্সে ফিরুন
            </button>
            
            <div class="bg-white dark:bg-dark-secondary p-6 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-lg dark:text-white bengali-text">শিক্ষার্থীর তথ্য</h3>
                    <button id="student-edit-btn" onclick="Teacher.enableStudentEdit()" class="bg-slate-100 hover:bg-slate-200 dark:bg-dark-tertiary text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold transition bengali-text">
                        <i class="fas fa-edit mr-1"></i> পিতামাতার ফোন সম্পাদনা
                    </button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-xs font-bold dark:text-white bengali-text">পূর্ণ নাম</label>
                        <input class="w-full p-2 border rounded border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 bengali-text outline-none cursor-not-allowed" value="${s.fullName || s.name || ''}" readonly>
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold dark:text-white bengali-text">শিক্ষার্থীর ফোন</label>
                        <input class="w-full p-2 border rounded border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 bengali-text outline-none cursor-not-allowed" value="${s.phone || ''}" readonly>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-xs font-bold dark:text-white bengali-text text-indigo-600 dark:text-indigo-400">পিতার ফোন</label>
                            <input id="edit-s-fphone" class="w-full p-2 border rounded border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 bengali-text transition-all" value="${s.fatherPhone || ''}" readonly>
                        </div>
                        <div>
                            <label class="text-xs font-bold dark:text-white bengali-text text-indigo-600 dark:text-indigo-400">মাতার ফোন</label>
                            <input id="edit-s-mphone" class="w-full p-2 border rounded border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 bengali-text transition-all" value="${s.motherPhone || ''}" readonly>
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold dark:text-white bengali-text">স্কুলের নাম</label>
                        <input class="w-full p-2 border rounded border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 bengali-text outline-none cursor-not-allowed" value="${s.schoolName || ''}" readonly>
                    </div>
                    
                    <div>
                        <label class="text-xs font-bold dark:text-white bengali-text">কলেজের নাম</label>
                        <input class="w-full p-2 border rounded border-slate-200 dark:border-dark-tertiary bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 bengali-text outline-none cursor-not-allowed" value="${s.collegeName || ''}" readonly>
                    </div>
                    
                    <button id="student-save-btn" onclick="Teacher.updateStudentProfileByTeacher('${studentId}', '${groupId}')" class="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold mt-4 bengali-text hidden shadow-lg transform transition active:scale-95">পরিবর্তন সংরক্ষণ</button>
                </div>
            </div>
        </div>`;
    } catch (e) { 
        console.error(e);
        Swal.fire('ত্রুটি', 'শিক্ষার্থীর প্রোফাইল লোড করতে ব্যর্থ', 'error');
    }
};

Teacher.enableStudentEdit = function() {
    const inputs = ['edit-s-fphone', 'edit-s-mphone'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.removeAttribute('readonly');
        el.classList.remove('bg-slate-50', 'dark:bg-black/50', 'text-slate-500', 'dark:text-slate-400');
        el.classList.add('bg-white', 'dark:bg-black', 'text-slate-800', 'dark:text-white', 'focus:border-indigo-500', 'focus:ring-2', 'focus:ring-indigo-200', 'dark:focus:ring-indigo-900', 'outline-none');
    });
    
    document.getElementById('student-edit-btn').classList.add('hidden');
    document.getElementById('student-save-btn').classList.remove('hidden');
    document.getElementById('edit-s-fphone').focus();
};

Teacher.updateStudentProfileByTeacher = async (studentId, groupId) => {
    const updateData = {
        fatherPhone: document.getElementById('edit-s-fphone').value,
        motherPhone: document.getElementById('edit-s-mphone').value,
        updatedAt: new Date()
    };
    
    try {
        await updateDoc(doc(db, "students", studentId), updateData);
        Swal.fire('সফল', 'পিতামাতার ফোন নম্বর আপডেট হয়েছে', 'success');
        Teacher.viewStudentProfile(studentId, groupId);
    } catch (e) { 
        Swal.fire('ত্রুটি', e.message, 'error'); 
    }
};
