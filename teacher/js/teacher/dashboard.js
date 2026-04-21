// js/teacher/dashboard.js
// হোমপেজ / ড্যাশবোর্ড (পারমিশন কী জেনারেটর ও জয়েন সেটিংস সহ)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, getDocs, doc, getDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let ExamCache = window.ExamCache;

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
        let groupData = null;
        let studentCount = 0;
        let groupCode = '';

        if (groupDoc.exists()) {
            groupData = groupDoc.data();
            studentCount = groupData.studentIds ? groupData.studentIds.length : 0;
            groupCode = groupData.groupCode;
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

        const classBadge = groupData?.classLevel ? 
            `<span class="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">${groupData.classLevel === 'Admission' ? 'এডমিশন' : groupData.classLevel}</span>` : '';
        const streamBadge = groupData?.admissionStream ? 
            `<span class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full ml-1">${groupData.admissionStream}</span>` : '';
        const joinMethodText = {
            'public': 'পাবলিক',
            'code': 'কোর্স কোড',
            'permission': 'পারমিশন কী'
        }[groupData?.joinMethod] || 'কোর্স কোড';

        const courseImageHtml = groupData?.imageUrl ? 
            `<img src="${groupData.imageUrl}" alt="${groupData.name}" class="w-full h-32 object-cover rounded-t-2xl">` : 
            `<div class="w-full h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-2xl"><i class="fas fa-book-open"></i></div>`;

        let permissionKeySection = '';
        if (groupData?.joinMethod === 'permission') {
            if (groupData.permissionKey && !groupData.permissionKeyUsed) {
                permissionKeySection = `
                <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-amber-700 dark:text-amber-300">পারমিশন কী:</span>
                        <code class="bg-white dark:bg-black px-3 py-1 rounded text-sm">${groupData.permissionKey}</code>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="Teacher.copyPermissionKey('${groupData.permissionKey}')" class="flex-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 py-2 rounded-lg text-xs font-bold">
                            <i class="fas fa-copy mr-1"></i>কপি করুন
                        </button>
                        <button onclick="Teacher.generatePermissionKeyFromHome('${AppState.selectedGroup.id}')" class="flex-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 py-2 rounded-lg text-xs font-bold">
                            <i class="fas fa-sync-alt mr-1"></i>নতুন জেনারেট
                        </button>
                    </div>
                </div>`;
            } else if (groupData.permissionKeyUsed) {
                const usedByStudentId = groupData.permissionKeyUsedBy || '';
                const usedAt = groupData.permissionKeyUsedAt ? moment(groupData.permissionKeyUsedAt.toDate()).format('lll') : '';
                permissionKeySection = `
                <div class="mt-4 p-3 bg-slate-50 dark:bg-dark-tertiary rounded-xl border">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">পারমিশন কী:</span>
                            <code class="bg-white dark:bg-black px-3 py-1 rounded text-sm line-through opacity-60">${groupData.permissionKey}</code>
                        </div>
                        <span class="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">ব্যবহৃত</span>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="Teacher.generatePermissionKeyFromHome('${AppState.selectedGroup.id}')" class="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold">
                            <i class="fas fa-plus mr-1"></i>নতুন জেনারেট
                        </button>
                        ${usedByStudentId ? `
                        <button onclick="Teacher.viewStudentProfile('${usedByStudentId}', '${AppState.selectedGroup.id}')" class="flex-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 py-2 rounded-lg text-xs font-bold">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>` : ''}
                    </div>
                    ${usedByStudentId ? `<p class="text-[10px] text-slate-400 mt-2"><i class="far fa-clock mr-1"></i>${usedAt}</p>` : ''}
                </div>`;
            } else {
                permissionKeySection = `
                <div class="mt-4 p-3 bg-slate-50 dark:bg-dark-tertiary rounded-xl border">
                    <p class="text-sm text-slate-500 dark:text-slate-400">কোনো পারমিশন কী তৈরি হয়নি</p>
                    <button onclick="Teacher.generatePermissionKeyFromHome('${AppState.selectedGroup.id}')" class="mt-2 w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold">
                        <i class="fas fa-plus mr-1"></i>পারমিশন কী জেনারেট
                    </button>
                </div>`;
            }
        }

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
                ${courseImageHtml}
                <div class="p-5">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="text-xl font-bold dark:text-white bengali-text">${AppState.selectedGroup.name}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                ${classBadge} ${streamBadge}
                                <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">${joinMethodText}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${studentCount}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">শিক্ষার্থী</div>
                        </div>
                    </div>
                    ${groupData?.description ? `<p class="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">${groupData.description}</p>` : '<p class="text-sm text-slate-400 italic mb-4">কোনো বিবরণ নেই</p>'}
                    
                    ${permissionKeySection}

                    <div class="flex flex-wrap gap-3 mt-4">
                        <button onclick="Teacher.viewGroupStudents('${AppState.selectedGroup.id}')" class="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-800 transition">
                            <i class="fas fa-users mr-2"></i>শিক্ষার্থী দেখুন
                        </button>
                        <button onclick="Teacher.noticeManagementView()" class="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-xl font-bold text-sm hover:bg-amber-100 dark:hover:bg-amber-800 transition">
                            <i class="fas fa-bullhorn mr-2"></i>নোটিশ ও পোল
                        </button>
                        <button onclick="Teacher.quickEditJoinMethod('${AppState.selectedGroup.id}', '${groupData?.joinMethod || 'code'}')" class="bg-slate-100 dark:bg-dark-tertiary text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-dark-tertiary/80 transition">
                            <i class="fas fa-edit mr-2"></i>জয়েন সেটিংস
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary p-5 shadow-sm">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-xl">
                            <i class="fas fa-users"></i>
                        </div>
                        <div>
                            <div class="text-2xl font-black dark:text-white">${studentCount}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">মোট শিক্ষার্থী</div>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary p-5 shadow-sm">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-xl">
                            <i class="fas fa-broadcast-tower"></i>
                        </div>
                        <div>
                            <div class="text-2xl font-black dark:text-white">${liveExams}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">লাইভ পরীক্ষা</div>
                        </div>
                    </div>
                </div>
                <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary p-5 shadow-sm">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center text-xl">
                            <i class="fas fa-book-reader"></i>
                        </div>
                        <div>
                            <div class="text-2xl font-black dark:text-white">${mockExams}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">প্র্যাকটিস পরীক্ষা</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white mb-6">
                <h4 class="font-bold mb-3">দ্রুত অ্যাকশন</h4>
                <div class="flex flex-wrap gap-3">
                    <button onclick="Teacher.manageGroupsView()" class="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition">
                        <i class="fas fa-folder mr-2"></i>কোর্স ব্যবস্থাপনা
                    </button>
                    <button onclick="Router.teacher('create')" class="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition">
                        <i class="fas fa-plus-circle mr-2"></i>নতুন পরীক্ষা
                    </button>
                    <button onclick="Teacher.liveExamManagementView()" class="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition">
                        <i class="fas fa-tasks mr-2"></i>লাইভ ব্যবস্থাপনা
                    </button>
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

Teacher.generatePermissionKeyFromHome = async (groupId) => {
    try {
        const generateKey = () => {
            const letters = 'abcdefghijklmnopqrstuvwxyz';
            const numbers = '0123456789';
            let key = '';
            for (let i = 0; i < 5; i++) key += letters.charAt(Math.floor(Math.random() * letters.length));
            key += '-';
            for (let i = 0; i < 5; i++) key += numbers.charAt(Math.floor(Math.random() * numbers.length));
            return key;
        };
        
        let newKey;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 20) {
            newKey = generateKey();
            const q = query(collection(db, "groups"), 
                where("permissionKey", "==", newKey),
                where("permissionKeyUsed", "==", false));
            const snap = await getDocs(q);
            if (snap.empty) isUnique = true;
            attempts++;
        }
        
        if (!isUnique) throw new Error('ইউনিক কী জেনারেট করা যায়নি, আবার চেষ্টা করুন');
        
        await updateDoc(doc(db, "groups", groupId), {
            permissionKey: newKey,
            permissionKeyUsed: false,
            permissionKeyUsedBy: null,
            permissionKeyUsedAt: null
        });
        
        Swal.fire({
            title: 'পারমিশন কী তৈরি হয়েছে',
            html: `<p>নতুন পারমিশন কী:</p><code style="font-size:1.5rem;background:#f0f0f0;padding:5px 15px;border-radius:8px;">${newKey}</code>`,
            icon: 'success',
            confirmButtonText: 'কপি করুন'
        }).then(() => {
            navigator.clipboard.writeText(newKey);
            Swal.fire('কপি হয়েছে', 'পারমিশন কী ক্লিপবোর্ডে কপি করা হয়েছে', 'success');
            Teacher.homeView();
        });
    } catch (error) {
        Swal.fire('ত্রুটি', error.message, 'error');
    }
};

Teacher.quickEditJoinMethod = async (groupId, currentMethod) => {
    const { value: newMethod } = await Swal.fire({
        title: 'জয়েন মেথড পরিবর্তন',
        input: 'select',
        inputOptions: {
            'public': 'পাবলিক (যে কেউ জয়েন করতে পারবে)',
            'code': 'কোর্স কোড প্রয়োজন',
            'permission': 'পারমিশন কী প্রয়োজন'
        },
        inputValue: currentMethod,
        showCancelButton: true,
        confirmButtonText: 'সংরক্ষণ'
    });
    
    if (newMethod) {
        try {
            const updateData = {
                joinMethod: newMethod,
                updatedAt: new Date()
            };
            if (currentMethod === 'permission' && newMethod !== 'permission') {
                updateData.permissionKey = null;
                updateData.permissionKeyUsed = false;
                updateData.permissionKeyUsedBy = null;
                updateData.permissionKeyUsedAt = null;
            }
            await updateDoc(doc(db, "groups", groupId), updateData);
            
            Swal.fire('সফল', 'জয়েন মেথড আপডেট হয়েছে', 'success');
            Teacher.homeView();
        } catch (error) {
            Swal.fire('ত্রুটি', error.message, 'error');
        }
    }
};

Teacher.copyPermissionKey = (key) => {
    navigator.clipboard.writeText(key).then(() => {
        Swal.fire('কপি হয়েছে', 'পারমিশন কী কপি করা হয়েছে', 'success');
    });
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
