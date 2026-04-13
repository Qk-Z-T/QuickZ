// js/teacher/management.js
// ম্যানেজমেন্ট হাব ও লাইভ পরীক্ষা ব্যবস্থাপনা

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let unsubscribes = window.unsubscribes;

// ------------- ম্যানেজমেন্ট ভিউ -------------
Teacher.managementView = () => {
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
};

Teacher.liveExamManagementView = () => {
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
};
