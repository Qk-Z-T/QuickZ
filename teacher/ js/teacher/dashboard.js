// js/teacher/dashboard.js
// হোমপেজ / ড্যাশবোর্ড সম্পর্কিত ফিচার (রিফ্রেশ বাটন সরানো হয়েছে, পূর্বের মতো)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, getDocs, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let ExamCache = window.ExamCache;

// ------------- হোম ভিউ -------------
Teacher.homeView = async () => {
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
            <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">Dashboard Home</h2>
        </div>
        <div class="text-center p-10">
            <div class="loader mx-auto"></div>
            <p class="mt-2 text-sm text-slate-500 bengali-text">Loading...</p>
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
                    <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">Dashboard Home</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text mt-1">Overview of ${AppState.selectedGroup.name}</p>
                </div>
            </div>
            <div id="home-active-live-section"></div>
            <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary shadow-sm mb-6 overflow-hidden">
                <div class="p-5 border-b border-slate-100 dark:border-dark-tertiary flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/10">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-users"></i></div>
                        <div class="font-bold text-lg dark:text-white bengali-text">Total Students</div>
                    </div>
                    <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${studentCount}</div>
                </div>
                <div class="p-5 border-b border-slate-100 dark:border-dark-tertiary flex justify-between items-center hover:bg-slate-50 dark:hover:bg-dark-tertiary transition">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-broadcast-tower"></i></div>
                        <div class="font-bold text-lg dark:text-white bengali-text">Total Live Exams</div>
                    </div>
                    <div class="text-2xl font-black text-red-600 dark:text-red-400">${liveExams}</div>
                </div>
                <div class="p-5 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-dark-tertiary transition">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-xl shadow-sm"><i class="fas fa-book-reader"></i></div>
                        <div class="font-bold text-lg dark:text-white bengali-text">Total Practice Exams</div>
                    </div>
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${mockExams}</div>
                </div>
            </div>
            <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 shadow-lg text-white mb-6 relative overflow-hidden flex items-center justify-between">
                <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 20px 20px;"></div>
                
                <div class="relative z-10">
                    <div class="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1 bengali-text">Active Course</div>
                    <h3 class="text-3xl font-bold bengali-text">${AppState.selectedGroup.name}</h3>
                    <div class="flex items-center gap-3 mt-3">
                        <span class="bg-white/20 px-3 py-1.5 rounded-lg text-sm font-mono tracking-wider font-bold">
                            Code: ${groupCode}
                        </span>
                        <button onclick="Teacher.copyGroupCode('${groupCode}')" class="text-white/70 hover:text-white transition bg-white/10 w-8 h-8 rounded flex items-center justify-center">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    
                    <div class="flex gap-3 mt-6">
                        <button onclick="Teacher.viewGroupStudents('${AppState.selectedGroup.id}')" class="bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 transition shadow">
                            <i class="fas fa-cog mr-2"></i> Manage Course
                        </button>
                        <button onclick="Teacher.noticeManagementView()" class="bg-indigo-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-900 transition shadow border border-indigo-500">
                            <i class="fas fa-bullhorn mr-2"></i> Notice & Poll
                        </button>
                    </div>
                </div>

                <div onclick="Teacher.viewGroupStudents('${AppState.selectedGroup.id}', 'pending')" class="relative z-10 cursor-pointer bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center justify-center w-28 h-28 hover:bg-white/20 transition transform hover:scale-105 shadow-xl">
                    <span class="text-4xl font-black text-amber-300 drop-shadow-md">${pendingCount}</span>
                    <span class="text-[10px] uppercase font-bold tracking-widest text-indigo-100 mt-1 bengali-text text-center">Pending<br>Request</span>
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
        c.innerHTML = `<div class="text-center p-10 text-red-500 bengali-text">Error loading homepage</div>`;
    }
};

Teacher.renderActiveLiveExamOnHome = async (examId) => {
    const container = document.getElementById('home-active-live-section');
    if (!container) return;

    const ex = ExamCache[examId];
    if (!ex) return;

    const qAttempts = query(collection(db, "attempts"), where("examId", "==", examId));
    const attSnap = await getDocs(qAttempts);
    const totalSubmitted = attSnap.size;

    const endTimeStr = moment(ex.endTime).format('hh:mm A, DD MMM');

    // MathHelper দিয়ে শিরোনাম রেন্ডার (নতুন ফিচার বজায় রাখা)
    const titleHTML = window.MathHelper ? window.MathHelper.renderExamContent(ex.title) : ex.title;
    const subjectHTML = (ex.subject && window.MathHelper) ? window.MathHelper.renderExamContent(ex.subject) : (ex.subject || 'No Subject');
    const chapterHTML = (ex.chapter && window.MathHelper) ? window.MathHelper.renderExamContent(ex.chapter) : (ex.chapter || '');

    container.innerHTML = `
    <div class="bg-white dark:bg-dark-secondary rounded-2xl border border-red-200 dark:border-red-900 shadow-md mb-6 overflow-hidden relative">
        <div class="bg-red-50 dark:bg-red-900/30 p-3 border-b border-red-100 dark:border-red-800 flex justify-between items-center">
            <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                <span class="font-bold text-red-600 dark:text-red-400 text-sm uppercase tracking-wider bengali-text">Ongoing Live Exam</span>
            </div>
            <button onclick="Teacher.renderActiveLiveExamOnHome('${examId}')" class="text-red-500 hover:text-red-700 bg-white dark:bg-black rounded-full w-8 h-8 flex items-center justify-center shadow-sm transition">
                <i class="fas fa-sync-alt"></i>
            </button>
        </div>
        <div class="p-6">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h3 class="text-2xl font-bold dark:text-white bengali-text">${titleHTML}</h3>
                    <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 bengali-text">
                        <i class="fas fa-book-open mr-1"></i> ${subjectHTML} 
                        ${chapterHTML ? '<i class="fas fa-angle-right mx-2 text-xs"></i> ' + chapterHTML : ''}
                    </p>
                </div>
                <div class="text-right bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-100 dark:border-red-800/50">
                    <div class="text-xs font-bold text-red-400 uppercase tracking-wider mb-1 bengali-text">Ends At</div>
                    <div class="text-base font-bold text-red-600 dark:text-red-400"><i class="far fa-clock mr-1"></i> ${endTimeStr}</div>
                </div>
            </div>
            
            <div class="flex items-center gap-4 bg-slate-50 dark:bg-dark-tertiary rounded-xl p-4 border dark:border-dark-tertiary w-fit mb-6">
                <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl shadow-sm"><i class="fas fa-check-double"></i></div>
                <div>
                    <div class="text-2xl font-black dark:text-white leading-none">${totalSubmitted}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mt-1 bengali-text">Total Submissions</div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-dark-tertiary pt-5">
                <button onclick="Teacher.stopLiveExam('${examId}')" class="bg-red-100 hover:bg-red-200 text-red-700 py-3 rounded-xl font-bold text-sm transition bengali-text flex items-center justify-center gap-2">
                    <i class="fas fa-ban"></i> Cancel Exam
                </button>
                <button onclick="Teacher.extendExamTime('${examId}')" class="bg-amber-100 hover:bg-amber-200 text-amber-700 py-3 rounded-xl font-bold text-sm transition bengali-text flex items-center justify-center gap-2">
                    <i class="fas fa-clock"></i> Extend Time
                </button>
                <button onclick="Teacher.publish('${examId}')" class="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-md bengali-text flex items-center justify-center gap-2">
                    <i class="fas fa-bullhorn"></i> Publish Result
                </button>
            </div>
        </div>
    </div>`;
};
