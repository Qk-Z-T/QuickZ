// js/teacher-core.js
// শিক্ষক সংক্রান্ত সমস্ত ব্যবসায়িক লজিক এবং ফায়ারস্টোর ইন্টারঅ্যাকশন

import { db } from './config/firebase.js';
import { AppState } from './core/state.js';
import { autoResizeTextarea } from './core/utils.js';
import { 
    collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, 
    query, where, orderBy, onSnapshot, writeBatch, setDoc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// গ্লোবাল ভেরিয়েবল রেফারেন্স (উইন্ডো থেকে অ্যাক্সেস করা)
let unsubscribes = window.unsubscribes;
let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

// হেল্পার ফাংশন: ফোল্ডার স্ট্রাকচার ফায়ারবেসে সংরক্ষণ
export async function saveFolderStructureToFirebase() {
    if (!AppState.currentUser || !AppState.selectedGroup) return;
    try {
        const folderDocRef = doc(db, "folderStructures", `${AppState.currentUser.id}_${AppState.selectedGroup.id}`);
        await setDoc(folderDocRef, {
            ...folderStructure,
            updatedAt: new Date()
        }, { merge: true });
    } catch (error) {
        console.error("Folder Sync Error:", error);
    }
}

// রিয়েল-টাইম সিঙ্ক ইনিশিয়ালাইজ
export function initRealTimeSync() {
    if (!AppState.selectedGroup || !AppState.currentUser) return;
    
    clearListeners();
    
    const folderDocRef = doc(db, "folderStructures", `${AppState.currentUser.id}_${AppState.selectedGroup.id}`);
    const unsubFolders = onSnapshot(folderDocRef, (docSnap) => {
        if (docSnap.exists()) {
            folderStructure = docSnap.data();
        } else {
            folderStructure = { live: [], mock: [], uncategorized: [] };
        }
        window.folderStructure = folderStructure;
        updateUIRendering();
    });
    unsubscribes.push(unsubFolders);
    
    const q = query(
        collection(db, "exams"),
        where("groupId", "==", AppState.selectedGroup.id)
    );
    const unsubExams = onSnapshot(q, (snap) => {
        ExamCache = {};
        snap.forEach(d => {
            ExamCache[d.id] = { id: d.id, ...d.data() };
        });
        window.ExamCache = ExamCache;
        updateUIRendering();
    });
    unsubscribes.push(unsubExams);
}

export function clearListeners() {
    unsubscribes.forEach(u => u());
    unsubscribes = [];
    window.unsubscribes = unsubscribes;
}

// UI আপডেট হেল্পার
function updateUIRendering() {
    const container = document.getElementById('app-container');
    if (!container) return;
    
    if (container.innerHTML.includes('লাইব্রেরি ব্যবস্থাপনা')) {
        Teacher.renderFolderTree();
        Teacher.renderUncategorizedExams();
    }
    if (container.innerHTML.includes('লাইভ পরীক্ষার র‍্যাংকিং')) {
        Teacher.rankView();
    }
    if (container.innerHTML.includes('লাইভ পরীক্ষা ব্যবস্থাপনা')) {
        Teacher.liveExamManagementView();
    }
    if (container.innerHTML.includes('ড্যাশবোর্ড হোম')) {
        Teacher.homeView();
    }
}

// টিচার অবজেক্ট
export const Teacher = {
    questions: [],
    currentQuestion: null,
    selectedFolder: null,
    teacherGroups: [],
    topScorerId: null,
    topAccuracyId: null,
    
    // মোবাইল সাইডবার কন্ট্রোল
    toggleMobileSidebar: function() {
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if (sidebar) sidebar.classList.toggle('mobile-open');
        if (overlay) overlay.classList.toggle('show');
    },
    
    closeMobileSidebar: function() {
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('show');
    },
    
    // গ্রুপ সুইচার
    toggleGroupSwitcher: function() {
        const dropdown = document.getElementById('group-switcher-dropdown');
        if (dropdown) dropdown.classList.toggle('show');
    },
    
    copyGroupCode: function(groupCode) {
        navigator.clipboard.writeText(groupCode).then(() => {
            Swal.fire('কপি হয়েছে!', 'কোর্স কোড ক্লিপবোর্ডে কপি করা হয়েছে', 'success');
        }).catch(err => {
            Swal.fire('ত্রুটি', 'কোড কপি করতে ব্যর্থ', 'error');
        });
    },
    
    loadGroupsForSwitcher: async function() {
        try {
            const groupsQuery = query(collection(db, "groups"), 
                where("teacherId", "==", AppState.currentUser.id),
                where("archived", "==", false),
                orderBy("createdAt", "desc"));
            const groupsSnap = await getDocs(groupsQuery);
            
            const groups = [];
            groupsSnap.forEach(doc => {
                groups.push({ id: doc.id, ...doc.data() });
            });
            
            Teacher.teacherGroups = groups;
            
            if (!AppState.selectedGroup && groups.length > 0) {
                AppState.selectedGroup = { id: groups[0].id, name: groups[0].name };
                localStorage.setItem('selectedGroup', JSON.stringify(AppState.selectedGroup));
                initRealTimeSync();
            }

            if (AppState.selectedGroup) {
                const truncatedName = AppState.selectedGroup.name.length > 12 ? AppState.selectedGroup.name.substring(0, 12) + '...' : AppState.selectedGroup.name;
                document.getElementById('current-group-name').textContent = truncatedName;
            } else if (groups.length > 0) {
                document.getElementById('current-group-name').textContent = 'কোর্স নির্বাচন করুন';
            }
            
            const dropdown = document.getElementById('group-switcher-dropdown');
            if (dropdown) {
                if (groups.length === 0) {
                    dropdown.innerHTML = '<div class="p-3 text-sm text-slate-500 bengali-text">কোনো কোর্স পাওয়া যায়নি</div>';
                    return;
                }
                
                let html = '';
                groups.forEach(group => {
                    const isActive = AppState.selectedGroup && AppState.selectedGroup.id === group.id;
                    html += `
                        <div class="group-switcher-item ${isActive ? 'active' : ''}" 
                             onclick="Teacher.switchGroup('${group.id}', '${group.name.replace(/'/g, "\\'")}')">
                            <div class="font-medium bengali-text">${group.name}</div>
                            <div class="text-xs ${isActive ? 'text-indigo-100' : 'text-slate-500'} mt-1">
                                <div class="flex items-center justify-between">
                                    <span>${group.groupCode}</span>
                                    <button onclick="event.stopPropagation(); Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                        <i class="fas fa-copy text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                dropdown.innerHTML = html;
            }
        } catch (error) {
            console.error('সুইচারের জন্য কোর্স লোড করতে ত্রুটি:', error);
        }
    },
    
    switchGroup: async function(groupId, groupName) {
        AppState.selectedGroup = { id: groupId, name: groupName };
        localStorage.setItem('selectedGroup', JSON.stringify(AppState.selectedGroup));
        
        try {
            await updateDoc(doc(db, "teachers", AppState.currentUser.id), {
                lastGroupId: groupId,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('শেষ কোর্স সংরক্ষণে ত্রুটি:', error);
        }
        
        const truncatedName = groupName.length > 12 ? groupName.substring(0, 12) + '...' : groupName;
        document.getElementById('current-group-name').textContent = truncatedName;
        document.getElementById('group-switcher-dropdown').classList.remove('show');
        
        Swal.fire({
            icon: 'success',
            title: 'কোর্স পরিবর্তিত',
            text: `এখন দেখছেন: ${groupName}`,
            timer: 1500,
            showConfirmButton: false
        });
        
        initRealTimeSync();
        Router.teacher('home');
    },

    // পাসওয়ার্ড পরিবর্তন
    changePassword: async function() {
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
    },
    
    // প্রোফাইল ভিউ এবং এডিট
    viewProfile: function() {
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
    },

    enableProfileEdit: function() {
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
    },
    
    copyTeacherCode: function() {
        navigator.clipboard.writeText(AppState.currentUser.teacherCode).then(() => {
            Swal.fire('কপি হয়েছে!', 'শিক্ষক কোড কপি করা হয়েছে', 'success');
        }).catch(() => {
            Swal.fire('ত্রুটি', 'কোড কপি করতে ব্যর্থ', 'error');
        });
    },
    
    saveProfile: async function() {
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
    },

    // গ্রুপ সিলেক্ট ভিউ
    selectGroupView: async (page = 'home') => {
        try {
            const groupsQuery = query(collection(db, "groups"), 
                where("teacherId", "==", AppState.currentUser.id),
                where("archived", "==", false),
                orderBy("createdAt", "desc"));
            const groupsSnap = await getDocs(groupsQuery);
            
            const groups = [];
            groupsSnap.forEach(doc => {
                groups.push({ id: doc.id, ...doc.data() });
            });
            
            if (groups.length === 0) {
                document.getElementById('app-container').innerHTML = `
                    <div class="p-0 max-w-2xl">
                        <div class="text-center mb-6">
                            <div class="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl mb-3 mx-auto">
                                <i class="fas fa-book"></i>
                            </div>
                            <h2 class="text-xl font-bold dark:text-white bengali-text">কোনো কোর্স পাওয়া যায়নি</h2>
                            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 bengali-text">চালিয়ে যেতে আপনাকে প্রথমে একটি কোর্স তৈরি করতে হবে</p>
                        </div>
                        
                        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary space-y-4">
                            <div>
                                <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">কোর্সের নাম</label>
                                <input type="text" id="group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="যেমনঃ ক্লাস ১০ ব্যাচ-১">
                            </div>
                            
                            <button onclick="Teacher.createGroupFromInput()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg bengali-text">
                                কোর্স তৈরি করুন
                            </button>
                        </div>
                    </div>
                `;
                return;
            }
            
            let html = `
                <div class="p-5">
                    <h2 class="text-xl font-bold mb-6 font-en text-slate-800 dark:text-white bengali-text">একটি কোর্স নির্বাচন করুন</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 bengali-text">চালিয়ে যেতে একটি কোর্স নির্বাচন করুন। প্রতিটি কোর্সের আলাদা প্রশ্ন, শিক্ষার্থী এবং র‍্যাংকিং থাকবে।</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            `;
            
            groups.forEach(group => {
                html += `
                    <div class="group-card cursor-pointer" onclick="Teacher.setSelectedGroup('${group.id}', '${group.name.replace(/'/g, "\\'")}', '${page}')">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-bold text-lg dark:text-white bengali-text">${group.name}</h3>
                                <p class="text-xs text-slate-500 dark:text-slate-400 bengali-text">${group.studentIds ? group.studentIds.length : 0} জন শিক্ষার্থী</p>
                            </div>
                        </div>
                        <div class="group-code-container">
                            <span class="group-code-text">${group.groupCode}</span>
                            <button onclick="event.stopPropagation(); Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-3 bengali-text">
                            তৈরি: ${moment(group.createdAt?.toDate()).format('DD MMM YYYY')}
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    
                    <div class="mt-6 bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                        <h3 class="font-bold text-lg mb-4 dark:text-white bengali-text">নতুন কোর্স তৈরি</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">কোর্সের নাম</label>
                                <input type="text" id="group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="যেমনঃ ক্লাস ১০ ব্যাচ-১">
                            </div>
                            
                            <button onclick="Teacher.createGroupFromInput()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg bengali-text">
                                কোর্স তৈরি করুন
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('app-container').innerHTML = html;
        } catch (error) {
            console.error('কোর্স লোড করতে ত্রুটি:', error);
            document.getElementById('app-container').innerHTML = '<div class="text-center p-10 text-red-500 bengali-text">কোর্স লোড করতে ত্রুটি</div>';
        }
    },
    
    setSelectedGroup: (groupId, groupName, page) => {
        AppState.selectedGroup = { id: groupId, name: groupName };
        localStorage.setItem('selectedGroup', JSON.stringify(AppState.selectedGroup));
        Teacher.loadGroupsForSwitcher();
        initRealTimeSync();
        Router.teacher(page);
    },

    // ========== হোমপেজ ==========
    homeView: async () => {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('home');
            return;
        }

        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
        const c = document.getElementById('app-container');
        c.innerHTML = `
        <div class="pb-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">ড্যাশবোর্ড হোম</h2>
            </div>
            <div class="text-center p-10">
                <div class="loader mx-auto"></div>
                <p class="mt-2 text-sm text-slate-500 bengali-text">লোড হচ্ছে...</p>
            </div>
        </div>`;

        try {
            const groupDoc = await getDoc(doc(db, "groups", AppState.selectedGroup.id));
            let studentCount = 0;
            let groupCode = '';

            if (groupDoc.exists()) {
                const data = groupDoc.data();
                studentCount = data.studentIds ? data.studentIds.length : 0;
                groupCode = data.groupCode;
            }

            let pendingCount = 0;
            const reqQ = query(collection(db, "join_requests"), where("groupId", "==", AppState.selectedGroup.id), where("status", "==", "pending"));
            const reqSnap = await getDocs(reqQ);
            pendingCount = reqSnap.size;

            const examsQ = query(collection(db, "exams"), where("groupId", "==", AppState.selectedGroup.id));
            const examsSnap = await getDocs(examsQ);

            let liveExams = 0;
            let mockExams = 0;
            let activeLiveExam = null;
            const now = new Date();

            examsSnap.forEach(doc => {
                const ex = { id: doc.id, ...doc.data() };
                ExamCache[ex.id] = ex;

                if (ex.type === 'live') {
                    liveExams++;
                    if (!ex.isDraft && !ex.cancelled && !ex.resultPublished) {
                        const st = ex.startTime ? new Date(ex.startTime) : null;
                        const et = ex.endTime ? new Date(ex.endTime) : null;
                        if (st && et && now >= st && now <= et) {
                            activeLiveExam = ex;
                        }
                    }
                } else if (ex.type === 'mock') {
                    mockExams++;
                }
            });

            let html = `
            <div class="pb-6">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">ড্যাশবোর্ড হোম</h2>
                        <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text mt-1">${AppState.selectedGroup.name} এর সংক্ষিপ্ত বিবরণ</p>
                    </div>
                </div>
                <div id="home-active-live-section"></div>
                <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary shadow-sm mb-6 overflow-hidden">
                    <div class="p-5 border-b border-slate-100 dark:border-dark-tertiary flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/10">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-users"></i></div>
                            <div class="font-bold text-lg dark:text-white bengali-text">মোট শিক্ষার্থী</div>
                        </div>
                        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${studentCount}</div>
                    </div>
                    <div class="p-5 border-b border-slate-100 dark:border-dark-tertiary flex justify-between items-center hover:bg-slate-50 dark:hover:bg-dark-tertiary transition">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-broadcast-tower"></i></div>
                            <div class="font-bold text-lg dark:text-white bengali-text">মোট লাইভ পরীক্ষা</div>
                        </div>
                        <div class="text-2xl font-black text-red-600 dark:text-red-400">${liveExams}</div>
                    </div>
                    <div class="p-5 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-dark-tertiary transition">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-book-reader"></i></div>
                            <div class="font-bold text-lg dark:text-white bengali-text">মোট প্র্যাকটিস পরীক্ষা</div>
                        </div>
                        <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${mockExams}</div>
                    </div>
                </div>
                <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 shadow-lg text-white mb-6 relative overflow-hidden flex items-center justify-between">
                    <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 20px 20px;"></div>
                    
                    <div class="relative z-10">
                        <div class="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1 bengali-text">সক্রিয় কোর্স</div>
                        <h3 class="text-3xl font-bold bengali-text">${AppState.selectedGroup.name}</h3>
                        <div class="flex items-center gap-3 mt-3">
                            <span class="bg-white/20 px-3 py-1.5 rounded-lg text-sm font-mono tracking-wider font-bold">
                                কোড: ${groupCode}
                            </span>
                            <button onclick="Teacher.copyGroupCode('${groupCode}')" class="text-white/70 hover:text-white transition bg-white/10 w-8 h-8 rounded flex items-center justify-center">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        
                        <div class="flex gap-3 mt-6">
                            <button onclick="Teacher.viewGroupStudents('${AppState.selectedGroup.id}')" class="bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 transition shadow bengali-text">
                                <i class="fas fa-cog mr-2"></i> কোর্স ম্যানেজ
                            </button>
                            <button onclick="Teacher.noticeManagementView()" class="bg-indigo-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-900 transition shadow border border-indigo-500 bengali-text">
                                <i class="fas fa-bullhorn mr-2"></i> নোটিশ ও পোল
                            </button>
                        </div>
                    </div>

                    <div onclick="Teacher.viewGroupStudents('${AppState.selectedGroup.id}', 'pending')" class="relative z-10 cursor-pointer bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center justify-center w-28 h-28 hover:bg-white/20 transition transform hover:scale-105 shadow-xl">
                        <span class="text-4xl font-black text-amber-300 drop-shadow-md">${pendingCount}</span>
                        <span class="text-[10px] uppercase font-bold tracking-widest text-indigo-100 mt-1 bengali-text text-center">অপেক্ষমান<br>অনুরোধ</span>
                        ${pendingCount > 0 ? '<span class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping"></span><span class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full"></span>' : ''}
                    </div>
                </div>
            </div>`;
            c.innerHTML = html;

            if (activeLiveExam) {
                Teacher.renderActiveLiveExamOnHome(activeLiveExam.id);
            }

        } catch (e) {
            console.error(e);
            c.innerHTML = `<div class="text-center p-10 text-red-500 bengali-text">হোমপেজ লোড করতে ত্রুটি</div>`;
        }
    },

    renderActiveLiveExamOnHome: async (examId) => {
        const container = document.getElementById('home-active-live-section');
        if (!container) return;

        const ex = ExamCache[examId];
        if (!ex) return;

        const qAttempts = query(collection(db, "attempts"), where("examId", "==", examId));
        const attSnap = await getDocs(qAttempts);
        const totalSubmitted = attSnap.size;

        const endTimeStr = moment(ex.endTime).format('hh:mm A, DD MMM');

        container.innerHTML = `
        <div class="bg-white dark:bg-dark-secondary rounded-2xl border border-red-200 dark:border-red-900 shadow-md mb-6 overflow-hidden relative">
            <div class="bg-red-50 dark:bg-red-900/30 p-3 border-b border-red-100 dark:border-red-800 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                    <span class="font-bold text-red-600 dark:text-red-400 text-sm uppercase tracking-wider bengali-text">চলমান লাইভ পরীক্ষা</span>
                </div>
                <button onclick="Teacher.renderActiveLiveExamOnHome('${examId}')" class="text-red-500 hover:text-red-700 bg-white dark:bg-black rounded-full w-8 h-8 flex items-center justify-center shadow-sm transition">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-2xl font-bold dark:text-white bengali-text">${ex.title}</h3>
                        <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 bengali-text">
                            <i class="fas fa-book-open mr-1"></i> ${ex.subject ? ex.subject : 'কোনো বিষয় নেই'} 
                            ${ex.chapter ? '<i class="fas fa-angle-right mx-2 text-xs"></i> ' + ex.chapter : ''}
                        </p>
                    </div>
                    <div class="text-right bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-100 dark:border-red-800/50">
                        <div class="text-xs font-bold text-red-400 uppercase tracking-wider mb-1 bengali-text">শেষ হবে</div>
                        <div class="text-base font-bold text-red-600 dark:text-red-400"><i class="far fa-clock mr-1"></i> ${endTimeStr}</div>
                    </div>
                </div>
                
                <div class="flex items-center gap-4 bg-slate-50 dark:bg-dark-tertiary rounded-xl p-4 border dark:border-dark-tertiary w-fit mb-6">
                    <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl shadow-sm"><i class="fas fa-check-double"></i></div>
                    <div>
                        <div class="text-2xl font-black dark:text-white leading-none">${totalSubmitted}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mt-1 bengali-text">মোট জমা</div>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-dark-tertiary pt-5">
                    <button onclick="Teacher.stopLiveExam('${examId}')" class="bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-xl font-bold text-sm transition bengali-text flex items-center justify-center gap-2">
                        <i class="fas fa-ban"></i> বাতিল করুন
                    </button>
                    <button onclick="Teacher.extendExamTime('${examId}')" class="bg-amber-100 hover:bg-amber-200 text-amber-700 py-3 rounded-xl font-bold text-sm transition bengali-text flex items-center justify-center gap-2">
                        <i class="fas fa-clock"></i> সময় বাড়ান
                    </button>
                    <button onclick="Teacher.publish('${examId}')" class="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-md bengali-text flex items-center justify-center gap-2">
                        <i class="fas fa-bullhorn"></i> ফলাফল প্রকাশ
                    </button>
                </div>
            </div>
        </div>`;
    },
    
    extendExamTime: async (examId) => {
        const ex = ExamCache[examId];
        if (!ex) return;

        const { value: newEndTime } = await Swal.fire({
            title: 'পরীক্ষার সময় বাড়ান',
            html: `
                <p class="text-sm text-slate-500 mb-3 bengali-text">বর্তমান শেষ সময়: ${moment(ex.endTime).format('DD MMM, hh:mm A')}</p>
                <input id="swal-ext-time" type="datetime-local" class="swal2-input" value="${ex.endTime}">
            `,
            showCancelButton: true,
            confirmButtonText: 'সময় আপডেট',
            preConfirm: () => document.getElementById('swal-ext-time').value
        });

        if (newEndTime) {
            try {
                Swal.fire({title: 'আপডেট হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
                
                await updateDoc(doc(db, "exams", examId), {
                    endTime: newEndTime,
                    updatedAt: new Date()
                });
                
                ExamCache[examId].endTime = newEndTime;
                await Teacher.syncFolderExamData(examId, { endTime: newEndTime });
                
                Swal.fire('সফল', 'পরীক্ষার সময় বাড়ানো হয়েছে', 'success').then(() => {
                    if (AppState.currentPage === 'home') {
                        Teacher.renderActiveLiveExamOnHome(examId);
                    } else if (AppState.currentPage === 'management') {
                        Teacher.liveExamManagementView();
                    }
                });
            } catch (e) {
                Swal.fire('ত্রুটি', 'সময় বাড়াতে ব্যর্থ: ' + e.message, 'error');
            }
        }
    },

    // ========== পরীক্ষা তৈরি সংক্রান্ত ==========
    createView: () => {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('create');
            return;
        }
        
        Teacher.questions = [];
        Teacher.currentQuestion = null;
        
        document.getElementById('app-container').innerHTML = `
        <div class="pb-6 max-w-5xl">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">শিক্ষক ড্যাশবোর্ড</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text mt-1">পরীক্ষা তৈরি এবং পরিচালনা করুন</p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <button onclick="Teacher.renderForm('live')" class="h-44 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-6 relative overflow-hidden shadow-lg transition hover:shadow-xl hover:-translate-y-1 text-left group">
                    <div class="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4"><i class="fas fa-broadcast-tower text-2xl"></i></div>
                    <h3 class="text-xl font-bold bengali-text">লাইভ পরীক্ষা তৈরি</h3>
                    <p class="text-indigo-100 text-sm mt-1 bengali-text">নির্দিষ্ট সময়ের জন্য পরীক্ষা নির্ধারণ করুন।</p>
                    <i class="fas fa-arrow-right absolute right-6 bottom-6 opacity-40 group-hover:opacity-80 transition"></i>
                </button>
                <button onclick="Teacher.renderForm('mock')" class="h-44 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 relative overflow-hidden shadow-lg transition hover:shadow-xl hover:-translate-y-1 text-left group">
                    <div class="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4"><i class="fas fa-book-reader text-2xl"></i></div>
                    <h3 class="text-xl font-bold bengali-text">প্র্যাকটিস তৈরি</h3>
                    <p class="text-emerald-100 text-xs mt-1 bengali-text">বিষয় ও অধ্যায় ভিত্তিক মক টেস্ট।</p>
                    <i class="fas fa-pencil-alt absolute right-6 top-1/2 -translate-y-1/2 text-6xl opacity-20 group-hover:scale-110 transition"></i>
                </button>
            </div>
        </div>`;
        
        document.getElementById('floating-math-btn').classList.add('hidden');
    },

    renderForm: function(type) {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('create');
            return;
        }
        
        document.getElementById('floating-math-btn').classList.remove('hidden');
        
        Teacher.questions = [];
        Teacher.currentQuestion = null;
        
        const isLive = type === 'live';
        
        const getSubjectsForType = (type) => {
            return [...new Set(folderStructure[type].map(s => s.name))];
        };
        
        const subjects = getSubjectsForType(type);
        
        document.getElementById('app-container').innerHTML = `
        <div class="p-0 max-w-4xl">
            <div class="flex justify-between items-center mb-4">
                <button onclick="Teacher.createView()" class="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bengali-text">
                    <i class="fas fa-arrow-left"></i> ড্যাশবোর্ডে ফিরুন
                </button>
            </div>
            <h2 class="text-xl font-bold mb-4 font-en text-slate-800 dark:text-white bengali-text">${isLive ? 'লাইভ পরীক্ষা' : 'প্র্যাকটিস টেস্ট'} তৈরি করুন</h2>
            <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary space-y-4">
                <input id="nt" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="পরীক্ষার শিরোনাম">
                <input type="hidden" id="nty" value="${type}"> 
                
                <div class="grid grid-cols-2 gap-3">
                    <div class="select-container">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">বিষয়</label>
                        <select id="nsub" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" ${type === 'mock' ? 'required' : ''}>
                            <option value="">বিষয় নির্বাচন (ঐচ্ছিক)</option>
                            ${subjects.map(s => `<option value="${s}" class="bengali-text">${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="select-container">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">অধ্যায়</label>
                        <select id="nchap" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" ${type === 'mock' ? 'required' : ''}>
                            <option value="">অধ্যায় নির্বাচন (ঐচ্ছিক)</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">সময় (মিনিট)</label>
                        <input id="nd" type="number" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="যেমনঃ ৬০" required>
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">মোট নম্বর</label>
                        <input id="nm" type="number" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="যেমনঃ ১০০" required>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">নেগেটিভ মার্ক</label>
                        <select id="nneg" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text">
                            <option value="0" selected>০ (কোনো নেগেটিভ নয়)</option>
                            <option value="0.25">০.২৫ (¼ নম্বর)</option>
                            <option value="0.50">০.৫০ (½ নম্বর)</option>
                        </select>
                    </div>
                    <div class="flex items-center text-xs text-slate-500 bg-slate-50 dark:bg-dark-tertiary dark:text-slate-400 p-2 rounded border dark:border-dark-tertiary bengali-text">ধরণ: ${type.toUpperCase()}</div>
                </div>
                
                ${isLive ? `
                <div class="p-3 bg-indigo-50 dark:bg-indigo-900 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-3">
                    <div>
                        <label class="text-sm font-bold text-indigo-800 dark:text-indigo-300 bengali-text">শুরুর সময়</label>
                        <input id="nst" type="datetime-local" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-lg text-sm">
                    </div>
                    <div>
                        <label class="text-sm font-bold text-indigo-800 dark:text-indigo-300 bengali-text">শেষ সময়</label>
                        <input id="net" type="datetime-local" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-lg text-sm">
                    </div>
                    <div class="auto-publish-container">
                        <input type="checkbox" id="nautopub" checked>
                        <label for="nautopub" class="text-sm font-bold text-slate-700 dark:text-slate-300 bengali-text">
                            পরীক্ষা শেষে স্বয়ংক্রিয়ভাবে ফলাফল প্রকাশ করুন
                        </label>
                    </div>
                </div>` : ''}
                
                <div class="flex items-center justify-between mb-3">
                    <label class="text-sm font-bold text-slate-700 dark:text-white bengali-text">প্রশ্ন মোড:</label>
                    <div class="flex items-center gap-2">
                        <button id="mode-manual" onclick="Teacher.switchQuestionMode('manual')" class="px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg bengali-text">ম্যানুয়াল</button>
                        <button id="mode-json" onclick="Teacher.switchQuestionMode('json')" class="px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg bengali-text">JSON</button>
                    </div>
                </div>
                
                <div id="questions-list" class="space-y-3 mb-6">
                    <h3 class="font-bold text-lg mb-2 dark:text-white bengali-text">প্রশ্ন তালিকা (${Teacher.questions.length})</h3>
                    <div class="text-center p-4 text-slate-400 bengali-text">এখনো কোনো প্রশ্ন যোগ করা হয়নি</div>
                </div>
                
                <div id="manual-questions-container" class="space-y-4">
                    <div class="question-box dark:bg-black dark:border-dark-tertiary">
                        <h3 class="font-bold text-lg mb-3 dark:text-white bengali-text" id="question-form-title">নতুন প্রশ্ন যোগ করুন</h3>
                        
                        <div class="question-field-container mb-3">
                            <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">প্রশ্ন</label>
                            <textarea id="textarea-question" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl question-textarea auto-resize bengali-text" rows="3" placeholder="প্রশ্ন লিখুন..." oninput="autoResizeTextarea(this)"></textarea>
                            <button type="button" class="math-preview-btn" data-target="textarea-question">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-bold mb-2 dark:text-white bengali-text">অপশন:</label>
                            <div class="space-y-2">
                                ${['A', 'B', 'C', 'D'].map((letter, index) => `
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold w-6 dark:text-white">${letter}.</span>
                                        <div class="question-field-container flex-1">
                                            <textarea id="option-${letter.toLowerCase()}" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded option-textarea auto-resize bengali-text" rows="2" placeholder="অপশন ${letter}" oninput="autoResizeTextarea(this)"></textarea>
                                            <button type="button" class="math-preview-btn" data-target="option-${letter.toLowerCase()}">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">সঠিক উত্তর</label>
                            <select id="correct-answer" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded bengali-text">
                                <option value="">সঠিক উত্তর নির্বাচন করুন</option>
                                <option value="0">A</option>
                                <option value="1">B</option>
                                <option value="2">C</option>
                                <option value="3">D</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">ব্যাখ্যা (ঐচ্ছিক)</label>
                            <div class="question-field-container">
                                <textarea id="explanation" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded explanation-textarea auto-resize bengali-text" rows="2" placeholder="এই প্রশ্নের ব্যাখ্যা লিখুন..." oninput="autoResizeTextarea(this)"></textarea>
                                <button type="button" class="math-preview-btn" data-target="explanation">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">পূর্ববর্তী বছর (ঐচ্ছিক)</label>
                            <div class="flex items-center gap-2">
                                <input type="text" id="previous-year" class="flex-1 p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded bengali-text" placeholder="যেমনঃ ২০২০ এইচএসসি">
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="show-previous-year" class="rounded">
                                    <label for="show-previous-year" class="text-sm font-medium text-slate-700 dark:text-slate-300 bengali-text">
                                        প্রশ্নে দেখান
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <button onclick="Teacher.addQuestionToList()" id="add-question-btn" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition bengali-text">
                            <i class="fas fa-plus mr-2"></i> তালিকায় যোগ করুন
                        </button>
                    </div>
                </div>
                
                <div id="json-container" class="hidden">
                    <div class="json-actions">
                        <button onclick="Teacher.copyJson()" class="bg-indigo-600 text-white px-3 py-2 rounded text-sm font-bold bengali-text">
                            <i class="fas fa-copy mr-1"></i> JSON কপি
                        </button>
                        <button onclick="Teacher.clearJson()" class="bg-red-600 text-white px-3 py-2 rounded text-sm font-bold bengali-text">
                            <i class="fas fa-trash mr-1"></i> JSON ক্লিয়ার
                        </button>
                    </div>
                    <textarea id="nq" class="w-full h-40 p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl font-mono text-xs auto-resize" placeholder='JSON প্রশ্ন অ্যারে এখানে পেস্ট করুন...' oninput="autoResizeTextarea(this)"></textarea>
                </div>
                
                ${isLive ? `
                <div class="flex gap-2 mt-4">
                    <button onclick="Teacher.createExam(false)" class="flex-1 bg-slate-800 dark:bg-dark-tertiary text-white py-4 rounded-xl font-bold shadow hover:bg-slate-900 dark:hover:bg-black transition bengali-text">এখনই প্রকাশ করুন</button>
                    <button onclick="Teacher.createExam(true)" class="flex-1 bg-amber-500 text-white py-4 rounded-xl font-bold shadow hover:bg-amber-600 transition bengali-text">লাইব্রেরিতে সংরক্ষণ (ড্রাফট)</button>
                </div>` : `
                <button onclick="Teacher.createExam(false)" class="bg-slate-800 dark:bg-dark-tertiary text-white w-full py-4 rounded-xl font-bold shadow hover:bg-slate-900 dark:hover:bg-black transition bengali-text">প্রকাশ করুন</button>`}
            </div>
        </div>`;
        
        Teacher.switchQuestionMode('manual');
        
        setTimeout(() => {
            document.querySelectorAll('.auto-resize').forEach(textarea => {
                autoResizeTextarea(textarea);
            });
        }, 100);
        
        const subjectSelect = document.getElementById('nsub');
        const chapterSelect = document.getElementById('nchap');
        
        subjectSelect.addEventListener('change', function() {
            const subject = this.value;
            
            chapterSelect.innerHTML = '<option value="">অধ্যায় নির্বাচন (ঐচ্ছিক)</option>';
            
            if (subject) {
                const subjectFolder = folderStructure[type].find(s => s.name === subject);
                const chaptersFromFolders = subjectFolder ? subjectFolder.children.map(c => c.name) : [];
                
                const chaptersFromExams = [...new Set(Object.values(ExamCache)
                    .filter(e => e.type === type && e.subject === subject && e.chapter)
                    .map(e => e.chapter))];
                
                const allChapters = [...new Set([...chaptersFromFolders, ...chaptersFromExams])];
                
                allChapters.forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter;
                    option.textContent = chapter;
                    option.className = 'bengali-text';
                    chapterSelect.appendChild(option);
                });
            }
        });
        
        const savedSubject = localStorage.getItem(`lastSubject_${type}`);
        if (savedSubject && subjects.includes(savedSubject)) {
            subjectSelect.value = savedSubject;
            subjectSelect.dispatchEvent(new Event('change'));
        }
    },
    
    switchQuestionMode: function(mode) {
        window.questionMode = mode;
        if(mode === 'manual') {
            document.getElementById('manual-questions-container').classList.remove('hidden');
            document.getElementById('json-container').classList.add('hidden');
            document.getElementById('mode-manual').className = "px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg bengali-text";
            document.getElementById('mode-json').className = "px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg bengali-text";
            
            try {
                const jsonText = document.getElementById('nq').value;
                if(jsonText.trim()) {
                    Teacher.questions = JSON.parse(jsonText);
                    Teacher.updateQuestionsList();
                }
            } catch(e) {
                console.error("JSON parse error:", e);
            }
        } else {
            document.getElementById('manual-questions-container').classList.add('hidden');
            document.getElementById('json-container').classList.remove('hidden');
            document.getElementById('mode-manual').className = "px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg bengali-text";
            document.getElementById('mode-json').className = "px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg bengali-text";
            
            if(Teacher.questions.length > 0) {
                document.getElementById('nq').value = JSON.stringify(Teacher.questions, null, 2);
                autoResizeTextarea(document.getElementById('nq'));
            }
        }
    },
    
    copyJson: function() {
        const jsonTextarea = document.getElementById('nq');
        jsonTextarea.select();
        document.execCommand('copy');
        Swal.fire('কপি হয়েছে!', 'JSON ক্লিপবোর্ডে কপি হয়েছে', 'success');
    },
    
    clearJson: function() {
        document.getElementById('nq').value = '';
        autoResizeTextarea(document.getElementById('nq'));
    },
    
    addQuestionToList: () => {
        const questionText = document.getElementById('textarea-question').value;
        const optionA = document.getElementById('option-a').value;
        const optionB = document.getElementById('option-b').value;
        const optionC = document.getElementById('option-c').value;
        const optionD = document.getElementById('option-d').value;
        const correctAnswer = document.getElementById('correct-answer').value;
        const explanation = document.getElementById('explanation').value;
        const previousYear = document.getElementById('previous-year').value;
        const showPreviousYear = document.getElementById('show-previous-year').checked;
        
        if(!questionText || !optionA || !optionB || !optionC || !optionD || correctAnswer === '') {
            Swal.fire('ত্রুটি', 'সব প্রয়োজনীয় ঘর পূরণ করুন', 'error');
            return;
        }
        
        const question = {
            q: questionText,
            options: [optionA, optionB, optionC, optionD],
            correct: parseInt(correctAnswer),
            expl: explanation || "",
            previousYear: previousYear || "",
            showPreviousYearInQuestion: showPreviousYear
        };
        
        if (Teacher.currentQuestion !== null) {
            Teacher.questions[Teacher.currentQuestion] = question;
            Teacher.currentQuestion = null;
            
            document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-plus mr-2"></i> তালিকায় যোগ করুন';
            document.getElementById('add-question-btn').onclick = () => Teacher.addQuestionToList();
            document.getElementById('question-form-title').innerText = 'নতুন প্রশ্ন যোগ করুন';
        } else {
            Teacher.questions.push(question);
        }
        
        document.getElementById('textarea-question').value = '';
        document.getElementById('option-a').value = '';
        document.getElementById('option-b').value = '';
        document.getElementById('option-c').value = '';
        document.getElementById('option-d').value = '';
        document.getElementById('correct-answer').value = '';
        document.getElementById('explanation').value = '';
        document.getElementById('previous-year').value = '';
        document.getElementById('show-previous-year').checked = false;
        
        document.querySelectorAll('.auto-resize').forEach(textarea => {
            textarea.style.height = 'auto';
        });
        
        Teacher.updateQuestionsList();
        
        document.querySelectorAll('.math-render-overlay').forEach(overlay => {
            overlay.style.display = 'none';
        });
        document.querySelectorAll('.question-textarea, .option-textarea, .explanation-textarea').forEach(textarea => {
            textarea.classList.remove('math-mode');
        });
        document.querySelectorAll('.math-preview-btn').forEach(btn => {
            btn.innerHTML = '<i class="fas fa-eye"></i>';
        });
        
        document.getElementById('textarea-question').focus();
    },
    
    updateQuestionsList: () => {
        const questionsList = document.getElementById('questions-list');
        if (!questionsList) return;
        
        if (Teacher.questions.length === 0) {
            questionsList.innerHTML = `
                <h3 class="font-bold text-lg mb-2 dark:text-white bengali-text">প্রশ্ন তালিকা (${Teacher.questions.length})</h3>
                <div class="text-center p-4 text-slate-400 bengali-text">এখনো কোনো প্রশ্ন যোগ করা হয়নি</div>
            `;
            return;
        }
        
        questionsList.innerHTML = `
            <h3 class="font-bold text-lg mb-2 dark:text-white bengali-text">প্রশ্ন তালিকা (${Teacher.questions.length})</h3>
            ${Teacher.questions.map((q, index) => `
                <div class="question-list-item dark:bg-black dark:border-dark-tertiary">
                    <div class="flex justify-between items-start mb-2">
                        <div class="question-text truncate dark:text-white bengali-text">${index + 1}. ${q.q.substring(0, 100)}${q.q.length > 100 ? '...' : ''}</div>
                        <div class="flex gap-2">
                            <button onclick="Teacher.editQuestion(${index})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="Teacher.deleteQuestion(${index})" class="text-red-600 hover:text-red-800 dark:text-red-400">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="options dark:text-slate-300 bengali-text">
                        A. ${q.options[0].substring(0, 50)}${q.options[0].length > 50 ? '...' : ''}<br>
                        B. ${q.options[1].substring(0, 50)}${q.options[1].length > 50 ? '...' : ''}<br>
                        C. ${q.options[2].substring(0, 50)}${q.options[2].length > 50 ? '...' : ''}<br>
                        D. ${q.options[3].substring(0, 50)}${q.options[3].length > 50 ? '...' : ''}
                    </div>
                    <div class="correct-answer dark:text-emerald-400 bengali-text">
                        সঠিক: ${String.fromCharCode(65 + q.correct)}
                    </div>
                </div>
            `).join('')}
        `;
    },
    
    editQuestion: (index) => {
        const q = Teacher.questions[index];
        
        document.getElementById('textarea-question').value = q.q;
        document.getElementById('option-a').value = q.options[0];
        document.getElementById('option-b').value = q.options[1];
        document.getElementById('option-c').value = q.options[2];
        document.getElementById('option-d').value = q.options[3];
        document.getElementById('correct-answer').value = q.correct;
        document.getElementById('explanation').value = q.expl || '';
        document.getElementById('previous-year').value = q.previousYear || '';
        document.getElementById('show-previous-year').checked = q.showPreviousYearInQuestion || false;
        
        Teacher.currentQuestion = index;
        
        document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-save mr-2"></i> প্রশ্ন আপডেট';
        document.getElementById('add-question-btn').onclick = () => Teacher.addQuestionToList();
        document.getElementById('question-form-title').innerText = `প্রশ্ন সম্পাদনা ${index + 1}`;
        
        document.getElementById('textarea-question').focus();
        window.scrollTo({
            top: document.querySelector('.question-box').offsetTop - 20,
            behavior: 'smooth'
        });
        
        setTimeout(() => {
            document.querySelectorAll('.auto-resize').forEach(textarea => {
                autoResizeTextarea(textarea);
            });
        }, 50);
    },
    
    deleteQuestion: (index) => {
        Swal.fire({
            title: 'প্রশ্ন মুছে ফেলবেন?',
            text: "এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'মুছে ফেলুন'
        }).then((result) => {
            if (result.isConfirmed) {
                Teacher.questions.splice(index, 1);
                Teacher.updateQuestionsList();
                
                if (Teacher.currentQuestion === index) {
                    Teacher.currentQuestion = null;
                    document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-plus mr-2"></i> তালিকায় যোগ করুন';
                    document.getElementById('question-form-title').innerText = 'নতুন প্রশ্ন যোগ করুন';
                }
            }
        });
    },
    
    createExam: async (isDraft = false) => {
        const confirmText = isDraft ? 'লাইব্রেরিতে ড্রাফট হিসেবে সংরক্ষণ' : 'পরীক্ষা প্রকাশ';
        const confirmMessage = isDraft ? 
            'আপনি কি এই পরীক্ষাটি ড্রাফট হিসেবে লাইব্রেরিতে সংরক্ষণ করতে চান?' : 
            'আপনি কি এই পরীক্ষাটি প্রকাশ করতে চান?';
        
        const confirm = await Swal.fire({
            title: confirmText,
            text: confirmMessage,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: `হ্যাঁ, ${confirmText}`
        });

        if(!confirm.isConfirmed) return;
        
        const loadingSwal = Swal.fire({
            title: isDraft ? 'ড্রাফট সংরক্ষণ হচ্ছে...' : 'পরীক্ষা প্রকাশ হচ্ছে...',
            text: 'অনুগ্রহ করে অপেক্ষা করুন...',
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });
        
        try {
            const t = document.getElementById('nt').value;
            const type = document.getElementById('nty').value;
            const d = document.getElementById('nd').value;
            const m = document.getElementById('nm').value;
            const neg = document.getElementById('nneg').value;
            const sub = document.getElementById('nsub').value;
            const chap = document.getElementById('nchap').value;
            const autoPublish = document.getElementById('nautopub') ? document.getElementById('nautopub').checked : false;
            
            if(!t || !d || !m) throw new Error("শিরোনাম, সময় এবং নম্বর আবশ্যক");
            
            let questions = '';
            
            if(window.questionMode === 'manual') {
                if(Teacher.questions.length === 0) {
                    Swal.close();
                    throw new Error("অনুগ্রহ করে অন্তত একটি প্রশ্ন যোগ করুন");
                }
                questions = JSON.stringify(Teacher.questions);
            } else {
                questions = document.getElementById('nq').value;
                JSON.parse(questions);
            }
            
            let st = null, et = null;
            if(type === 'live') {
                st = document.getElementById('nst').value;
                et = document.getElementById('net').value;
                if(!st || !et) {
                    Swal.close();
                    throw new Error("লাইভ পরীক্ষার জন্য শুরু ও শেষ সময় আবশ্যক");
                }
            }
            
            const examData = {
                title: t,
                type: type,
                subject: sub || '',
                chapter: chap || '',
                duration: parseInt(d),
                totalMarks: parseInt(m),
                negativeMark: parseFloat(neg),
                questions: questions,
                startTime: st,
                endTime: et,
                autoPublish: autoPublish,
                isDraft: isDraft,
                createdBy: AppState.currentUser.id,
                teacherCode: AppState.currentUser.teacherCode,
                resultPublished: isDraft ? false : (type === 'mock'),
                groupId: AppState.selectedGroup.id,
                groupName: AppState.selectedGroup.name,
                createdAt: new Date(),
                cancelled: false
            };
            
            const docRef = await addDoc(collection(db, "exams"), examData);
            
            if (sub) {
                localStorage.setItem(`lastSubject_${type}`, sub);
            }
            
            if (sub && chap) {
                const folderType = type === 'live' ? 'live' : 'mock';
                
                let subject = folderStructure[folderType].find(s => s.name === sub);
                if (!subject) {
                    subject = {
                        id: `subject-${sub}-${folderType}-${Date.now()}`,
                        name: sub,
                        type: 'subject',
                        examType: folderType,
                        children: [],
                        exams: []
                    };
                    folderStructure[folderType].push(subject);
                }
                
                let chapter = subject.children.find(c => c.name === chap);
                if (!chapter) {
                    chapter = {
                        id: `chapter-${chap}-${subject.id}-${Date.now()}`,
                        name: chap,
                        type: 'chapter',
                        parent: subject.id,
                        children: [],
                        exams: []
                    };
                    subject.children.push(chapter);
                }
                
                chapter.exams.push({
                    id: docRef.id,
                    name: t,
                    type: 'exam',
                    examType: type,
                    parent: chapter.id,
                    examData: examData
                });
            } else {
                if(!folderStructure.uncategorized) folderStructure.uncategorized = [];
                folderStructure.uncategorized.push({
                    id: docRef.id,
                    name: t,
                    examType: type,
                    examData: examData
                });
            }
            
            await saveFolderStructureToFirebase();
            
            Teacher.questions = [];
            Teacher.currentQuestion = null;
            
            document.getElementById('floating-math-btn').classList.add('hidden');
            document.getElementById('math-symbols-panel').classList.remove('show');
            
            Swal.close();
            
            Swal.fire('সফল', isDraft ? 'পরীক্ষা লাইব্রেরিতে ড্রাফট হিসেবে সংরক্ষিত হয়েছে' : 'পরীক্ষা সফলভাবে প্রকাশিত হয়েছে', 'success').then(() => {
                if (isDraft) {
                    Teacher.foldersView();
                } else {
                    Teacher.createView();
                }
            });
        } catch(e) {
            Swal.close();
            Swal.fire('ত্রুটি', e.message, 'error');
        }
    },

    // লাইব্রেরি ম্যানেজমেন্ট
    foldersView: () => {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('folders');
            return;
        }
        
        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
        document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">লাইব্রেরি ব্যবস্থাপনা</h2>
            </div>
            
            <div class="text-center p-10">
                <div class="loader mx-auto"></div>
                <p class="mt-2 text-sm text-slate-500 bengali-text">লোড হচ্ছে...</p>
            </div>
        </div>`;
        
        initRealTimeSync();
        
        const refreshFolderData = async () => {
            try {
                const folderDocRef = doc(db, "folderStructures", `${AppState.currentUser.id}_${AppState.selectedGroup.id}`);
                const docSnap = await getDoc(folderDocRef);
                if (docSnap.exists()) {
                    folderStructure = docSnap.data();
                } else {
                    folderStructure = { live: [], mock: [], uncategorized: [] };
                }
                
                document.getElementById('app-container').innerHTML = `
                <div class="pb-6">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold font-en text-slate-800 dark:text-white bengali-text">লাইব্রেরি ব্যবস্থাপনা</h2>
                    </div>
                    
                    <div class="flex flex-wrap gap-3 mb-6">
                        <button onclick="Teacher.createSubject('live')" class="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bengali-text">
                            <i class="fas fa-plus"></i> লাইভ বিষয়
                        </button>
                        <button onclick="Teacher.createSubject('mock')" class="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bengali-text">
                            <i class="fas fa-plus"></i> মক বিষয়
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white bengali-text">
                                    <i class="fas fa-broadcast-tower live-icon"></i>
                                    লাইভ পরীক্ষা
                                </h3>
                                <span class="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-1 rounded font-bold">
                                    ${folderStructure.live.reduce((acc, s) => acc + s.exams.length, 0)} পরীক্ষা
                                </span>
                            </div>
                            <div id="live-folder-tree" class="folder-tree space-y-1"></div>
                        </div>
                        
                        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white bengali-text">
                                    <i class="fas fa-book-reader mock-icon"></i>
                                    মক পরীক্ষা
                                </h3>
                                <span class="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 px-2 py-1 rounded font-bold">
                                    ${folderStructure.mock.reduce((acc, s) => acc + s.exams.length, 0)} পরীক্ষা
                                </span>
                            </div>
                            <div id="mock-folder-tree" class="folder-tree space-y-1"></div>
                        </div>
                    </div>
                    
                    <div class="mt-6 bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white bengali-text">
                                <i class="fas fa-question-circle text-slate-400"></i>
                                অশ্রেণীবদ্ধ পরীক্ষা
                            </h3>
                            <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded font-bold">
                                ${folderStructure.uncategorized.length} পরীক্ষা
                            </span>
                        </div>
                        <div id="uncategorized-exams" class="space-y-2"></div>
                    </div>
                </div>`;
                
                Teacher.renderFolderTree();
                Teacher.renderUncategorizedExams();
            } catch (error) {
                console.error('ফোল্ডার ডেটা রিফ্রেশ করতে ত্রুটি:', error);
            }
        };
        
        refreshFolderData();
    },
    
    renderFolderTree: () => {
        const liveTree = document.getElementById('live-folder-tree');
        if (liveTree) {
            liveTree.innerHTML = Teacher.renderFolderSection(folderStructure.live, 'live');
        }
        
        const mockTree = document.getElementById('mock-folder-tree');
        if (mockTree) {
            mockTree.innerHTML = Teacher.renderFolderSection(folderStructure.mock, 'mock');
        }
        
        document.querySelectorAll('.folder-toggle-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.folderId;
                Teacher.toggleFolder(id);
            });
        });
    },
    
    renderFolderSection: (subjects, type) => {
        if (subjects.length === 0) {
            return `<div class="text-center p-4 text-slate-400 bengali-text">
                <i class="fas fa-folder-open text-2xl mb-2 opacity-30"></i>
                <p>এখনো কোনো ${type} বিষয় নেই</p>
            </div>`;
        }
        
        return subjects.map(subject => {
            const subjectId = `subject-${subject.id}`;
            
            return `
            <div class="folder-item p-3 rounded-lg border border-slate-100 dark:border-dark-tertiary mb-2 dark:bg-black">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2 flex-1">
                        <i class="fas fa-folder folder-icon"></i>
                        <span class="font-bold dark:text-white bengali-text">${subject.name}</span>
                        <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded bengali-text">
                            ${subject.children.length} অধ্যায়
                        </span>
                    </div>
                    <div class="flex items-center gap-1">
                        ${subject.children.length > 0 ? `
                        <button data-folder-id="${subjectId}" class="folder-toggle-btn text-slate-400 hover:text-slate-600 p-1">
                            <i class="fas fa-chevron-down" id="icon-${subjectId}"></i>
                        </button>
                        ` : ''}
                        <div class="three-dot-menu relative">
                            <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('subject-${subject.id}')">
                                <i class="fas fa-ellipsis-v text-slate-400"></i>
                            </button>
                            <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-subject-${subject.id}">
                                <div class="menu-item add-chapter dark:text-emerald-400 bengali-text" onclick="Teacher.addChapterToSubject('${subject.id}', '${type}')">
                                    <i class="fas fa-plus-circle"></i>
                                    অধ্যায় যোগ
                                </div>
                                <div class="menu-item rename dark:text-purple-400 bengali-text" onclick="Teacher.renameItem('subject', '${subject.id}', '${subject.name}')">
                                    <i class="fas fa-pencil-alt"></i>
                                    পুনঃনামকরণ
                                </div>
                                <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteSubject('${subject.id}', '${type}')">
                                    <i class="fas fa-trash"></i>
                                    মুছে ফেলুন
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ${subject.children.length > 0 ? `
                <div class="folder-children mt-2 hidden" id="children-${subjectId}">
                    ${subject.children.map(chapter => {
                        const chapterId = `chapter-${chapter.id}`;
                        const hasExams = chapter.exams.length > 0;
                        
                        return `
                        <div class="ml-4 p-3 border-l-2 border-slate-200 dark:border-dark-tertiary">
                            <div class="flex justify-between items-center mb-2">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-folder-open text-slate-400"></i>
                                    <span class="font-medium dark:text-white bengali-text">${chapter.name}</span>
                                    <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded bengali-text">
                                        ${chapter.exams.length} পরীক্ষা
                                    </span>
                                </div>
                                <div class="flex items-center gap-1">
                                    ${hasExams ? `
                                    <button data-folder-id="${chapterId}" class="folder-toggle-btn text-slate-400 hover:text-slate-600 p-1">
                                        <i class="fas fa-chevron-down" id="icon-${chapterId}"></i>
                                    </button>
                                    ` : ''}
                                    <div class="three-dot-menu relative">
                                        <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('chapter-${chapter.id}')">
                                            <i class="fas fa-ellipsis-v text-slate-400"></i>
                                        </button>
                                        <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-chapter-${chapter.id}">
                                            <div class="menu-item add-exam dark:text-amber-400 bengali-text" onclick="Teacher.addExamToChapter('${subject.id}', '${chapter.id}', '${type}')">
                                                <i class="fas fa-plus"></i>
                                                পরীক্ষা যোগ
                                            </div>
                                            <div class="menu-item rename dark:text-purple-400 bengali-text" onclick="Teacher.renameItem('chapter', '${chapter.id}', '${chapter.name}')">
                                                <i class="fas fa-pencil-alt"></i>
                                                পুনঃনামকরণ
                                            </div>
                                            <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteChapter('${chapter.id}', '${type}')">
                                                <i class="fas fa-trash"></i>
                                                মুছে ফেলুন
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            ${hasExams ? `
                            <div class="chapter-children ml-6 hidden" id="children-${chapterId}">
                                ${chapter.exams.map(exam => {
                                    const examData = exam.examData || {};
                                    const isDraft = examData.isDraft;
                                    const isCancelled = examData.cancelled;
                                    const isPublished = examData.resultPublished;
                                    const now = new Date();
                                    const startTime = examData.startTime ? new Date(examData.startTime) : null;
                                    const endTime = examData.endTime ? new Date(examData.endTime) : null;
                                    
                                    let statusClass = 'status-draft';
                                    let statusText = 'ড্রাফট';
                                    
                                    if (isCancelled) {
                                        statusClass = 'status-cancelled';
                                        statusText = 'বাতিল';
                                    } else if (isPublished) {
                                        statusClass = 'status-ended';
                                        statusText = 'সমাপ্ত';
                                    } else if (startTime && endTime) {
                                        if (now < startTime) {
                                            statusClass = 'status-upcoming';
                                            statusText = 'আসন্ন';
                                        } else if (now >= startTime && now <= endTime) {
                                            statusClass = 'status-ongoing';
                                            statusText = 'চলমান';
                                        } else {
                                            statusClass = 'status-ended';
                                            statusText = 'সমাপ্ত';
                                        }
                                    } else if (isDraft) {
                                        statusClass = 'status-draft';
                                        statusText = 'ড্রাফট';
                                    }
                                    
                                    return `
                                    <div class="p-2 mt-2 bg-slate-50 dark:bg-black rounded border border-slate-100 dark:border-dark-tertiary">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-2 flex-1">
                                                <i class="fas fa-file-alt ${type === 'live' ? 'live-icon' : 'exam-icon'}"></i>
                                                <div>
                                                    <div class="font-medium text-sm dark:text-white bengali-text">${exam.name}</div>
                                                    <div class="flex items-center gap-2 mt-1">
                                                        <span class="text-xs ${statusClass} px-2 py-0.5 rounded bengali-text">${statusText}</span>
                                                        <div class="text-xs text-slate-500 dark:text-slate-400">
                                                            ${moment(examData.createdAt?.toDate()).format('DD MMM, YYYY') || 'অজানা তারিখ'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="three-dot-menu relative">
                                                <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('exam-${exam.id}')">
                                                    <i class="fas fa-ellipsis-v text-slate-400"></i>
                                                </button>
                                                <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-exam-${exam.id}">
                                                    <div class="menu-item view dark:text-blue-400 bengali-text" onclick="Teacher.viewPaper('${exam.id}')">
                                                        <i class="fas fa-eye"></i>
                                                        দেখুন
                                                    </div>
                                                    <div class="menu-item edit dark:text-blue-400 bengali-text" onclick="Teacher.editExam('${exam.id}')">
                                                        <i class="fas fa-edit"></i>
                                                        সম্পাদনা
                                                    </div>
                                                    ${type === 'live' && isDraft ? `
                                                    <div class="menu-item take-exam dark:text-emerald-400 bengali-text" onclick="Teacher.takeExamNow('${exam.id}')">
                                                        <i class="fas fa-play"></i>
                                                        এখনই নিন
                                                    </div>
                                                    ` : ''}
                                                    <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteExam('${exam.id}')">
                                                        <i class="fas fa-trash"></i>
                                                        মুছে ফেলুন
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>`;
                                }).join('')}
                            </div>
                            ` : ''}
                        </div>`;
                    }).join('')}
                </div>
                ` : ''}
            </div>`;
        }).join('');
    },
    
    toggleFolder: (id) => {
        const children = document.getElementById(`children-${id}`);
        const icon = document.getElementById(`icon-${id}`);
        
        if (!children || !icon) return;
        
        if (children.classList.contains('hidden')) {
            children.classList.remove('hidden');
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            children.classList.add('hidden');
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    },
    
    renderUncategorizedExams: () => {
        const container = document.getElementById('uncategorized-exams');
        if (!container) return;
        
        let uncategorizedList = folderStructure.uncategorized || [];
        
        if (uncategorizedList.length === 0) {
            container.innerHTML = `<div class="text-center p-4 text-slate-400 bengali-text">সব পরীক্ষা ফোল্ডারে সংগঠিত</div>`;
            return;
        }
        
        uncategorizedList.sort((a, b) => {
            const dateA = a.examData.createdAt?.seconds || 0;
            const dateB = b.examData.createdAt?.seconds || 0;
            return dateB - dateA;
        });
        
        container.innerHTML = uncategorizedList.map(exam => {
            const examData = exam.examData || {};
            const isDraft = examData.isDraft;
            const isCancelled = examData.cancelled;
            const isPublished = examData.resultPublished;
            const now = new Date();
            const startTime = examData.startTime ? new Date(examData.startTime) : null;
            const endTime = examData.endTime ? new Date(examData.endTime) : null;
            
            let statusClass = 'status-draft';
            let statusText = 'ড্রাফট';
            
            if (isCancelled) {
                statusClass = 'status-cancelled';
                statusText = 'বাতিল';
            } else if (isPublished) {
                statusClass = 'status-ended';
                statusText = 'সমাপ্ত';
            } else if (startTime && endTime) {
                if (now < startTime) {
                    statusClass = 'status-upcoming';
                    statusText = 'আসন্ন';
                } else if (now >= startTime && now <= endTime) {
                    statusClass = 'status-ongoing';
                    statusText = 'চলমান';
                } else {
                    statusClass = 'status-ended';
                    statusText = 'সমাপ্ত';
                }
            } else if (isDraft) {
                statusClass = 'status-draft';
                statusText = 'ড্রাফট';
            }
            
            return `
            <div class="p-3 bg-slate-50 dark:bg-black rounded-lg border border-slate-200 dark:border-dark-tertiary flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <i class="fas fa-file-alt ${exam.examType === 'live' ? 'live-icon' : 'exam-icon'}"></i>
                    <div>
                        <div class="font-bold text-sm dark:text-white bengali-text">${exam.name}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 bengali-text">
                            ${exam.examData.type} • ${moment(exam.examData.createdAt.toDate()).format('DD MMM, YYYY')}
                            • <span class="${statusClass} bengali-text">${statusText}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="three-dot-menu relative">
                        <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('uncategorized-${exam.id}')">
                            <i class="fas fa-ellipsis-v text-slate-400"></i>
                        </button>
                        <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-uncategorized-${exam.id}">
                            <div class="menu-item view dark:text-blue-400 bengali-text" onclick="Teacher.viewPaper('${exam.id}')">
                                <i class="fas fa-eye"></i>
                                দেখুন
                            </div>
                            <div class="menu-item edit dark:text-blue-400 bengali-text" onclick="Teacher.editExam('${exam.id}')">
                                <i class="fas fa-edit"></i>
                                সম্পাদনা
                            </div>
                            ${exam.examType === 'live' && exam.examData.isDraft ? `
                            <div class="menu-item take-exam dark:text-emerald-400 bengali-text" onclick="Teacher.takeExamNow('${exam.id}')">
                                <i class="fas fa-play"></i>
                                এখনই নিন
                            </div>
                            ` : ''}
                            <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteExam('${exam.id}')">
                                <i class="fas fa-trash"></i>
                                মুছে ফেলুন
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
    },
    
    toggleThreeDotMenu: (menuId) => {
        document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
            if (dropdown.id !== `menu-${menuId}`) {
                dropdown.classList.remove('show');
            }
        });
        
        const menu = document.getElementById(`menu-${menuId}`);
        if (menu) {
            menu.classList.toggle('show');
        }
    },
    
    createSubject: async (type) => {
        const { value: subjectName } = await Swal.fire({
            title: `নতুন ${type === 'live' ? 'লাইভ' : 'মক'} বিষয় তৈরি`,
            input: 'text',
            inputLabel: 'বিষয়ের নাম',
            inputPlaceholder: 'বিষয়ের নাম লিখুন',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'বিষয়ের নাম দিতে হবে!';
                if (folderStructure[type].some(s => s.name === value)) {
                    return 'এই বিষয়টি ইতিমধ্যে বিদ্যমান!';
                }
            }
        });
        
        if (subjectName) {
            const newSubject = {
                id: `subject-${Date.now()}`,
                name: subjectName,
                type: 'subject',
                examType: type,
                children: [],
                exams: []
            };
            
            folderStructure[type].push(newSubject);
            
            await saveFolderStructureToFirebase();
            
            Teacher.renderFolderTree();
            
            Swal.fire('সফল', 'বিষয় সফলভাবে তৈরি হয়েছে', 'success');
        }
    },
    
    addChapterToSubject: async function(subjectId, type) {
        const subject = folderStructure[type].find(s => s.id === subjectId);
        if (!subject) return;
        
        const { value: chapterName } = await Swal.fire({
            title: `${subject.name} এ অধ্যায় যোগ করুন`,
            input: 'text',
            inputLabel: 'অধ্যায়ের নাম',
            inputPlaceholder: 'অধ্যায়ের নাম লিখুন',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'অধ্যায়ের নাম দিতে হবে!';
                if (subject.children.some(c => c.name === value)) {
                    return 'এই অধ্যায়টি ইতিমধ্যে বিদ্যমান!';
                }
            }
        });
        
        if (chapterName) {
            const newChapter = {
                id: `chapter-${Date.now()}`,
                name: chapterName,
                type: 'chapter',
                parent: subject.id,
                children: [],
                exams: []
            };
            
            subject.children.push(newChapter);
            
            await saveFolderStructureToFirebase();
            
            Teacher.renderFolderTree();
            
            Swal.fire('সফল', 'অধ্যায় সফলভাবে যোগ করা হয়েছে', 'success');
        }
    },
    
    addExamToChapter: function(subjectId, chapterId, type) {
        const subject = folderStructure[type].find(s => s.id === subjectId);
        if (!subject) return;
        
        const chapter = subject.children.find(c => c.id === chapterId);
        if (!chapter) return;
        
        Teacher.renderForm(type);
        
        setTimeout(() => {
            document.getElementById('nsub').value = subject.name;
            document.getElementById('nsub').dispatchEvent(new Event('change'));
            
            setTimeout(() => {
                document.getElementById('nchap').value = chapter.name;
            }, 100);
        }, 500);
    },
    
    renameItem: async function(itemType, itemId, currentName) {
        const { value: newName } = await Swal.fire({
            title: `${itemType} পুনঃনামকরণ`,
            input: 'text',
            inputLabel: 'নতুন নাম',
            inputValue: currentName,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'নতুন নাম দিতে হবে!';
            }
        });
        
        if (newName && newName !== currentName) {
            let found = false;
            
            for (const type of ['live', 'mock']) {
                if (itemType === 'subject') {
                    const subject = folderStructure[type].find(s => s.id === itemId);
                    if (subject) {
                        subject.name = newName;
                        found = true;
                        break;
                    }
                } else if (itemType === 'chapter') {
                    for (const subject of folderStructure[type]) {
                        const chapter = subject.children.find(c => c.id === itemId);
                        if (chapter) {
                            chapter.name = newName;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
            }
            
            if (found) {
                await saveFolderStructureToFirebase();
                
                Swal.fire('সফল', `${itemType} এর নাম পরিবর্তন করে ${newName} রাখা হয়েছে`, 'success');
                Teacher.foldersView();
            }
        }
    },
    
    deleteSubject: async function(subjectId, type) {
        const result = await Swal.fire({
            title: 'বিষয় মুছে ফেলবেন?',
            text: "এটি এই বিষয়ের অধীনস্থ সকল অধ্যায় এবং পরীক্ষা মুছে ফেলবে!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'সবকিছু মুছে ফেলুন'
        });
        
        if (result.isConfirmed) {
            const subjectIndex = folderStructure[type].findIndex(s => s.id === subjectId);
            if (subjectIndex !== -1) {
                folderStructure[type].splice(subjectIndex, 1);
                
                await saveFolderStructureToFirebase();
                
                Teacher.renderFolderTree();
                Swal.fire('মুছে ফেলা হয়েছে!', 'বিষয় এবং এর সকল বিষয়বস্তু মুছে ফেলা হয়েছে।', 'success');
            }
        }
    },
    
    deleteChapter: async function(chapterId, type) {
        const result = await Swal.fire({
            title: 'অধ্যায় মুছে ফেলবেন?',
            text: "এটি এই অধ্যায়ের অধীনস্থ সকল পরীক্ষা মুছে ফেলবে!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'সবকিছু মুছে ফেলুন'
        });
        
        if (result.isConfirmed) {
            for (const subject of folderStructure[type]) {
                const chapterIndex = subject.children.findIndex(c => c.id === chapterId);
                if (chapterIndex !== -1) {
                    subject.children.splice(chapterIndex, 1);
                    
                    await saveFolderStructureToFirebase();
                    
                    Teacher.renderFolderTree();
                    Swal.fire('মুছে ফেলা হয়েছে!', 'অধ্যায় এবং সকল পরীক্ষা মুছে ফেলা হয়েছে।', 'success');
                    break;
                }
            }
        }
    },
    
    editExam: async (examId) => {
        const exam = ExamCache[examId];
        if (!exam) return;
        
        Teacher.questions = [];
        Teacher.currentQuestion = null;
        Teacher.renderForm(exam.type);
        
        setTimeout(() => {
            document.getElementById('nt').value = exam.title;
            document.getElementById('nd').value = exam.duration;
            document.getElementById('nm').value = exam.totalMarks;
            document.getElementById('nneg').value = exam.negativeMark || 0;
            document.getElementById('nsub').value = exam.subject || '';
            document.getElementById('nsub').dispatchEvent(new Event('change'));
            
            setTimeout(() => {
                document.getElementById('nchap').value = exam.chapter || '';
            }, 100);
            
            if (exam.type === 'live') {
                document.getElementById('nst').value = exam.startTime || '';
                document.getElementById('net').value = exam.endTime || '';
                if (document.getElementById('nautopub')) {
                    document.getElementById('nautopub').checked = exam.autoPublish || false;
                }
            }
            
            try {
                Teacher.questions = JSON.parse(exam.questions);
            } catch (e) {
                Teacher.questions = [];
            }
            
            Teacher.updateQuestionsList();
            
            const actionContainer = document.querySelector('.flex.gap-2.mt-4') || document.querySelector('button[onclick*="createExam"]');
            if(actionContainer) {
                actionContainer.outerHTML = `<button onclick="Teacher.updateExistingExam('${examId}')" class="bg-indigo-600 text-white w-full py-4 rounded-xl font-bold shadow hover:bg-indigo-700 transition bengali-text">পরীক্ষা আপডেট করুন</button>`;
            }
            
            setTimeout(() => {
                document.querySelectorAll('.auto-resize').forEach(textarea => {
                    autoResizeTextarea(textarea);
                });
            }, 200);
        }, 500);
    },
    
    updateExistingExam: async function(examId) {
        try {
            const t = document.getElementById('nt').value;
            const d = document.getElementById('nd').value;
            const m = document.getElementById('nm').value;
            const neg = document.getElementById('nneg').value;
            const sub = document.getElementById('nsub').value;
            const chap = document.getElementById('nchap').value;
            const autoPublish = document.getElementById('nautopub') ? document.getElementById('nautopub').checked : false;
            
            let questions = '';
            
            if(window.questionMode === 'manual') {
                if(Teacher.questions.length === 0) {
                    throw new Error("অনুগ্রহ করে অন্তত একটি প্রশ্ন যোগ করুন");
                }
                questions = JSON.stringify(Teacher.questions);
            } else {
                questions = document.getElementById('nq').value;
                JSON.parse(questions);
            }
            
            const exam = ExamCache[examId];
            const updateData = {
                title: t,
                subject: sub || '',
                chapter: chap || '',
                duration: parseInt(d),
                totalMarks: parseInt(m),
                negativeMark: parseFloat(neg),
                questions: questions,
                updatedAt: new Date()
            };
            
            if (exam.type === 'live') {
                updateData.startTime = document.getElementById('nst').value;
                updateData.endTime = document.getElementById('net').value;
                updateData.autoPublish = autoPublish;
                updateData.resultPublished = exam.resultPublished || autoPublish;
            }
            
            await updateDoc(doc(db, "exams", examId), updateData);
            
            await Teacher.syncFolderExamData(examId, updateData);
            
            Teacher.questions = [];
            Teacher.currentQuestion = null;
            document.getElementById('floating-math-btn').classList.add('hidden');
            document.getElementById('math-symbols-panel').classList.remove('show');
            
            Swal.fire('সফল', 'পরীক্ষা সফলভাবে আপডেট হয়েছে', 'success').then(() => {
                Teacher.foldersView();
            });
        } catch(e) {
            Swal.fire('ত্রুটি', e.message, 'error');
        }
    },
    
    deleteExam: async (examId) => {
        const result = await Swal.fire({
            title: 'পরীক্ষা মুছে ফেলবেন?',
            text: "এটি পরীক্ষা এবং সংশ্লিষ্ট সকল প্রচেষ্টা মুছে ফেলবে!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'সবকিছু মুছে ফেলুন'
        });

        if (result.isConfirmed) {
            try {
                Swal.fire({
                    title: 'মুছে ফেলা হচ্ছে...',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                await deleteDoc(doc(db, "exams", examId));

                const qAttempts = query(collection(db, "attempts"), where("examId", "==", examId));
                const snapAttempts = await getDocs(qAttempts);
                const batch = writeBatch(db);
                snapAttempts.forEach(d => batch.delete(d.ref));
                await batch.commit();

                for (const type of ['live', 'mock']) {
                    folderStructure[type].forEach(sub => {
                        sub.children.forEach(chap => {
                            chap.exams = chap.exams.filter(e => e.id !== examId);
                        });
                    });
                }

                folderStructure.uncategorized = (folderStructure.uncategorized || []).filter(e => e.id !== examId);

                await saveFolderStructureToFirebase();

                delete ExamCache[examId];

                Swal.fire('মুছে ফেলা হয়েছে!', 'পরীক্ষা সর্বত্র থেকে মুছে ফেলা হয়েছে।', 'success');
                Teacher.foldersView();
            } catch (error) {
                Swal.fire('ত্রুটি', 'মুছে ফেলতে ব্যর্থ: ' + error.message, 'error');
            }
        }
    },
    
    takeExamNow: async (examId) => {
        const exam = ExamCache[examId];
        if (!exam) return;
        
        const rankQuery = query(collection(db, "attempts"), where("examId", "==", examId));
        const rankSnap = await getDocs(rankQuery);
        const hasRank = !rankSnap.empty;
        
        const { value: formValues } = await Swal.fire({
            title: 'পরীক্ষার সময়সূচী নির্ধারণ',
            html: `
            <div class="text-left">
                <label class="text-xs font-bold bengali-text">শুরুর সময়</label>
                <input id="sw-st" type="datetime-local" class="swal2-input">
                <label class="text-xs font-bold bengali-text">শেষ সময়</label>
                <input id="sw-et" type="datetime-local" class="swal2-input">
                ${hasRank ? `
                <div class="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p class="text-xs font-bold mb-2 bengali-text">র‍্যাংক তালিকা অপশন:</p>
                    <label class="flex items-center gap-2 text-xs mb-2 bengali-text">
                        <input type="radio" name="rank-opt" value="merge" checked>
                        বিদ্যমান র‍্যাংকিংয়ে যুক্ত করুন
                    </label>
                    <label class="flex items-center gap-2 text-xs bengali-text">
                        <input type="radio" name="rank-opt" value="new">
                        আগের সব র‍্যাংক মুছে নতুন করুন
                    </label>
                </div>` : ''}
            </div>`,
            showCancelButton: true,
            confirmButtonText: 'নিশ্চিত করুন ও লাইভ করুন',
            preConfirm: () => {
                const rankOpt = document.querySelector('input[name="rank-opt"]:checked')?.value || 'new';
                return [
                    document.getElementById('sw-st').value,
                    document.getElementById('sw-et').value,
                    rankOpt
                ];
            }
        });
        
        if (formValues) {
            const [startTime, endTime, rankOpt] = formValues;
            if (!startTime || !endTime) {
                Swal.fire('ত্রুটি', 'সময় আবশ্যক', 'error');
                return;
            }
            
            try {
                if (rankOpt === 'new' && hasRank) {
                    const batch = writeBatch(db);
                    rankSnap.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
                
                await updateDoc(doc(db, "exams", examId), {
                    startTime: startTime,
                    endTime: endTime,
                    isDraft: false,
                    cancelled: false,
                    resultPublished: false,
                    updatedAt: new Date()
                });
                
                await Teacher.syncFolderExamData(examId, { 
                    isDraft: false, 
                    resultPublished: false, 
                    cancelled: false,
                    startTime: startTime,
                    endTime: endTime
                });
                
                Swal.fire('সফল', 'পরীক্ষা এখন লাইভ', 'success').then(() => {
                    Teacher.foldersView();
                });
            } catch (e) {
                Swal.fire('ত্রুটি', e.message, 'error');
            }
        }
    },
    
    viewPaper: async (examId) => {
        const exam = ExamCache[examId];
        if (!exam) return;
        
        const questions = JSON.parse(exam.questions);
        
        let html = `
            <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary max-w-3xl mx-auto">
                <h3 class="text-xl font-bold mb-4 text-center dark:text-white bengali-text">${exam.title}</h3>
                <div class="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center bengali-text">
                    ${exam.subject ? exam.subject : ''} ${exam.chapter ? '• ' + exam.chapter : ''}
                    ${exam.isDraft ? '<span class="text-amber-600 ml-2 bengali-text">• ড্রাফট</span>' : ''}
                    ${exam.cancelled ? '<span class="text-red-600 ml-2 bengali-text">• বাতিল</span>' : ''}
                </div>
        `;
        
        questions.forEach((q, index) => {
            let questionHTML = q.q;
            if (q.q.includes('\\') || q.q.includes('^') || q.q.includes('_')) {
                questionHTML = `<span class="math-render bengali-text">\\(${q.q}\\)</span>`;
            } else {
                questionHTML = `<span class="bengali-text">${q.q}</span>`;
            }
            
            html += `
                <div class="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-black dark:border-dark-tertiary">
                    <div class="flex justify-between items-start mb-3">
                        <span class="font-bold text-indigo-600 dark:text-indigo-400 bengali-text">প্রশ্ন ${index + 1}</span>
                        ${q.previousYear && q.showPreviousYearInQuestion ? `<span class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-1 rounded bengali-text">${q.previousYear}</span>` : ''}
                    </div>
                    <p class="font-medium mb-3 dark:text-white">${questionHTML}</p>
                    <div class="space-y-2 mb-3">
                        ${q.options.map((option, optIndex) => {
                            const isCorrect = optIndex === q.correct;
                            
                            let optionText = option;
                            if (option.includes('\\') || option.includes('^') || option.includes('_')) {
                                optionText = `<span class="math-render bengali-text">\\(${option}\\)</span>`;
                            } else {
                                optionText = `<span class="bengali-text">${option}</span>`;
                            }
                            
                            return `
                                <div class="p-2 rounded border ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-700' : 'bg-white dark:bg-dark-secondary border-slate-200 dark:border-dark-tertiary'}">
                                    <span class="font-bold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'} bengali-text">${String.fromCharCode(65 + optIndex)}.</span>
                                    <span class="${isCorrect ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'dark:text-slate-300'}">${optionText}</span>
                                    ${isCorrect ? '<i class="fas fa-check float-right text-emerald-600 dark:text-emerald-400"></i>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${q.previousYear && !q.showPreviousYearInQuestion ? `
                        <div class="mt-3 p-3 bg-amber-50 dark:bg-amber-900 rounded border border-amber-200 dark:border-amber-800">
                            <span class="font-bold text-amber-700 dark:text-amber-300 text-sm bengali-text">পূর্ববর্তী বছর:</span>
                            <p class="text-sm mt-1 dark:text-amber-200 bengali-text">${q.previousYear}</p>
                        </div>
                    ` : ''}
                    ${q.expl && q.expl.trim() !== "" ? `
                        <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-800">
                            <span class="font-bold text-blue-700 dark:text-blue-300 text-sm bengali-text">ব্যাখ্যা:</span>
                            <p class="text-sm mt-1 dark:text-blue-200 bengali-text">${q.expl}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `</div>`;
        
        document.getElementById('app-container').innerHTML = `
            <div class="pb-6">
                <button onclick="Teacher.foldersView()" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bengali-text">
                    <i class="fas fa-arrow-left"></i> লাইব্রেরিতে ফিরুন
                </button>
                ${html}
            </div>
        `;
        
        MathJax.typesetPromise();
    },
    
    liveExamManagementView: () => {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('management');
            return;
        }
        
        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
        const c = document.getElementById('app-container');
        c.innerHTML = `
        <div class="pb-6">
            <div class="flex items-center gap-3 mb-6">
                <button onclick="Teacher.managementView()" class="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text">
                    <i class="fas fa-arrow-left"></i> ফিরে যান
                </button>
                <h2 class="text-2xl font-bold font-en dark:text-white bengali-text">লাইভ পরীক্ষা ব্যবস্থাপনা</h2>
            </div>
            <div id="live-exams-list-container" class="space-y-4">
                <div class="text-center p-10"><div class="loader mx-auto"></div></div>
            </div>
        </div>`;

        const q = query(
            collection(db, "exams"),
            where("groupId", "==", AppState.selectedGroup.id),
            where("type", "==", "live"),
            where("resultPublished", "==", false),
            where("cancelled", "!=", true),
            where("isDraft", "==", false)
        );

        const unsub = onSnapshot(q, (snap) => {
            const container = document.getElementById('live-exams-list-container');
            if (!container) return;

            let html = '';
            snap.forEach(doc => {
                const exam = { id: doc.id, ...doc.data() };
                if (exam.isDraft) return;

                const startTime = moment(exam.startTime).format('lll');
                const endTime = moment(exam.endTime).format('lll');
                
                html += `
                    <div class="live-exam-card bg-white dark:bg-dark-secondary p-4 rounded-xl border dark:border-dark-tertiary shadow-sm">
                        <h3 class="font-bold dark:text-white bengali-text">${exam.title}</h3>
                        <p class="text-xs text-slate-500 mb-3 bengali-text">${exam.subject || 'কোনো বিষয় নেই'} - ${exam.chapter || 'কোনো অধ্যায় নেই'}</p>
                        <div class="text-[10px] text-slate-400 mb-3">
                            শুরু: ${startTime} <br> শেষ: ${endTime}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="Teacher.stopLiveExam('${exam.id}')" class="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold bengali-text hover:bg-red-700 transition">
                                বাতিল করুন
                            </button>
                            <button onclick="Teacher.extendExamTime('${exam.id}')" class="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold bengali-text hover:bg-emerald-700 transition">
                                সময় বাড়ান
                            </button>
                            <button onclick="Teacher.publish('${exam.id}')" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold bengali-text hover:bg-indigo-700 transition">
                                ফলাফল প্রকাশ
                            </button>
                        </div>
                    </div>`;
            });
            
            container.innerHTML = html || '<div class="text-center p-10 text-slate-400 bengali-text">কোনো সক্রিয় লাইভ পরীক্ষা নেই।</div>';
        });
        unsubscribes.push(unsub);
    },
    
    stopLiveExam: async function(examId) {
        const exam = ExamCache[examId];
        if (!exam) return;
        
        const confirm = await Swal.fire({
            title: 'পরীক্ষা বাতিল করবেন?',
            text: "এটি পরীক্ষাটি তাৎক্ষণিকভাবে বাতিল করবে! শিক্ষার্থীরা আর এই পরীক্ষা দেখতে পাবে না। ফলাফল প্রকাশিত হবে না।",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'হ্যাঁ, এখনই বাতিল করুন!'
        });

        if (confirm.isConfirmed) {
            try {
                await updateDoc(doc(db, "exams", examId), {
                    cancelled: true,
                    updatedAt: new Date()
                });
                
                await Teacher.syncFolderExamData(examId, { cancelled: true });
                
                Swal.fire('বাতিল করা হয়েছে!', 'পরীক্ষাটি বাতিল করা হয়েছে। ফলাফল প্রকাশিত হয়নি।', 'success');
                
                if (AppState.currentPage === 'home') {
                    const homeContainer = document.getElementById('home-active-live-section');
                    if (homeContainer) homeContainer.innerHTML = '';
                }
            } catch (error) {
                Swal.fire('ত্রুটি', 'পরীক্ষা বাতিল করতে ব্যর্থ: ' + error.message, 'error');
            }
        }
    },
    
    publish: async (id) => {
        Swal.fire({ 
            title:'ফলাফল প্রকাশ করবেন?', 
            text: "শিক্ষার্থীরা এখন তাদের ফলাফল দেখতে পাবে।", 
            icon:'question', 
            showCancelButton:true, 
            confirmButtonColor:'#4f46e5', 
            confirmButtonText:'হ্যাঁ, প্রকাশ করুন' 
        }).then(async(r) => {
            if(r.isConfirmed) { 
                await updateDoc(doc(db, "exams", id), { 
                    resultPublished: true,
                    updatedAt: new Date()
                }); 
                
                await Teacher.syncFolderExamData(id, { resultPublished: true });
                
                Swal.fire('প্রকাশিত', 'ফলাফল এখন লাইভ', 'success').then(() => {
                    if (AppState.currentPage === 'home') {
                        const homeContainer = document.getElementById('home-active-live-section');
                        if (homeContainer) homeContainer.innerHTML = '';
                    }
                });
            }
        });
    },
    
    syncFolderExamData: async (examId, newData) => {
        for (const type of ['live', 'mock']) {
            folderStructure[type].forEach(sub => {
                sub.children.forEach(chap => {
                    const exam = chap.exams.find(e => e.id === examId);
                    if (exam) {
                        exam.examData = { ...exam.examData, ...newData };
                    }
                });
            });
        }
        
        const uncat = folderStructure.uncategorized.find(e => e.id === examId);
        if(uncat) uncat.examData = { ...uncat.examData, ...newData };
        
        await saveFolderStructureToFirebase();
    },
    
    viewUserResult: async (attemptId) => {
        const c = document.getElementById('app-container');
        c.innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-2 text-xs bengali-text">অপেক্ষা করুন...</p></div>';
        
        try {
            const attSnap = await getDoc(doc(db, "attempts", attemptId));
            if(!attSnap.exists()) throw new Error("ফলাফল পাওয়া যায়নি");
            
            const att = attSnap.data();
            const exSnap = await getDoc(doc(db, "exams", att.examId));
            if(!exSnap.exists()) throw new Error("পরীক্ষা পাওয়া যায়নি");
            
            const exam = { id: exSnap.id, ...exSnap.data() };
            const qs = JSON.parse(exam.questions);
            
            const rankQuery = query(
                collection(db, "attempts"), 
                where("examId", "==", exam.id), 
                orderBy("score", "desc"),
                orderBy("submittedAt", "asc")
            );
            const rankSnap = await getDocs(rankQuery);
            
            const uniqueParticipants = new Map();
            rankSnap.docs.forEach(doc => {
                const data = doc.data();
                if (!uniqueParticipants.has(data.userId)) {
                    uniqueParticipants.set(data.userId, data);
                }
            });

            const totalParticipants = uniqueParticipants.size;
            let userRank = 0;
            let highestScore = 0;
            
            let currentPos = 1;
            for (let [uid, data] of uniqueParticipants) {
                if (uid === att.userId) {
                    userRank = currentPos;
                }
                if (data.score > highestScore) highestScore = data.score;
                currentPos++;
            }

            const userAnswers = att.answers || [];
            const correctAnswers = qs.reduce((acc, q, i) => {
                return acc + (userAnswers[i] !== undefined && userAnswers[i] === q.correct ? 1 : 0);
            }, 0);
            const accuracy = qs.length > 0 ? ((correctAnswers / qs.length) * 100).toFixed(1) : 0;
            
            let timeTaken = 'N/A';
            if (att.submittedAt && att.startTime) {
                const sTime = att.startTime?.toDate() || new Date(exam.startTime);
                const subTime = att.submittedAt.toDate();
                const diff = Math.floor((subTime - sTime) / (1000 * 60));
                timeTaken = `${diff} মিনিট`;
            }

            window.currentResultPage = 1;
            window.resultFilter = 'all';
            window.filteredQuestions = [...qs];
            
            const renderQuestions = (questionsToShow) => {
                let h = '';
                let stats = { correct: 0, wrong: 0, skip: 0 };
                
                questionsToShow.forEach((q,i) => {
                    const originalIndex = qs.indexOf(q);
                    const u = userAnswers[originalIndex];
                    const corr = q.correct;
                    let st = 'skipped';
                    let badge = '<span class="text-amber-600 font-bold text-xs bengali-text">বাদ দেওয়া</span>';
                    
                    if(u !== undefined && u === corr) { 
                        st = 'correct'; 
                        stats.correct++; 
                        badge = '<span class="text-emerald-600 font-bold text-xs bengali-text">সঠিক</span>'; 
                    } else if (u !== undefined && u !== null) { 
                        st = 'wrong'; 
                        stats.wrong++; 
                        badge = '<span class="text-red-600 font-bold text-xs bengali-text">ভুল</span>'; 
                    } else { 
                        stats.skip++; 
                    }
                    
                    if (window.resultFilter !== 'all') {
                        if (window.resultFilter === 'correct' && st !== 'correct') return;
                        if (window.resultFilter === 'wrong' && st !== 'wrong') return;
                        if (window.resultFilter === 'skipped' && st !== 'skipped') return;
                    }
                    
                    let questionHTML = q.q;
                    if (q.q.includes('\\') || q.q.includes('^') || q.q.includes('_')) {
                        questionHTML = `<span class="math-render bengali-text">\\(${q.q}\\)</span>`;
                    } else {
                        questionHTML = `<span class="bengali-text">${q.q}</span>`;
                    }
                    
                    h += `<div class="ans-card ${st} p-4 rounded-xl mb-4 bg-white dark:bg-dark-secondary shadow-sm border dark:border-dark-tertiary">
                        <div class="flex justify-between mb-2 pb-2 border-b border-black/5 dark:border-dark-tertiary">
                            <span class="font-bold text-sm text-slate-700 dark:text-white bengali-text">প্রশ্ন ${originalIndex+1}</span>
                            ${badge}
                        </div>
                        <p class="text-sm font-semibold mb-3 text-slate-800 dark:text-white">${questionHTML}</p>
                        <div class="space-y-1">
                            ${q.options.map((o,oi)=>{
                                let cls="opt-res bg-white dark:bg-dark-tertiary text-slate-500 dark:text-slate-400";
                                let icon = "";
                                if(oi===corr) { 
                                    cls="opt-res right bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-700"; 
                                    icon='<i class="fas fa-check float-right mt-1 text-emerald-600 dark:text-emerald-400"></i>'; 
                                } else if(oi===u && u!==corr) { 
                                    cls="opt-res wrong-select bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700"; 
                                    icon='<i class="fas fa-times float-right mt-1 text-red-600 dark:text-red-400"></i>'; 
                                }
                                
                                let optionText = o;
                                if (o.includes('\\') || o.includes('^') || o.includes('_')) {
                                    optionText = `<span class="math-render bengali-text">\\(${o}\\)</span>`;
                                } else {
                                    optionText = `<span class="bengali-text">${o}</span>`;
                                }
                                
                                return `<div class="${cls}"><span class="bengali-text">${String.fromCharCode(65+oi)}. ${optionText}</span> ${icon}</div>`;
                            }).join('')}
                        </div>
                        <div class="mt-3 text-xs bg-white/60 dark:bg-dark-tertiary p-3 rounded border border-slate-200 dark:border-dark-tertiary">
                            <span class="font-bold text-indigo-600 dark:text-indigo-400 block mb-1 bengali-text">ব্যাখ্যা:</span>
                            ${q.expl ? `<span class="bengali-text">${q.expl}</span>` : "<span class='bengali-text'>কোনো ব্যাখ্যা প্রদান করা হয়নি।</span>"}
                        </div>
                    </div>`;
                });
                
                return { html: h, stats: stats };
            };
            
            const updateResultView = () => {
                const questionsPerPage = 25;
                const startIndex = (window.currentResultPage - 1) * questionsPerPage;
                const endIndex = startIndex + questionsPerPage;
                const currentQuestions = window.filteredQuestions.slice(startIndex, endIndex);
                
                const result = renderQuestions(currentQuestions);
                const totalPages = Math.ceil(window.filteredQuestions.length / questionsPerPage);
                
                const filterButtons = `
                    <div class="flex gap-2 mb-4 flex-wrap">
                        <button onclick="Teacher.setResultFilter('all')" class="filter-btn ${window.resultFilter === 'all' ? 'active bg-indigo-600 text-white border-indigo-600' : ''} bengali-text">
                            সব (${qs.length})
                        </button>
                        <button onclick="Teacher.setResultFilter('correct')" class="filter-btn correct ${window.resultFilter === 'correct' ? 'active' : ''} bengali-text">
                            সঠিক (${correctAnswers})
                        </button>
                        <button onclick="Teacher.setResultFilter('wrong')" class="filter-btn wrong ${window.resultFilter === 'wrong' ? 'active' : ''} bengali-text">
                            ভুল (${userAnswers.filter(a => a !== null && a !== undefined).length - correctAnswers})
                        </button>
                        <button onclick="Teacher.setResultFilter('skipped')" class="filter-btn skipped ${window.resultFilter === 'skipped' ? 'active' : ''} bengali-text">
                            বাদ (${qs.length - userAnswers.filter(a => a !== null && a !== undefined).length})
                        </button>
                    </div>
                `;
                
                const pagination = totalPages > 1 ? `
                    <div class="pagination flex justify-between items-center mt-4">
                        <button onclick="Teacher.prevResultPage()" class="page-btn bg-slate-100 dark:bg-dark-tertiary px-3 py-1 rounded text-sm ${window.currentResultPage === 1 ? 'opacity-50 cursor-not-allowed' : ''} bengali-text" ${window.currentResultPage === 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i> পূর্ববর্তী
                        </button>
                        <span class="text-sm bengali-text">পৃষ্ঠা ${window.currentResultPage} / ${totalPages}</span>
                        <button onclick="Teacher.nextResultPage()" class="page-btn bg-slate-100 dark:bg-dark-tertiary px-3 py-1 rounded text-sm ${window.currentResultPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''} bengali-text" ${window.currentResultPage === totalPages ? 'disabled' : ''}>
                            পরবর্তী <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                ` : '';
                
                const header = `
                <div class="compact-summary-card">
                    <div class="compact-header">
                        <div class="flex-1">
                            <div class="compact-title bengali-text">${att.userName}</div>
                            <div class="compact-date bengali-text">${exam.title}</div>
                        </div>
                        <div class="compact-score-section">
                            <div class="compact-score">${parseFloat(att.score).toFixed(2)}</div>
                            <div class="compact-accuracy">${accuracy}% নির্ভুলতা</div>
                        </div>
                    </div>
                    <div class="compact-grid">
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${qs.length}</div>
                            <div class="compact-stat-label bengali-text">মোট</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value text-emerald-600">${correctAnswers}</div>
                            <div class="compact-stat-label bengali-text">সঠিক</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value text-red-500">${userAnswers.filter(a => a !== null && a !== undefined).length - correctAnswers}</div>
                            <div class="compact-stat-label bengali-text">ভুল</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${qs.length - userAnswers.filter(a => a !== null && a !== undefined).length}</div>
                            <div class="compact-stat-label bengali-text">বাদ</div>
                        </div>
                        <div class="compact-stat-item border-2 border-indigo-100">
                            <div class="compact-stat-value text-indigo-600">${userRank}</div>
                            <div class="compact-stat-label bengali-text">র‍্যাংক</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${timeTaken}</div>
                            <div class="compact-stat-label bengali-text">সময়</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${totalParticipants}</div>
                            <div class="compact-stat-label bengali-text">মোট শিক্ষার্থী</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${highestScore.toFixed(2)}</div>
                            <div class="compact-stat-label bengali-text">সর্বোচ্চ</div>
                        </div>
                    </div>
                </div>
                `;
                
                c.innerHTML = `
                    <div class="pb-6">
                        <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500 bengali-text">
                            <i class="fas fa-arrow-left"></i> র‍্যাংকিংয়ে ফিরুন
                        </button>
                        <h2 class="font-bold text-xl mb-4 dark:text-white bengali-text">ব্যবহারকারীর ফলাফল বিশ্লেষণ</h2>
                        ${header}
                        ${filterButtons}
                        ${result.html || '<div class="text-center p-10 text-slate-400 bengali-text">কোনো প্রশ্ন ফিল্টারের সাথে মিলে না</div>'}
                        ${pagination}
                    </div>
                `;
                
                MathJax.typesetPromise();
            };
            
            window.filteredQuestions = [...qs];
            updateResultView();
            
            window.Teacher.setResultFilter = (filter) => {
                window.resultFilter = filter;
                window.currentResultPage = 1;
                
                if (filter === 'all') {
                    window.filteredQuestions = [...qs];
                } else {
                    window.filteredQuestions = qs.filter((q, i) => {
                        const u = userAnswers[i];
                        const corr = q.correct;
                        let st = 'skipped';
                        if(u !== undefined && u === corr) st = 'correct';
                        else if (u !== undefined && u !== null) st = 'wrong';
                        
                        return st === filter;
                    });
                }
                
                updateResultView();
            };
            
            window.Teacher.prevResultPage = () => {
                if (window.currentResultPage > 1) {
                    window.currentResultPage--;
                    updateResultView();
                }
            };
            
            window.Teacher.nextResultPage = () => {
                const totalPages = Math.ceil(window.filteredQuestions.length / 25);
                if (window.currentResultPage < totalPages) {
                    window.currentResultPage++;
                    updateResultView();
                }
            };
        } catch (e) {
            Swal.fire('ত্রুটি', e.message, 'error');
            Teacher.rankView();
        }
    },

    rankView: () => {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('rank');
            return;
        }
        
        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
         const c = document.getElementById('app-container');
         const exams = Object.values(ExamCache)
             .filter(e => e.type === 'live' && 
                    e.groupId === AppState.selectedGroup.id && 
                    e.resultPublished &&
                    !e.cancelled)
             .sort((a,b) => b.createdAt - a.createdAt);
         
         let h = '';
         if (exams.length === 0) {
             h = '<div class="text-center p-10 text-slate-400 bengali-text">কোনো প্রকাশিত লাইভ পরীক্ষা পাওয়া যায়নি</div>';
         } else {
             exams.forEach(e => {
                 const date = moment(e.createdAt.toDate()).format('DD MMM, YYYY');
                 h += `<div onclick="Teacher.viewRank('${e.id}', '${e.title}')" class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-tertiary cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group">
                     <div class="flex justify-between items-start mb-3">
                         <span class="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase">লাইভ</span>
                         <div class="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition">
                             <i class="fas fa-trophy text-sm"></i>
                         </div>
                     </div>
                     <div class="font-bold text-sm text-slate-800 dark:text-white bengali-text mb-2" style="line-height:1.4;">${e.title}</div>
                     <div class="text-xs text-slate-400">${date}</div>
                     <div class="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">র‍্যাংক দেখুন <i class="fas fa-arrow-right text-xs"></i></div>
                 </div>`;
             });
         }
         
         c.innerHTML = `<div class="pb-6">
             <div class="flex justify-between items-center mb-6">
                 <h2 class="text-xl font-bold font-en dark:text-white bengali-text">লাইভ পরীক্ষার র‍্যাংকিং</h2>
             </div>
             <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 bengali-text">শুধুমাত্র নির্বাচিত কোর্সের প্রকাশিত লাইভ পরীক্ষা দেখানো হচ্ছে।</p>
             ${h}
         </div>`;
    },
    
    viewRank: async (eid, title) => {
        const c = document.getElementById('app-container');
        c.innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-2 text-xs bengali-text">র‍্যাংক লোড হচ্ছে...</p></div>';
        
        try {
            const exSnap = await getDoc(doc(db, "exams", eid));
            if (!exSnap.exists()) {
                Swal.fire('ত্রুটি', 'এই পরীক্ষার তথ্য খুঁজে পাওয়া যায়নি।', 'error');
                Teacher.rankView();
                return;
            }
            
            const exam = { id: exSnap.id, ...exSnap.data() };

            let qs = [];
            try {
                qs = JSON.parse(exam.questions);
            } catch (e) {
                console.error("JSON parse error:", e);
            }

            const q = query(
                collection(db, "attempts"), 
                where("examId", "==", eid), 
                orderBy("score", "desc"),
                orderBy("submittedAt", "asc")
            );
            
            const unsub = onSnapshot(q, (snap) => {
                let rows = '';
                let highest = 0;
                
                if (snap.empty) {
                    c.innerHTML = `
                    <div class="pb-6">
                        <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text"><i class="fas fa-arrow-left mr-1"></i> র‍্যাংকিং</button>
                        <div class="text-center p-10 text-slate-500 bengali-text">এই পরীক্ষায় এখনো কেউ অংশগ্রহণ করেননি।</div>
                    </div>`;
                    return;
                }

                snap.docs.forEach((d, i) => {
                    const a = d.data();
                    const scoreValue = parseFloat(a.score) || 0;
                    if(scoreValue > highest) highest = scoreValue;
                    
                    let accuracy = "0";
                    if (qs.length > 0 && a.answers && Array.isArray(a.answers)) {
                        const correct = qs.reduce((acc, cur, idx) => {
                            return acc + (a.answers[idx] !== undefined && a.answers[idx] === cur.correct ? 1 : 0);
                        }, 0);
                        accuracy = ((correct / qs.length) * 100).toFixed(1);
                    }

                    rows += `
                    <div onclick="Teacher.viewUserResult('${d.id}')" class="flex items-center p-3 border-b dark:border-dark-tertiary hover:bg-slate-50 dark:hover:bg-dark-tertiary cursor-pointer transition-all">
                        <div class="w-8 text-center text-xs font-bold text-slate-400">${i+1}</div>
                        <div class="flex-1 ml-3">
                            <div class="font-bold text-sm dark:text-white bengali-text">${a.userName || 'অজানা শিক্ষার্থী'}</div>
                            <div class="text-[9px] text-slate-500 uppercase bengali-text">নির্ভুলতা: ${accuracy}% | সময়: ${moment(a.submittedAt?.toDate()).format('h:mm A')}</div>
                        </div>
                        <div class="font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/50 px-3 py-1 rounded text-xs">${scoreValue.toFixed(2)}</div>
                    </div>`;
                });
                
                c.innerHTML = `
                <div class="pb-6">
                    <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text"><i class="fas fa-arrow-left mr-1"></i> র‍্যাংকিং</button>
                    
                    <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-lg mb-6 text-center">
                        <h3 class="font-bold text-white text-lg bengali-text">${title}</h3>
                        <div class="grid grid-cols-2 gap-4 mt-5">
                            <div class="bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                                <div class="text-[10px] text-slate-400 uppercase tracking-wider font-bold bengali-text">মোট শিক্ষার্থী</div>
                                <div class="text-xl font-bold text-white">${snap.size}</div>
                            </div>
                            <div class="bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                                <div class="text-[10px] text-slate-400 uppercase tracking-wider font-bold bengali-text">সর্বোচ্চ স্কোর</div>
                                <div class="text-xl font-bold text-emerald-400">${highest.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary overflow-hidden shadow-sm">
                        <div class="bg-slate-50 dark:bg-dark-tertiary/50 p-3 text-[10px] font-bold text-slate-500 flex uppercase tracking-widest border-b dark:border-dark-tertiary">
                            <div class="w-8 text-center bengali-text">অবস্থান</div>
                            <div class="flex-1 ml-3 bengali-text">শিক্ষার্থীর বিবরণ</div>
                            <div class="bengali-text">স্কোর</div>
                        </div>
                        <div class="max-h-[60vh] overflow-y-auto">
                            ${rows}
                        </div>
                    </div>
                    <p class="text-[10px] text-slate-400 text-center mt-4 italic bengali-text">ক্লিক করে শিক্ষার্থীর বিস্তারিত উত্তরপত্র দেখুন</p>
                </div>`;
            }, (error) => {
                console.error("Snapshot Error:", error);
                Swal.fire('কুয়েরি ত্রুটি', 'ইন্ডেক্স তৈরি হতে কিছুটা সময় লাগতে পারে অথবা ব্রাউজার কনসোল চেক করুন।', 'error');
            });
            unsubscribes.push(unsub);

        } catch (e) {
            console.error("ViewRank Error:", e);
            Swal.fire('ত্রুটি', 'র‍্যাংক লোড হতে সমস্যা হয়েছে।', 'error');
            Teacher.rankView();
        }
    },
    
    managementView: () => {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('management');
            return;
        }
        
        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
        document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold font-en text-slate-800 dark:text-white bengali-text">ম্যানেজমেন্ট হাব</h2>
            </div>
            <div class="management-list">
                 <div class="management-item" onclick="Teacher.liveExamManagementView()">
                     <div class="flex items-center gap-3">
                         <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xl">
                             <i class="fas fa-broadcast-tower"></i>
                         </div>
                         <div>
                             <div class="font-bold text-sm text-slate-700 dark:text-white bengali-text">লাইভ পরীক্ষা ব্যবস্থাপনা</div>
                             <div class="text-xs text-slate-500 dark:text-slate-400 bengali-text">চলমান লাইভ পরীক্ষা বাতিল ও প্রকাশ করুন</div>
                         </div>
                     </div>
                     <i class="fas fa-chevron-right text-slate-400"></i>
                 </div>
                 
                 <div class="management-item" onclick="Teacher.manageGroupsView()">
                     <div class="flex items-center gap-3">
                         <div class="w-12 h-12 bg-amber-50 dark:bg-amber-900 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 text-xl">
                             <i class="fas fa-book"></i>
                         </div>
                         <div>
                             <div class="font-bold text-sm text-slate-700 dark:text-white bengali-text">কোর্স ব্যবস্থাপনা</div>
                             <div class="text-xs text-slate-500 dark:text-slate-400 bengali-text">আপনার কোর্সের শিক্ষার্থী পরিচালনা করুন</div>
                         </div>
                     </div>
                     <i class="fas fa-chevron-right text-slate-400"></i>
                 </div>
                 
                 <div class="management-item" onclick="Teacher.archiveGroupsView()">
                     <div class="flex items-center gap-3">
                         <div class="w-12 h-12 bg-rose-50 dark:bg-rose-900 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400 text-xl">
                             <i class="fas fa-archive"></i>
                         </div>
                         <div>
                             <div class="font-bold text-sm text-slate-700 dark:text-white bengali-text">আর্কাইভ কোর্স</div>
                             <div class="text-xs text-slate-500 dark:text-slate-400 bengali-text">আর্কাইভকৃত কোর্স দেখুন ও পরিচালনা করুন</div>
                         </div>
                     </div>
                     <i class="fas fa-chevron-right text-slate-400"></i>
                 </div>

                 <div class="management-item" onclick="Teacher.noticeManagementView()">
                     <div class="flex items-center gap-3">
                         <div class="w-12 h-12 bg-blue-50 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl">
                             <i class="fas fa-bullhorn"></i>
                         </div>
                         <div>
                             <div class="font-bold text-sm text-slate-700 dark:text-white bengali-text">নোটিশ ও পোল</div>
                             <div class="text-xs text-slate-500 dark:text-slate-400 bengali-text">কোর্সের জন্য নোটিশ ও পোল তৈরি করুন</div>
                         </div>
                     </div>
                     <i class="fas fa-chevron-right text-slate-400"></i>
                 </div>
            </div>
        </div>`;
    },
    
    // নোটিশ ও পোল ম্যানেজমেন্ট
    noticeManagementView: async () => {
        if (!AppState.selectedGroup) {
            Teacher.selectGroupView('management');
            return;
        }
        const c = document.getElementById('app-container');
        c.innerHTML = `
        <div class="pb-6">
            <div class="flex items-center gap-3 mb-6">
                <button onclick="Router.teacher(AppState.currentPage)" class="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text">
                    <i class="fas fa-arrow-left"></i> ফিরে যান
                </button>
                <h2 class="text-xl font-bold dark:text-white bengali-text">নোটিশ ও পোল</h2>
            </div>
            <div class="flex justify-between items-center mb-5">
                <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text">কোর্সের জন্য নোটিশ বা পোল তৈরি করুন ও পরিচালনা করুন</p>
                <button onclick="Teacher.createNoticeForm()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 bengali-text">
                    <i class="fas fa-plus"></i> নতুন তৈরি
                </button>
            </div>
            <div id="notice-list-container" class="space-y-4">
                <div class="text-center p-8 text-slate-400 bengali-text">লোড হচ্ছে...</div>
            </div>
        </div>`;

        await Teacher.loadNotices();
    },

    loadNotices: async () => {
        const q = query(
            collection(db, "notices"),
            where("groupId", "==", AppState.selectedGroup.id),
            orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const notices = [];
        snap.forEach(d => notices.push({ id: d.id, ...d.data() }));

        const container = document.getElementById('notice-list-container');
        if (notices.length === 0) {
            container.innerHTML = `<div class="text-center p-8 text-slate-400 bengali-text">কোনো নোটিশ বা পোল নেই</div>`;
            return;
        }

        let html = '';
        notices.forEach(n => {
            const isPoll = n.type === 'poll';
            const viewCount = Object.keys(n.views || {}).length;
            const voteCount = isPoll ? Object.keys(n.votes || {}).length : 0;
            let pollStatsHtml = '';
            if (isPoll && n.options && n.options.length > 0) {
                const votes = n.votes || {};
                const totalVotes = Object.keys(votes).length;
                const counts = {};
                n.options.forEach((_, i) => { counts[i] = 0; });
                Object.values(votes).forEach(optIdx => {
                    if (counts[optIdx] !== undefined) counts[optIdx]++;
                });
                const pollColors = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899'];
                pollStatsHtml = `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">পোল ফলাফল · মোট ${totalVotes} ভোট</div>`;
                n.options.forEach((opt, i) => {
                    const count = counts[i] || 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const col = pollColors[i % pollColors.length];
                    pollStatsHtml += `<div style="margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                            <span style="font-size:12px;font-weight:600;color:#374151;font-family:'Hind Siliguri',sans-serif;">${opt}</span>
                            <span style="font-size:11px;color:#64748b;font-weight:700;">${count} জন (${pct}%)</span>
                        </div>
                        <div style="background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden;">
                            <div style="background:${col};height:100%;width:${pct}%;border-radius:6px;min-width:${pct>0?'3px':'0'};"></div>
                        </div>
                    </div>`;
                });
                pollStatsHtml += '</div>';
            }

        html += `
            <div class="bg-white dark:bg-dark-secondary p-4 rounded-xl border dark:border-dark-tertiary" style="transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
                <div class="flex justify-between items-start">
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span class="text-xs font-bold px-2 py-1 rounded ${isPoll ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                                ${isPoll ? '📊 পোল' : '📢 নোটিশ'}
                            </span>
                            <span style="font-size:11px;color:#94a3b8;">📅 ${moment(n.createdAt.toDate()).format('DD MMM, YYYY')}</span>
                        </div>
                        <h3 class="font-bold text-base mt-1 dark:text-white bengali-text">${n.title}</h3>
                        ${!isPoll ? `<p class="text-sm text-slate-600 dark:text-slate-300 bengali-text mt-1" style="line-height:1.5;">${(n.content || '').substring(0, 120)}${(n.content||'').length > 120 ? '...' : ''}</p>` : ''}
                        <div class="flex gap-4 mt-2" style="font-size:12px;">
                            <span class="cursor-pointer hover:underline" style="color:#64748b;" onclick="Teacher.showViewers('${n.id}')">
                                👁️ ${viewCount} জন দেখেছেন
                            </span>
                        </div>
                        ${pollStatsHtml}
                    </div>
                    <div class="flex gap-2" style="margin-left:12px;flex-shrink:0;">
                        <button onclick="Teacher.deleteNotice('${n.id}')" class="text-red-500 hover:text-red-700" style="padding:6px 8px;border-radius:6px;border:1px solid #fecaca;background:#fff5f5;font-size:12px;" title="মুছুন"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    },

    createNoticeForm: () => {
        const c = document.getElementById('app-container');
        c.innerHTML = `
        <div class="p-0 max-w-3xl">
            <button onclick="Teacher.noticeManagementView()" class="mb-4 text-xs font-bold text-slate-500 bengali-text">
                <i class="fas fa-arrow-left"></i> ফিরে যান
            </button>
            <h2 class="text-xl font-bold mb-4 dark:text-white bengali-text">নতুন নোটিশ / পোল</h2>
            <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border">
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1 dark:text-white">ধরন</label>
                    <select id="notice-type" class="w-full p-3 border rounded-xl dark:bg-black" onchange="Teacher.toggleNoticeType()">
                        <option value="notice">সাধারণ নোটিশ</option>
                        <option value="poll">পোল</option>
                    </select>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-1 dark:text-white">শিরোনাম</label>
                    <input id="notice-title" class="w-full p-3 border rounded-xl dark:bg-black bengali-text" placeholder="শিরোনাম লিখুন">
                </div>
                <div id="notice-content-field" class="mb-4">
                    <label class="block text-sm font-bold mb-1 dark:text-white">বিস্তারিত</label>
                    <textarea id="notice-content" rows="4" class="w-full p-3 border rounded-xl dark:bg-black bengali-text" placeholder="নোটিশের বিস্তারিত..."></textarea>
                </div>
                <div id="poll-options-container" class="hidden mb-4">
                    <label class="block text-sm font-bold mb-2 dark:text-white">পোল অপশন</label>
                    <div id="poll-options-list">
                        <div class="flex gap-2 mb-2">
                            <input type="text" class="poll-option-input flex-1 p-2 border rounded dark:bg-black" placeholder="অপশন ১">
                            <button onclick="Teacher.addPollOption()" class="px-3 bg-slate-200 rounded">+</button>
                        </div>
                    </div>
                </div>
                <button onclick="Teacher.saveNotice()" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">প্রকাশ করুন</button>
            </div>
        </div>`;

        window.pollOptionCount = 1;
    },

    toggleNoticeType: () => {
        const type = document.getElementById('notice-type').value;
        if (type === 'poll') {
            document.getElementById('notice-content-field').classList.add('hidden');
            document.getElementById('poll-options-container').classList.remove('hidden');
        } else {
            document.getElementById('notice-content-field').classList.remove('hidden');
            document.getElementById('poll-options-container').classList.add('hidden');
        }
    },

    addPollOption: () => {
        window.pollOptionCount++;
        const container = document.getElementById('poll-options-list');
        const div = document.createElement('div');
        div.className = 'flex gap-2 mb-2';
        div.innerHTML = `
            <input type="text" class="poll-option-input flex-1 p-2 border rounded dark:bg-black" placeholder="অপশন ${window.pollOptionCount}">
            <button onclick="this.parentElement.remove()" class="px-3 bg-red-100 text-red-600 rounded">×</button>
        `;
        container.appendChild(div);
    },

    saveNotice: async () => {
        const type = document.getElementById('notice-type').value;
        const title = document.getElementById('notice-title').value.trim();
        if (!title) return Swal.fire('ত্রুটি', 'শিরোনাম আবশ্যক', 'error');

        let content = '';
        let options = [];
        if (type === 'notice') {
            content = document.getElementById('notice-content').value.trim();
            if (!content) return Swal.fire('ত্রুটি', 'বিস্তারিত লিখুন', 'error');
        } else {
            const inputs = document.querySelectorAll('.poll-option-input');
            inputs.forEach(inp => {
                const val = inp.value.trim();
                if (val) options.push(val);
            });
            if (options.length < 2) return Swal.fire('ত্রুটি', 'কমপক্ষে দুটি অপশন দিন', 'error');
        }

        const data = {
            groupId: AppState.selectedGroup.id,
            teacherId: AppState.currentUser.id,
            teacherName: AppState.currentUser.fullName,
            title,
            content,
            type,
            options: type === 'poll' ? options : [],
            createdAt: new Date(),
            updatedAt: new Date(),
            views: {},
            votes: {}
        };

        await addDoc(collection(db, "notices"), data);
        Swal.fire('সফল', 'প্রকাশিত হয়েছে', 'success');
        Teacher.noticeManagementView();
    },

    showViewers: async (noticeId) => {
        const docSnap = await getDoc(doc(db, "notices", noticeId));
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const views = data.views || {};
        const studentIds = Object.keys(views);
        if (studentIds.length === 0) {
            Swal.fire('কেউ দেখেনি', 'এখনো কেউ এই নোটিশটি দেখেনি', 'info');
            return;
        }

        const names = [];
        for (const sid of studentIds) {
            const sDoc = await getDoc(doc(db, "students", sid));
            if (sDoc.exists()) {
                const s = sDoc.data();
                names.push(`${s.name || s.fullName || 'নাম নেই'} (${moment(views[sid].toDate()).format('DD MMM, h:mm A')})`);
            }
        }

        Swal.fire({
            title: 'যারা দেখেছেন',
            html: names.join('<br>'),
            icon: 'info'
        });
    },

    deleteNotice: async (id) => {
        const confirm = await Swal.fire({ title: 'মুছে ফেলবেন?', icon: 'warning', showCancelButton: true });
        if (confirm.isConfirmed) {
            await deleteDoc(doc(db, "notices", id));
            Teacher.noticeManagementView();
        }
    },
    
    // কোর্স ম্যানেজমেন্ট ফাংশন
    createNewGroupModal: async () => {
        const { value: name } = await Swal.fire({
            title: 'নতুন কোর্স তৈরি',
            input: 'text',
            inputLabel: 'কোর্সের নাম',
            showCancelButton: true,
            inputValidator: (value) => { 
                if (!value) return 'নাম আবশ্যক!';
                if (value.length < 3) return 'কোর্সের নাম কমপক্ষে ৩ অক্ষরের হতে হবে!';
            }
        });
        if (name) Teacher.createGroup(name);
    },
    
    createGroup: async (name) => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        let groupCode = '';
        
        for (let i = 0; i < 5; i++) {
            groupCode += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        
        for (let i = 0; i < 5; i++) {
            groupCode += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
        
        try {
            const groupData = {
                name: name,
                groupCode: groupCode,
                teacherId: AppState.currentUser.id,
                teacherCode: AppState.currentUser.teacherCode,
                teacherName: AppState.currentUser.fullName,
                archived: false,
                approvalRequired: false,
                joinEnabled: true,
                studentIds: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            await addDoc(collection(db, "groups"), groupData);
            
            Swal.fire({
                title: 'কোর্স সফলভাবে তৈরি হয়েছে!',
                html: `
                    <div class="text-left">
                        <p class="mb-2 bengali-text"><strong>কোর্সের নাম:</strong> ${name}</p>
                        <p class="mb-2 bengali-text"><strong>কোর্স কোড:</strong> <code class="bg-slate-100 dark:bg-dark-tertiary p-1 rounded font-bold">${groupCode}</code></p>
                        <p class="text-sm text-slate-600 dark:text-slate-400 bengali-text">শিক্ষার্থীদের সাথে এই কোড শেয়ার করুন</p>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'ঠিক আছে'
            }).then(() => {
                Teacher.loadGroupsForSwitcher();
                Teacher.manageGroupsView();
            });
            
        } catch (error) {
            Swal.fire('ত্রুটি', 'কোর্স তৈরি ব্যর্থ: ' + error.message, 'error');
        }
    },
    
    manageGroupsView: async () => {
        document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <div class="flex items-center gap-3 mb-6">
                <button onclick="Router.teacher(AppState.currentPage)" class="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text">
                    <i class="fas fa-arrow-left"></i> ফিরে যান
                </button>
                <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">কোর্স ব্যবস্থাপনা</h2>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-1">
                    <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary sticky top-4">
                        <h3 class="font-bold text-base mb-4 dark:text-white bengali-text flex items-center gap-2"><i class="fas fa-plus-circle text-indigo-600"></i> নতুন কোর্স তৈরি</h3>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">কোর্সের নাম</label>
                                <input type="text" id="group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm" placeholder="যেমনঃ ক্লাস ১০ ব্যাচ-১">
                            </div>
                            <button onclick="Teacher.createGroupFromInput()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg text-sm hover:opacity-90 transition bengali-text">
                                <i class="fas fa-plus mr-2"></i>কোর্স তৈরি
                            </button>
                        </div>
                    </div>
                </div>
                <div class="lg:col-span-2">
                    <div id="groups-container">
                        <div class="text-center p-8 text-slate-400 bengali-text">কোর্স লোড হচ্ছে...</div>
                    </div>
                </div>
            </div>
        </div>`;
        
        await Teacher.loadTeacherGroups();
    },
    
    createGroupFromInput: async () => {
        const name = document.getElementById('group-name').value.trim();
        if (!name) {
            Swal.fire('ত্রুটি', 'কোর্সের নাম আবশ্যক', 'error');
            return;
        }
        await Teacher.createGroup(name);
    },
    
    loadTeacherGroups: async () => {
        try {
            const groupsQuery = query(collection(db, "groups"), 
                where("teacherId", "==", AppState.currentUser.id),
                where("archived", "==", false),
                orderBy("createdAt", "desc"));
            const groupsSnap = await getDocs(groupsQuery);
            
            const groups = [];
            groupsSnap.forEach(doc => {
                groups.push({ id: doc.id, ...doc.data() });
            });
            
            Teacher.teacherGroups = groups;
            
            if (groups.length === 0) {
                document.getElementById('groups-container').innerHTML = `
                    <div class="text-center p-4 text-slate-400 bengali-text">
                        কোনো সক্রিয় কোর্স পাওয়া যায়নি
                    </div>
                `;
                return;
            }
            
            let html = '<div class="group-grid">';
            
            for (let group of groups) {
                let pendingCount = 0;
                try {
                    const reqQ = query(collection(db, "join_requests"), where("groupId", "==", group.id), where("status", "==", "pending"));
                    const reqSnap = await getDocs(reqQ);
                    pendingCount = reqSnap.size;
                } catch(e) {}
                
                let disabledCount = 0;
                let blockedCount = 0;
                let activeCount = 0;

                if (group.studentIds && group.studentIds.length > 0) {
                    try {
                        const batches = [];
                        const chunk = 10;
                        for (let i = 0; i < group.studentIds.length; i += chunk) {
                            const slice = group.studentIds.slice(i, i + chunk);
                            if(slice.length > 0) {
                                const stQ = query(collection(db, "students"), where("__name__", "in", slice));
                                batches.push(getDocs(stQ));
                            }
                        }
                        const snaps = await Promise.all(batches);
                        snaps.forEach(snap => {
                            snap.forEach(d => {
                                const s = d.data();
                                if (s.disabled) disabledCount++;
                                else if (s.blocked) blockedCount++;
                                else activeCount++;
                            });
                        });
                    } catch(e){
                        console.warn("বিস্তারিত শিক্ষার্থী পরিসংখ্যান আনতে ব্যর্থ", e);
                    }
                }

                html += `
                    <div class="group-card" onclick="Teacher.viewGroupStudents('${group.id}')">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-bold text-lg dark:text-white bengali-text group-hover:text-indigo-600 transition">${group.name}</h3>
                            </div>
                            <div class="three-dot-menu relative">
                                <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleGroupMenu('${group.id}')">
                                    <i class="fas fa-ellipsis-v text-slate-400"></i>
                                </button>
                                <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="group-menu-${group.id}">
                                    <div class="menu-item rename dark:text-purple-400 bengali-text" onclick="event.stopPropagation(); Teacher.renameGroup('${group.id}', '${group.name}')">
                                        <i class="fas fa-pencil-alt"></i>
                                        পুনঃনামকরণ
                                    </div>
                                    <div class="menu-item archive dark:text-amber-400 bengali-text" onclick="event.stopPropagation(); Teacher.archiveGroupConfirm('${group.id}', '${group.groupCode}')">
                                        <i class="fas fa-archive"></i>
                                        আর্কাইভে সরান
                                    </div>
                                    <div class="menu-item delete dark:text-red-400 bengali-text" onclick="event.stopPropagation(); Teacher.deleteGroupConfirm('${group.id}', '${group.groupCode}')">
                                        <i class="fas fa-trash"></i>
                                        মুছে ফেলুন
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="group-code-container" onclick="event.stopPropagation();">
                            <span class="group-code-text">${group.groupCode}</span>
                            <button onclick="Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>

                        <div class="grid grid-cols-4 gap-2 mt-4 text-center text-[10px] uppercase font-bold tracking-wider">
                            <div class="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded border border-indigo-100 dark:border-indigo-800">
                                <span class="font-black block text-indigo-700 dark:text-indigo-400 text-sm mb-0.5">${group.studentIds ? group.studentIds.length : 0}</span>
                                <span class="text-slate-500">মোট</span>
                            </div>
                            <div class="bg-amber-50 dark:bg-amber-900/30 p-2 rounded border border-amber-100 dark:border-amber-800">
                                <span class="font-black block text-amber-700 dark:text-amber-400 text-sm mb-0.5">${pendingCount}</span>
                                <span class="text-slate-500">অপেক্ষমান</span>
                            </div>
                            <div class="bg-slate-100 dark:bg-dark-tertiary p-2 rounded border border-slate-200 dark:border-slate-700">
                                <span class="font-black block text-slate-700 dark:text-slate-400 text-sm mb-0.5">${disabledCount}</span>
                                <span class="text-slate-500">নিষ্ক্রিয়</span>
                            </div>
                            <div class="bg-red-50 dark:bg-red-900/30 p-2 rounded border border-red-100 dark:border-red-800">
                                <span class="font-black block text-red-700 dark:text-red-400 text-sm mb-0.5">${blockedCount}</span>
                                <span class="text-slate-500">ব্লক</span>
                            </div>
                        </div>
                        
                        <div class="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-dark-tertiary text-center">
                            তৈরি: ${moment(group.createdAt?.toDate()).format('DD MMM YYYY')}
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            
            document.getElementById('groups-container').innerHTML = html;
        } catch (error) {
            console.error('কোর্স লোড করতে ত্রুটি:', error);
            document.getElementById('groups-container').innerHTML = '<div class="text-center p-4 text-red-500 bengali-text">কোর্স লোড করতে ত্রুটি</div>';
        }
    },
    
    toggleGroupMenu: (groupId) => {
        event.stopPropagation();
        document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
            if (dropdown.id !== `group-menu-${groupId}`) {
                dropdown.classList.remove('show');
            }
        });
        
        const menu = document.getElementById(`group-menu-${groupId}`);
        if (menu) {
            menu.classList.toggle('show');
        }
    },
    
    toggleGroupSetting: async (groupId, setting, value) => {
        try {
            await updateDoc(doc(db, "groups", groupId), {
                [setting]: value,
                updatedAt: new Date()
            });
            
            const group = Teacher.teacherGroups.find(g => g.id === groupId);
            if (group) {
                group[setting] = value;
            }
        } catch (error) {
            Swal.fire('ত্রুটি', 'সেটিং আপডেট ব্যর্থ: ' + error.message, 'error');
        }
    },
    
    viewGroupStudents: async (groupId, initialFilter = 'all') => {
        try {
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (!groupDoc.exists()) return;
            
            const group = { id: groupDoc.id, ...groupDoc.data() };
            
            document.getElementById('app-container').innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div></div>';
            
            let students = [];
            if (group.studentIds && group.studentIds.length > 0) {
                const studentPromises = group.studentIds.map(async (studentId) => {
                    try {
                        const studentDoc = await getDoc(doc(db, "students", studentId));
                        if (studentDoc.exists()) {
                            const studentData = studentDoc.data();
                            return { 
                                id: studentDoc.id, 
                                ...studentData, 
                                status: 'active',
                                fullName: studentData.fullName || studentData.name || '',
                                email: studentData.email || '',
                                phone: studentData.phone || '',
                                fatherPhone: studentData.fatherPhone || '',
                                motherPhone: studentData.motherPhone || '',
                                schoolName: studentData.schoolName || '',
                                collegeName: studentData.collegeName || '',
                                disabled: studentData.disabled || false,
                                blocked: studentData.blocked || false
                            };
                        }
                    } catch (error) {
                        console.error('শিক্ষার্থী লোড করতে ত্রুটি:', error);
                    }
                    return null;
                });
                
                const studentResults = await Promise.all(studentPromises);
                students = studentResults.filter(s => s !== null);
            }
            
            const requestsQuery = query(collection(db, "join_requests"), 
                where("groupId", "==", groupId),
                where("status", "==", "pending"));
            const requestsSnap = await getDocs(requestsQuery);
            
            const pendingStudents = [];
            requestsSnap.forEach(doc => {
                const request = doc.data();
                pendingStudents.push({
                    id: doc.id,
                    studentId: request.studentId,
                    studentName: request.studentName,
                    studentEmail: request.studentEmail,
                    requestedAt: request.requestedAt,
                    status: 'pending'
                });
            });
            
            const allStudents = [
                ...students.map(s => ({ ...s, status: 'active' })),
                ...pendingStudents.map(p => ({ 
                    id: p.id, 
                    studentId: p.studentId,
                    fullName: p.studentName,
                    email: p.studentEmail,
                    requestedAt: p.requestedAt,
                    status: 'pending'
                }))
            ];
            
            window.currentGroupStudents = allStudents;
            window.currentGroupId = groupId;
            
            document.getElementById('app-container').innerHTML = `
            <div class="pb-6">
                <button onclick="Router.teacher(AppState.currentPage)" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 bengali-text">
                    <i class="fas fa-arrow-left"></i> ফিরে যান
                </button>
                
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h2 class="text-xl font-bold font-en text-slate-800 dark:text-white bengali-text">${group.name}</h2>
                        <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text">${allStudents.length} জন ব্যবহারকারী</p>
                    </div>
                    <div class="group-code-container mt-0">
                        <span class="group-code-text">${group.groupCode}</span>
                        <button onclick="Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                <div class="bg-white dark:bg-dark-secondary rounded-xl p-4 mb-6 shadow-sm border dark:border-dark-tertiary">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-medium dark:text-white bengali-text">যোগদান সক্রিয়</span>
                            <label class="toggle-switch">
                                <input type="checkbox" ${group.joinEnabled ? 'checked' : ''} 
                                       onchange="Teacher.toggleGroupSetting('${group.id}', 'joinEnabled', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="flex items-center justify-between border-l border-slate-100 dark:border-dark-tertiary pl-4">
                            <span class="text-sm font-medium dark:text-white bengali-text">অনুমোদন প্রয়োজন</span>
                            <label class="toggle-switch">
                                <input type="checkbox" ${group.approvalRequired ? 'checked' : ''} 
                                       onchange="Teacher.toggleGroupSetting('${group.id}', 'approvalRequired', this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="search-bar-container mb-6">
                    <input type="text" id="student-search-input" class="search-bar-input w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="নাম, ফোন, ইমেইল, পিতা/মাতার নাম্বার বা প্রতিষ্ঠানের নাম লিখুন...">
                    <i class="search-icon fas fa-search"></i>
                    <button class="clear-search-btn" onclick="Teacher.clearStudentSearch()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="filter-tabs" id="student-filter-tabs">
                    <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('all')">সব (${allStudents.length})</div>
                    <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('active')">সক্রিয় (${students.length})</div>
                    <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('pending')">অপেক্ষমান (${pendingStudents.length})</div>
                    <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('disabled')">নিষ্ক্রিয় (${students.filter(s => s.disabled).length})</div>
                    <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('blocked')">ব্লক (${students.filter(s => s.blocked).length})</div>
                </div>
                
                <div class="student-list-container" id="student-list">
                </div>
            </div>`;
            
            document.getElementById('student-search-input').addEventListener('input', Teacher.searchStudents);
            Teacher.filterStudents(initialFilter);
            
        } catch (error) {
            console.error('কোর্সের শিক্ষার্থী লোড করতে ত্রুটি:', error);
            document.getElementById('app-container').innerHTML = '<div class="text-center p-10 text-red-500 bengali-text">শিক্ষার্থী লোড করতে ত্রুটি</div>';
        }
    },
    
    renderStudentList: function(students) {
        if (students.length === 0) {
            return `
                <div class="text-center p-10 text-slate-400">
                    <i class="fas fa-users text-4xl mb-4 opacity-30"></i>
                    <p class="bengali-text">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
                </div>
            `;
        }
        
        return students.map(student => {
            let statusClass = 'status-active';
            let statusText = 'সক্রিয়';
            
            if (student.status === 'pending') {
                statusClass = 'status-pending';
                statusText = 'অপেক্ষমান';
            } else if (student.disabled) {
                statusClass = 'status-disabled';
                statusText = 'নিষ্ক্রিয়';
            } else if (student.blocked) {
                statusClass = 'status-blocked';
                statusText = 'ব্লক';
            }
            
            return `
                <div class="student-item">
                    <div onclick="Teacher.viewStudentProfile('${student.studentId || student.id}', '${window.currentGroupId}')" class="flex-1 cursor-pointer">
                        <div class="font-bold text-sm dark:text-white bengali-text">${student.fullName || student.name || student.studentName || 'নাম নেই'}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400">${student.email || student.studentEmail}</div>
                        <div class="text-[10px] text-indigo-500 font-bold mt-1 bengali-text">
                            ${student.schoolName || student.collegeName || ''}
                            ${student.phone ? '• ' + student.phone : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="student-status ${statusClass} bengali-text">${statusText}</span>
                        ${student.status === 'pending' ? `
                            <div class="flex gap-2">
                                <button onclick="event.stopPropagation(); Teacher.approveStudentRequest('${student.id}', '${window.currentGroupId}')" class="text-xs bg-emerald-600 text-white px-2 py-1 rounded bengali-text">
                                    অনুমোদন
                                </button>
                                <button onclick="event.stopPropagation(); Teacher.rejectStudentRequest('${student.id}', '${window.currentGroupId}')" class="text-xs bg-red-600 text-white px-2 py-1 rounded bengali-text">
                                    প্রত্যাখ্যান
                                </button>
                            </div>
                        ` : student.status === 'active' ? `
                            <div class="student-three-dot-menu relative">
                                <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleStudentMenu('${student.studentId || student.id}')">
                                    <i class="fas fa-ellipsis-v text-slate-400"></i>
                                </button>
                                <div class="dot-menu-dropdown student-dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="student-menu-${student.studentId || student.id}">
                                    <div class="menu-item ${student.disabled ? 'enable' : 'disable'} bengali-text" onclick="event.stopPropagation(); Teacher.toggleStudentStatus('${student.studentId || student.id}', 'disabled', ${!student.disabled}, '${window.currentGroupId}')">
                                        <i class="fas ${student.disabled ? 'fa-check-circle' : 'fa-ban'}"></i>
                                        ${student.disabled ? 'সক্রিয় করুন' : 'নিষ্ক্রিয় করুন'}
                                    </div>
                                    <div class="menu-item ${student.blocked ? 'unblock' : 'block'} bengali-text" onclick="event.stopPropagation(); Teacher.toggleStudentStatus('${student.studentId || student.id}', 'blocked', ${!student.blocked}, '${window.currentGroupId}')">
                                        <i class="fas ${student.blocked ? 'fa-unlock' : 'fa-lock'}"></i>
                                        ${student.blocked ? 'আনব্লক করুন' : 'ব্লক করুন'}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    searchStudents: function() {
        const searchInput = document.getElementById('student-search-input');
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            Teacher.filterStudents(window.currentFilter || 'all');
            return;
        }
        
        const filteredStudents = window.currentGroupStudents.filter(student => {
            const name = (student.fullName || student.name || student.studentName || '').toLowerCase();
            const email = (student.email || student.studentEmail || '').toLowerCase();
            const phone = (student.phone || '').toLowerCase();
            const fatherPhone = (student.fatherPhone || '').toLowerCase();
            const motherPhone = (student.motherPhone || '').toLowerCase();
            const school = (student.schoolName || '').toLowerCase();
            const college = (student.collegeName || '').toLowerCase();
            
            return name.includes(searchTerm) || 
                   email.includes(searchTerm) || 
                   phone.includes(searchTerm) ||
                   fatherPhone.includes(searchTerm) ||
                   motherPhone.includes(searchTerm) ||
                   school.includes(searchTerm) ||
                   college.includes(searchTerm);
        });
        
        document.getElementById('student-list').innerHTML = Teacher.renderStudentList(filteredStudents);
    },
    
    clearStudentSearch: function() {
        document.getElementById('student-search-input').value = '';
        Teacher.filterStudents(window.currentFilter || 'all');
    },
    
    toggleStudentMenu: function(studentId) {
        document.querySelectorAll('.student-dot-menu-dropdown').forEach(dropdown => {
            if (dropdown.id !== `student-menu-${studentId}`) {
                dropdown.classList.remove('show');
            }
        });
        
        const menu = document.getElementById(`student-menu-${studentId}`);
        if (menu) {
            menu.classList.toggle('show');
        }
    },
    
    viewStudentProfile: async (studentId, groupId) => {
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
    },

    enableStudentEdit: function() {
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
    },
    
    updateStudentProfileByTeacher: async (studentId, groupId) => {
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
    },
    
    filterStudents: function(filter) {
        window.currentFilter = filter;
        const tabs = document.querySelectorAll('#student-filter-tabs .filter-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if(tab.textContent.toLowerCase().includes(filter.toLowerCase())) {
                tab.classList.add('active');
            }
        });
        
        let filteredStudents = [];
        
        if (filter === 'all') {
            filteredStudents = window.currentGroupStudents;
        } else if (filter === 'active') {
            filteredStudents = window.currentGroupStudents.filter(s => s.status === 'active' && !s.disabled && !s.blocked);
        } else if (filter === 'pending') {
            filteredStudents = window.currentGroupStudents.filter(s => s.status === 'pending');
        } else if (filter === 'disabled') {
            filteredStudents = window.currentGroupStudents.filter(s => s.disabled);
        } else if (filter === 'blocked') {
            filteredStudents = window.currentGroupStudents.filter(s => s.blocked);
        }
        
        const searchInput = document.getElementById('student-search-input');
        if (searchInput && searchInput.value.trim()) {
            const searchTerm = searchInput.value.toLowerCase().trim();
            filteredStudents = filteredStudents.filter(student => {
                const name = (student.fullName || student.name || student.studentName || '').toLowerCase();
                const email = (student.email || student.studentEmail || '').toLowerCase();
                const phone = (student.phone || '').toLowerCase();
                const fatherPhone = (student.fatherPhone || '').toLowerCase();
                const motherPhone = (student.motherPhone || '').toLowerCase();
                const school = (student.schoolName || '').toLowerCase();
                const college = (student.collegeName || '').toLowerCase();
                
                return name.includes(searchTerm) || 
                       email.includes(searchTerm) || 
                       phone.includes(searchTerm) ||
                       fatherPhone.includes(searchTerm) ||
                       motherPhone.includes(searchTerm) ||
                       school.includes(searchTerm) ||
                       college.includes(searchTerm);
            });
        }
        
        document.getElementById('student-list').innerHTML = Teacher.renderStudentList(filteredStudents);
    },
    
    toggleStudentStatus: async (studentId, status, value, groupId) => {
        try {
            await updateDoc(doc(db, "students", studentId), {
                [status]: value,
                updatedAt: new Date()
            });
            
            const menu = document.getElementById(`student-menu-${studentId}`);
            if (menu) {
                menu.classList.remove('show');
            }
            
            Swal.fire('সফল', `শিক্ষার্থী ${status} ${value ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`, 'success').then(() => {
                Teacher.viewGroupStudents(groupId);
            });
        } catch (error) {
            Swal.fire('ত্রুটি', 'শিক্ষার্থীর অবস্থা আপডেট করতে ব্যর্থ', 'error');
        }
    },
    
    removeStudentFromGroup: async (studentId, groupId) => {
        const result = await Swal.fire({
            title: 'শিক্ষার্থী অপসারণ?',
            text: "এই শিক্ষার্থী কোর্স থেকে অপসারিত হবে",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'অপসারণ'
        });
        
        if (result.isConfirmed) {
            try {
                const groupDoc = await getDoc(doc(db, "groups", groupId));
                if (groupDoc.exists()) {
                    const group = groupDoc.data();
                    const updatedStudentIds = group.studentIds.filter(id => id !== studentId);
                    
                    await updateDoc(doc(db, "groups", groupId), {
                        studentIds: updatedStudentIds,
                        updatedAt: new Date()
                    });
                    
                    Swal.fire('অপসারিত!', 'শিক্ষার্থী কোর্স থেকে অপসারিত হয়েছে', 'success').then(() => {
                        Teacher.viewGroupStudents(groupId);
                    });
                }
            } catch (error) {
                Swal.fire('ত্রুটি', 'শিক্ষার্থী অপসারণ করতে ব্যর্থ', 'error');
            }
        }
    },
    
    approveStudentRequest: async (requestId, groupId) => {
        try {
            const requestDoc = await getDoc(doc(db, "join_requests", requestId));
            if (!requestDoc.exists()) return;
            
            const request = requestDoc.data();
            
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists()) {
                await updateDoc(doc(db, "groups", groupId), {
                    studentIds: arrayUnion(request.studentId),
                    updatedAt: new Date()
                });
            }
            
            await updateDoc(doc(db, "join_requests", requestId), {
                status: 'approved',
                approvedAt: new Date(),
                approvedBy: AppState.currentUser.id
            });
            
            Swal.fire('অনুমোদিত!', 'শিক্ষার্থী কোর্সে যোগ করা হয়েছে', 'success').then(() => {
                Teacher.viewGroupStudents(groupId);
            });
        } catch (error) {
            Swal.fire('ত্রুটি', 'অনুরোধ অনুমোদন করতে ব্যর্থ', 'error');
        }
    },
    
    rejectStudentRequest: async (requestId, groupId) => {
        const result = await Swal.fire({
            title: 'অনুরোধ প্রত্যাখ্যান?',
            text: "এই অনুরোধ প্রত্যাখ্যান করা হবে",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'প্রত্যাখ্যান'
        });
        
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, "join_requests", requestId), {
                    status: 'rejected',
                    rejectedAt: new Date(),
                    rejectedBy: AppState.currentUser.id
                });
                
                Swal.fire('প্রত্যাখ্যাত!', 'অনুরোধ প্রত্যাখ্যান করা হয়েছে', 'success').then(() => {
                    Teacher.viewGroupStudents(groupId);
                });
            } catch (error) {
                Swal.fire('ত্রুটি', 'অনুরোধ প্রত্যাখ্যান করতে ব্যর্থ', 'error');
            }
        }
    },
    
    renameGroup: async (groupId, currentName) => {
        const { value: newName } = await Swal.fire({
            title: 'কোর্স পুনঃনামকরণ',
            input: 'text',
            inputLabel: 'নতুন কোর্সের নাম',
            inputValue: currentName,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'নতুন নাম দিতে হবে!';
            }
        });
        
        if (newName && newName !== currentName) {
            try {
                await updateDoc(doc(db, "groups", groupId), {
                    name: newName,
                    updatedAt: new Date()
                });
                
                Swal.fire('সফল', 'কোর্স পুনঃনামকরণ করা হয়েছে', 'success');
                Teacher.loadTeacherGroups();
                Teacher.loadGroupsForSwitcher();
            } catch (error) {
                Swal.fire('ত্রুটি', 'কোর্স পুনঃনামকরণ ব্যর্থ: ' + error.message, 'error');
            }
        }
    },
    
    archiveGroupConfirm: async (groupId, groupCode) => {
        const { value: enteredCode } = await Swal.fire({
            title: 'কোর্স আর্কাইভ করবেন?',
            text: "নিশ্চিত করতে কোর্স কোড লিখুন",
            input: 'text',
            inputPlaceholder: 'কোর্স কোড লিখুন',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'আর্কাইভ',
            inputValidator: (value) => {
                if (!value) return 'কোর্স কোড দিতে হবে!';
                if (value !== groupCode) return 'কোর্স কোড মিলছে না!';
            }
        });
        
        if (enteredCode === groupCode) {
            try {
                await updateDoc(doc(db, "groups", groupId), {
                    archived: true,
                    updatedAt: new Date()
                });
                
                if (AppState.selectedGroup && AppState.selectedGroup.id === groupId) {
                    AppState.selectedGroup = null;
                    localStorage.removeItem('selectedGroup');
                }
                
                Swal.fire('আর্কাইভড!', 'কোর্স আর্কাইভে সরানো হয়েছে।', 'success');
                Teacher.loadTeacherGroups();
                Teacher.loadGroupsForSwitcher();
            } catch (error) {
                Swal.fire('ত্রুটি', 'কোর্স আর্কাইভ করতে ব্যর্থ: ' + error.message, 'error');
            }
        }
    },
    
    deleteGroupConfirm: async (groupId, groupCode) => {
        const { value: enteredCode } = await Swal.fire({
            title: 'কোর্স মুছে ফেলবেন?',
            text: "এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না। নিশ্চিত করতে কোর্স কোড লিখুন",
            input: 'text',
            inputPlaceholder: 'কোর্স কোড লিখুন',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'মুছে ফেলুন',
            inputValidator: (value) => {
                if (!value) return 'কোর্স কোড দিতে হবে!';
                if (value !== groupCode) return 'কোর্স কোড মিলছে না!';
            }
        });
        
        if (enteredCode === groupCode) {
            try {
                await deleteDoc(doc(db, "groups", groupId));
                
                if (AppState.selectedGroup && AppState.selectedGroup.id === groupId) {
                    AppState.selectedGroup = null;
                    localStorage.removeItem('selectedGroup');
                }
                
                Swal.fire('মুছে ফেলা হয়েছে!', 'কোর্স মুছে ফেলা হয়েছে।', 'success');
                Teacher.loadTeacherGroups();
                Teacher.loadGroupsForSwitcher();
            } catch (error) {
                Swal.fire('ত্রুটি', 'কোর্স মুছে ফেলতে ব্যর্থ: ' + error.message, 'error');
            }
        }
    },
    
    archiveGroupsView: async () => {
        document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <div class="flex items-center gap-3 mb-6">
                <button onclick="Teacher.managementView()" class="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text">
                    <i class="fas fa-arrow-left"></i> ফিরে যান
                </button>
                <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">আর্কাইভ কোর্স</h2>
            </div>
            
            <div id="archive-groups-container">
                <div class="text-center p-4 text-slate-400 bengali-text">আর্কাইভকৃত কোর্স লোড হচ্ছে...</div>
            </div>
        </div>`;
        
        await Teacher.loadArchiveGroups();
    },
    
    loadArchiveGroups: async () => {
        try {
            const groupsQuery = query(collection(db, "groups"), 
                where("teacherId", "==", AppState.currentUser.id),
                where("archived", "==", true),
                orderBy("createdAt", "desc"));
            const groupsSnap = await getDocs(groupsQuery);
            
            const groups = [];
            groupsSnap.forEach(doc => {
                groups.push({ id: doc.id, ...doc.data() });
            });
            
            if (groups.length === 0) {
                document.getElementById('archive-groups-container').innerHTML = `
                    <div class="text-center p-10">
                        <div class="w-16 h-16 bg-slate-100 dark:bg-dark-tertiary rounded-full flex items-center justify-center text-slate-400 text-2xl mb-4 mx-auto">
                            <i class="fas fa-archive"></i>
                        </div>
                        <h3 class="font-bold text-lg dark:text-white mb-2 bengali-text">কোনো আর্কাইভকৃত কোর্স নেই</h3>
                        <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text">আপনার এখনো কোনো আর্কাইভকৃত কোর্স নেই</p>
                    </div>
                `;
                return;
            }
            
            let html = '<div class="group-grid">';
            
            groups.forEach(group => {
                html += `
                    <div class="group-card">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-bold text-lg dark:text-white bengali-text">${group.name}</h3>
                                <p class="text-xs text-slate-500 dark:text-slate-400 bengali-text">${group.studentIds ? group.studentIds.length : 0} জন শিক্ষার্থী</p>
                            </div>
                            <div class="three-dot-menu relative">
                                <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleArchiveGroupMenu('${group.id}')">
                                    <i class="fas fa-ellipsis-v text-slate-400"></i>
                                </button>
                                <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="archive-group-menu-${group.id}">
                                    <div class="menu-item restore dark:text-emerald-400 bengali-text" onclick="event.stopPropagation(); Teacher.restoreGroupConfirm('${group.id}', '${group.groupCode}')">
                                        <i class="fas fa-undo"></i>
                                        পুনরুদ্ধার
                                    </div>
                                    <div class="menu-item delete dark:text-red-400 bengali-text" onclick="event.stopPropagation(); Teacher.deleteGroupConfirm('${group.id}', '${group.groupCode}')">
                                        <i class="fas fa-trash"></i>
                                        মুছে ফেলুন
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="group-code-container">
                            <span class="group-code-text">${group.groupCode}</span>
                            <button onclick="event.stopPropagation(); Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-3">
                            তৈরি: ${moment(group.createdAt?.toDate()).format('DD MMM YYYY')}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            document.getElementById('archive-groups-container').innerHTML = html;
        } catch (error) {
            console.error('আর্কাইভ গ্রুপ লোড করতে ত্রুটি:', error);
            document.getElementById('archive-groups-container').innerHTML = '<div class="text-center p-4 text-red-500 bengali-text">আর্কাইভ কোর্স লোড করতে ত্রুটি</div>';
        }
    },
    
    toggleArchiveGroupMenu: (groupId) => {
        event.stopPropagation();
        document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
            if (dropdown.id !== `archive-group-menu-${groupId}`) {
                dropdown.classList.remove('show');
            }
        });
        
        const menu = document.getElementById(`archive-group-menu-${groupId}`);
        if (menu) {
            menu.classList.toggle('show');
        }
    },
    
    restoreGroupConfirm: async (groupId, groupCode) => {
        const { value: enteredCode } = await Swal.fire({
            title: 'কোর্স পুনরুদ্ধার করবেন?',
            text: "নিশ্চিত করতে কোর্স কোড লিখুন",
            input: 'text',
            inputPlaceholder: 'কোর্স কোড লিখুন',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'পুনরুদ্ধার',
            inputValidator: (value) => {
                if (!value) return 'কোর্স কোড দিতে হবে!';
                if (value !== groupCode) return 'কোর্স কোড মিলছে না!';
            }
        });
        
        if (enteredCode === groupCode) {
            try {
                await updateDoc(doc(db, "groups", groupId), {
                    archived: false,
                    updatedAt: new Date()
                });
                
                Swal.fire('পুনরুদ্ধার করা হয়েছে!', 'কোর্স পুনরুদ্ধার করা হয়েছে।', 'success');
                Teacher.loadArchiveGroups();
                Teacher.loadGroupsForSwitcher();
            } catch (error) {
                Swal.fire('ত্রুটি', 'কোর্স পুনরুদ্ধার করতে ব্যর্থ: ' + error.message, 'error');
            }
        }
    }
};

// গ্লোবাল এক্সপোজ
window.Teacher = Teacher;
window.saveFolderStructureToFirebase = saveFolderStructureToFirebase;
window.initRealTimeSync = initRealTimeSync;
window.clearListeners = clearListeners;
