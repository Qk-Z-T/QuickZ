// js/teacher/dashboard.js
// হোমপেজ / ড্যাশবোর্ড সম্পর্কিত ফিচার (ক্যাশিং ও ম্যানুয়াল রিফ্রেশ সহ)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, getDocs, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let ExamCache = window.ExamCache;

// ---------- ক্যাশ স্টোরেজ ----------
const homeStatsCache = {
    studentCount: null,
    pendingCount: null,
    liveExamsCount: null,
    mockExamsCount: null,
    groupCode: null,
    activeLiveExam: null,
    lastFetched: null
};

// ---------- হেল্পার: একটি নির্দিষ্ট স্ট্যাট রিফ্রেশ করা ----------
async function refreshStat(statName) {
    if (!AppState.selectedGroup) return null;
    
    const groupId = AppState.selectedGroup.id;
    
    try {
        if (statName === 'student' || statName === 'pending' || statName === 'groupCode') {
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists()) {
                const data = groupDoc.data();
                homeStatsCache.studentCount = data.studentIds ? data.studentIds.length : 0;
                homeStatsCache.groupCode = data.groupCode;
            }
        }
        
        if (statName === 'pending') {
            const reqQ = query(collection(db, "join_requests"), where("groupId", "==", groupId), where("status", "==", "pending"));
            const reqSnap = await getDocs(reqQ);
            homeStatsCache.pendingCount = reqSnap.size;
        }
        
        if (statName === 'exams') {
            const examsQ = query(collection(db, "exams"), where("groupId", "==", groupId));
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
            
            homeStatsCache.liveExamsCount = liveExams;
            homeStatsCache.mockExamsCount = mockExams;
            homeStatsCache.activeLiveExam = activeLiveExam;
        }
        
        homeStatsCache.lastFetched = new Date();
    } catch (e) {
        console.error(`Error refreshing stat ${statName}:`, e);
        throw e;
    }
}

// ---------- প্রাথমিক সব ডেটা ফেচ (শুধু প্রথমবার) ----------
async function fetchAllHomeStats() {
    if (!AppState.selectedGroup) return;
    
    const groupId = AppState.selectedGroup.id;
    
    try {
        // গ্রুপ ডেটা
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
            const data = groupDoc.data();
            homeStatsCache.studentCount = data.studentIds ? data.studentIds.length : 0;
            homeStatsCache.groupCode = data.groupCode;
        }
        
        // পেন্ডিং রিকোয়েস্ট
        const reqQ = query(collection(db, "join_requests"), where("groupId", "==", groupId), where("status", "==", "pending"));
        const reqSnap = await getDocs(reqQ);
        homeStatsCache.pendingCount = reqSnap.size;
        
        // পরীক্ষা সংখ্যা ও চলমান পরীক্ষা
        const examsQ = query(collection(db, "exams"), where("groupId", "==", groupId));
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
        
        homeStatsCache.liveExamsCount = liveExams;
        homeStatsCache.mockExamsCount = mockExams;
        homeStatsCache.activeLiveExam = activeLiveExam;
        homeStatsCache.lastFetched = new Date();
        
    } catch (e) {
        console.error('Error fetching home stats:', e);
    }
}

// ---------- UI রেন্ডার: ক্যাশ থেকে অথবা ফেচ করে ----------
async function renderHomeUI(useCache = true) {
    const c = document.getElementById('app-container');
    
    // যদি ক্যাশ ফাঁকা থাকে, অথবা useCache false হয়, তাহলে ফেচ করো
    if (!useCache || homeStatsCache.studentCount === null) {
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
        await fetchAllHomeStats();
    }
    
    // ক্যাশ থেকে মান নেওয়া
    const studentCount = homeStatsCache.studentCount || 0;
    const pendingCount = homeStatsCache.pendingCount || 0;
    const liveExams = homeStatsCache.liveExamsCount || 0;
    const mockExams = homeStatsCache.mockExamsCount || 0;
    const groupCode = homeStatsCache.groupCode || '';
    const activeLiveExam = homeStatsCache.activeLiveExam;
    
    // মূল HTML
    let html = `
    <div class="pb-6">
        <div class="flex justify-between items-center mb-6">
            <div>
                <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">ড্যাশবোর্ড হোম</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text mt-1">${AppState.selectedGroup.name} এর সংক্ষিপ্ত বিবরণ</p>
            </div>
        </div>
        <div id="home-active-live-section"></div>
        
        <!-- স্টুডেন্ট কার্ড -->
        <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary shadow-sm mb-6 overflow-hidden">
            <div class="p-5 border-b border-slate-100 dark:border-dark-tertiary flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/10">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-users"></i></div>
                    <div class="font-bold text-lg dark:text-white bengali-text">মোট শিক্ষার্থী</div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400" id="student-count-display">${studentCount}</div>
                    <button onclick="Teacher.refreshHomeStat('student')" class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition flex items-center justify-center" title="রিফ্রেশ">
                        <i class="fas fa-sync-alt text-xs"></i>
                    </button>
                </div>
            </div>
            
            <div class="p-5 border-b border-slate-100 dark:border-dark-tertiary flex justify-between items-center hover:bg-slate-50 dark:hover:bg-dark-tertiary transition">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-broadcast-tower"></i></div>
                    <div class="font-bold text-lg dark:text-white bengali-text">মোট লাইভ পরীক্ষা</div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-2xl font-black text-red-600 dark:text-red-400" id="live-exams-display">${liveExams}</div>
                    <button onclick="Teacher.refreshHomeStat('exams')" class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 transition flex items-center justify-center" title="রিফ্রেশ">
                        <i class="fas fa-sync-alt text-xs"></i>
                    </button>
                </div>
            </div>
            
            <div class="p-5 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-dark-tertiary transition">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-book-reader"></i></div>
                    <div class="font-bold text-lg dark:text-white bengali-text">মোট প্র্যাকটিস পরীক্ষা</div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400" id="mock-exams-display">${mockExams}</div>
                    <button onclick="Teacher.refreshHomeStat('exams')" class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition flex items-center justify-center" title="রিফ্রেশ">
                        <i class="fas fa-sync-alt text-xs"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- কোর্স কার্ড -->
        <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 shadow-lg text-white mb-6 relative overflow-hidden flex items-center justify-between">
            <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 20px 20px;"></div>
            
            <div class="relative z-10">
                <div class="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1 bengali-text">সক্রিয় কোর্স</div>
                <h3 class="text-3xl font-bold bengali-text">${AppState.selectedGroup.name}</h3>
                <div class="flex items-center gap-3 mt-3">
                    <span class="bg-white/20 px-3 py-1.5 rounded-lg text-sm font-mono tracking-wider font-bold" id="group-code-display">
                        কোড: ${groupCode}
                    </span>
                    <button onclick="Teacher.copyGroupCode('${groupCode}')" class="text-white/70 hover:text-white transition bg-white/10 w-8 h-8 rounded flex items-center justify-center">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="Teacher.refreshHomeStat('groupCode')" class="text-white/70 hover:text-white transition bg-white/10 w-8 h-8 rounded flex items-center justify-center" title="রিফ্রেশ">
                        <i class="fas fa-sync-alt text-xs"></i>
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
                <span class="text-4xl font-black text-amber-300 drop-shadow-md" id="pending-count-display">${pendingCount}</span>
                <span class="text-[10px] uppercase font-bold tracking-widest text-indigo-100 mt-1 bengali-text text-center">অপেক্ষমান<br>অনুরোধ</span>
                ${pendingCount > 0 ? '<span class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping"></span><span class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full"></span>' : ''}
            </div>
        </div>
    </div>`;
    
    c.innerHTML = html;
    
    // চলমান পরীক্ষা থাকলে রেন্ডার
    if (activeLiveExam) {
        Teacher.renderActiveLiveExamOnHome(activeLiveExam.id);
    }
}

// ---------- নির্দিষ্ট স্ট্যাট রিফ্রেশ (ইউজার বাটনে ক্লিক করলে) ----------
Teacher.refreshHomeStat = async (statName) => {
    const btn = event.currentTarget;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';
    btn.disabled = true;
    
    try {
        await refreshStat(statName);
        
        // UI আপডেট
        if (statName === 'student' || statName === 'pending' || statName === 'groupCode') {
            const studentDisplay = document.getElementById('student-count-display');
            const pendingDisplay = document.getElementById('pending-count-display');
            const groupCodeDisplay = document.getElementById('group-code-display');
            
            if (studentDisplay) studentDisplay.textContent = homeStatsCache.studentCount || 0;
            if (pendingDisplay) pendingDisplay.textContent = homeStatsCache.pendingCount || 0;
            if (groupCodeDisplay) groupCodeDisplay.textContent = `কোড: ${homeStatsCache.groupCode || ''}`;
            
            // পেন্ডিং ব্যাজ আপডেট
            const pendingBadge = document.querySelector('.backdrop-blur-md .text-4xl');
            if (pendingBadge) pendingBadge.textContent = homeStatsCache.pendingCount || 0;
        }
        
        if (statName === 'exams') {
            const liveDisplay = document.getElementById('live-exams-display');
            const mockDisplay = document.getElementById('mock-exams-display');
            if (liveDisplay) liveDisplay.textContent = homeStatsCache.liveExamsCount || 0;
            if (mockDisplay) mockDisplay.textContent = homeStatsCache.mockExamsCount || 0;
            
            // চলমান পরীক্ষা সেকশন রিফ্রেশ
            const activeContainer = document.getElementById('home-active-live-section');
            if (activeContainer) {
                if (homeStatsCache.activeLiveExam) {
                    await Teacher.renderActiveLiveExamOnHome(homeStatsCache.activeLiveExam.id);
                } else {
                    activeContainer.innerHTML = '';
                }
            }
        }
        
        Swal.fire({
            icon: 'success',
            title: 'আপডেট সম্পন্ন',
            text: 'ডেটা সফলভাবে রিফ্রেশ হয়েছে',
            timer: 1000,
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('ত্রুটি', 'ডেটা রিফ্রেশ করতে ব্যর্থ', 'error');
    } finally {
        btn.innerHTML = originalIcon;
        btn.disabled = false;
    }
};

// ------------- হোম ভিউ (এন্ট্রি পয়েন্ট) -------------
Teacher.homeView = async () => {
    if (!AppState.selectedGroup) {
        Teacher.selectGroupView('home');
        return;
    }

    document.getElementById('floating-math-btn').classList.add('hidden');
    document.getElementById('math-symbols-panel').classList.remove('show');
    
    // UI রেন্ডার (ক্যাশ ব্যবহার করবে যদি থাকে)
    await renderHomeUI(true);
};

// ------------- চলমান পরীক্ষা রেন্ডার (আগের মতোই) -------------
Teacher.renderActiveLiveExamOnHome = async (examId) => {
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
};

// রিয়েল-টাইম সিঙ্ক চলাকালে ক্যাশ আপডেট করা (যাতে ব্যাকগ্রাউন্ডে আপডেট হয়)
// realtime-sync.js এ updateUIRendering ফাংশনে home পেজের জন্য নিচের মত করে কল করা যায়,
// কিন্তু যেহেতু ক্যাশ আপডেটের জন্য আলাদা লজিক দরকার, তাই আমরা একটি গ্লোবাল হুক রাখতে পারি।
// এখানে আমরা স্রেফ homeStatsCache আপডেট করার জন্য একটি এক্সপোর্টেড ফাংশন রাখছি।
Teacher.updateHomeCacheFromRealtime = async () => {
    if (AppState.currentPage === 'home' && AppState.selectedGroup) {
        // ব্যাকগ্রাউন্ডে ক্যাশ রিফ্রেশ করবে, কিন্তু UI রি-রেন্ডার করবে না (ইউজার যদি চায় তাহলে ম্যানুয়ালি করবে)
        await fetchAllHomeStats();
        console.log('Home cache updated from realtime sync');
    }
};
