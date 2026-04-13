// js/teacher/teacher-core.js
// Teacher অবজেক্টের বেস স্কেলিটন, প্রপার্টি এবং কমন হেল্পার মেথড

import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, doc, getDoc, updateDoc, deleteDoc, 
    query, where, getDocs, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { saveFolderStructureToFirebase, initRealTimeSync } from '../features/realtime-sync.js';

// গ্লোবাল ভেরিয়েবল রেফারেন্স
let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;
let unsubscribes = window.unsubscribes;

export const Teacher = {
    // ------------- প্রপার্টি -------------
    questions: [],
    currentQuestion: null,
    selectedFolder: null,
    teacherGroups: [],
    topScorerId: null,
    topAccuracyId: null,
    
    // ------------- মোবাইল সাইডবার -------------
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
    
    // ------------- গ্রুপ সুইচার -------------
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

    // ------------- সিলেক্ট গ্রুপ ভিউ -------------
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

    // ------------- থ্রি-ডট মেনু -------------
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

    // ------------- ফোল্ডার সিঙ্ক -------------
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
    
    // ------------- পাবলিশ -------------
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
    
    // ------------- অন্যান্য কমন ফাংশন (যেগুলো বিভিন্ন জায়গায় ব্যবহৃত হয়) -------------
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
                        if (typeof Teacher.renderActiveLiveExamOnHome === 'function') {
                            Teacher.renderActiveLiveExamOnHome(examId);
                        }
                    } else if (AppState.currentPage === 'management') {
                        if (typeof Teacher.liveExamManagementView === 'function') {
                            Teacher.liveExamManagementView();
                        }
                    }
                });
            } catch (e) {
                Swal.fire('ত্রুটি', 'সময় বাড়াতে ব্যর্থ: ' + e.message, 'error');
            }
        }
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
                if (typeof Teacher.manageGroupsView === 'function') {
                    Teacher.manageGroupsView();
                }
            });
            
        } catch (error) {
            Swal.fire('ত্রুটি', 'কোর্স তৈরি ব্যর্থ: ' + error.message, 'error');
        }
    },
    
    createGroupFromInput: async () => {
        const name = document.getElementById('group-name').value.trim();
        if (!name) {
            Swal.fire('ত্রুটি', 'কোর্সের নাম আবশ্যক', 'error');
            return;
        }
        await Teacher.createGroup(name);
    }
};

// গ্লোবাল এক্সপোজ
window.Teacher = Teacher;
