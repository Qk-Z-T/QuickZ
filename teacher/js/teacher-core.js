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

    // এই ফাইলটি অত্যন্ত বড়, বাকি মেথডগুলো তৃতীয় অংশে যোগ করা হবে।
    // এখানে শুধু প্রয়োজনীয় কিছু মেথডের স্কেলিটন রাখা হলো, তৃতীয় অংশে সম্পূর্ণ কোড দেওয়া হবে।
    
    renderForm: function(type) {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    switchQuestionMode: function(mode) {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    addQuestionToList: function() {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    updateQuestionsList: function() {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    createExam: async function(isDraft) {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    foldersView: function() {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    rankView: function() {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    managementView: function() {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    noticeManagementView: function() {
        // তৃতীয় অংশে সম্পূর্ণ
    },
    
    // অন্যান্য মেথড তৃতীয় অংশে
};

// গ্লোবাল এক্সপোজ
window.Teacher = Teacher;
window.saveFolderStructureToFirebase = saveFolderStructureToFirebase;
window.initRealTimeSync = initRealTimeSync;
window.clearListeners = clearListeners;
