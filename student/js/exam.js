// js/exam.js
// Exam module - exam taking functionality

import { auth, db } from './config.js';
import { AppState, loadMathJax, MathHelper } from './state.js';
import { OfflineManager } from './offline.js';

import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    addDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export const Exam = {
    d: null, 
    ans: [], 
    marked: [], 
    t: null, 
    currentPage: 0, 
    isPractice: false, 
    startedAt: null, 
    currentAttemptId: null,
    autoSaveInterval: null,

    start: async (id, forcePractice = false) => {
        if (AppState.userDisabled) {
            Swal.fire('প্রবেশাধিকার নেই', 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়।', 'warning');
            return;
        }

        const confirmResult = await Swal.fire({
            title: 'পরীক্ষা শুরু করবেন?',
            text: 'একবার শুরু করলে সময় গণনা শুরু হবে। আপনি কি নিশ্চিত?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'হ্যাঁ, শুরু করুন',
            cancelButtonText: 'না'
        });
        if (!confirmResult.isConfirmed) return;

        try {
            // লোকাল বা অনলাইন থেকে পরীক্ষার ডেটা আনা
            let examData;
            if (navigator.onLine) {
                const docSnap = await getDoc(doc(db, "exams", id));
                if (!docSnap.exists()) {
                    Swal.fire('ত্রুটি', 'পরীক্ষাটি পাওয়া যায়নি!', 'error');
                    return;
                }
                examData = { id: docSnap.id, ...docSnap.data() };
            } else {
                examData = OfflineManager.loadExamFromCache(id);
                if (!examData) {
                    Swal.fire('অফলাইন', 'পরীক্ষার ডেটা ক্যাশে নেই। ইন্টারনেট সংযোগ দিন।', 'error');
                    return;
                }
            }
            
            const exam = examData;
            const uid = auth.currentUser.uid;
            const isLive = exam.type === 'live' && !forcePractice;
            
            // প্রশ্নপত্র পার্স
            let questions;
            try {
                questions = JSON.parse(exam.questions);
            } catch (e) {
                Swal.fire('ত্রুটি', 'প্রশ্নপত্র ফরম্যাট সঠিক নয়', 'error');
                return;
            }

            if (isLive) {
                // অনলাইন থাকলে চেক করব আগের অ্যাটেম্পট
                if (navigator.onLine) {
                    const attemptQuery = query(
                        collection(db, "attempts"), 
                        where("userId", "==", uid), 
                        where("examId", "==", id),
                        where("isPractice", "==", false)
                    );
                    const attemptSnap = await getDocs(attemptQuery);
                    
                    let existingAttempt = null;
                    attemptSnap.forEach(doc => {
                        const data = doc.data();
                        if (!data.submittedAt) existingAttempt = { id: doc.id, ...data };
                    });

                    if (existingAttempt) {
                        Exam.currentAttemptId = existingAttempt.id;
                        Exam.ans = existingAttempt.answers || new Array(questions.length).fill(null);
                        Exam.marked = existingAttempt.markedAnswers || new Array(questions.length).fill(false);
                        Exam.startedAt = existingAttempt.startedAt?.toDate() || new Date();
                    } else {
                        // সাবমিটেড চেক
                        const submittedQuery = query(
                            collection(db, "attempts"), 
                            where("userId", "==", uid), 
                            where("examId", "==", id),
                            where("isPractice", "==", false)
                        );
                        const submittedSnap = await getDocs(submittedQuery);
                        let hasSubmitted = false;
                        submittedSnap.forEach(d => { if (d.data().submittedAt) hasSubmitted = true; });
                        
                        if (hasSubmitted) {
                            Swal.fire('অংশগ্রহণ সম্পন্ন', 'আপনি ইতিমধ্যে এই পরীক্ষায় অংশগ্রহণ করে জমা দিয়েছেন।', 'info');
                            return;
                        }
                        
                        // নতুন অ্যাটেম্পট
                        const newAttemptRef = await addDoc(collection(db, "attempts"), {
                            userId: uid,
                            userName: AppState.userProfile?.name || auth.currentUser.displayName,
                            examId: id,
                            examTitle: exam.title,
                            status: 'in-progress',
                            startedAt: new Date(),
                            answers: [],
                            markedAnswers: [],
                            score: 0,
                            isPractice: false,
                            groupId: AppState.activeGroupId
                        });
                        Exam.currentAttemptId = newAttemptRef.id;
                        Exam.ans = new Array(questions.length).fill(null);
                        Exam.marked = new Array(questions.length).fill(false);
                        Exam.startedAt = new Date();
                    }
                } else {
                    // অফলাইনে লাইভ এক্সাম? লোকাল অ্যাটেম্পট তৈরি করব
                    const localId = 'local_' + Date.now() + '_' + id;
                    Exam.currentAttemptId = localId;
                    Exam.ans = new Array(questions.length).fill(null);
                    Exam.marked = new Array(questions.length).fill(false);
                    Exam.startedAt = new Date();
                }
            } else {
                // মক টেস্ট সবসময় নতুন
                Exam.ans = new Array(questions.length).fill(null);
                Exam.marked = new Array(questions.length).fill(false);
                Exam.startedAt = new Date();
                Exam.currentAttemptId = null;
            }

            // সঠিক উত্তর ছাড়া প্রশ্নপত্র
            const questionsWithoutCorrect = questions.map(q => {
                const { correct, ...rest } = q;
                return rest;
            });
            
            Exam.d = { ...exam, qs: questionsWithoutCorrect, fullQuestions: questions };
            Exam.currentPage = 0;
            Exam.isPractice = forcePractice || (exam.type === 'mock');
            
            document.getElementById('review-panel-btn').classList.remove('hidden');
            
            await Exam.render();
            Exam.runT(exam.duration * 60);
            Exam.updateReviewPanel();
            
            if (isLive) {
                Exam.startAutoSave();
            }
        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'পরীক্ষা শুরু করতে সমস্যা', 'error');
        }
    },
    
    startAutoSave: () => {
        if (Exam.autoSaveInterval) clearInterval(Exam.autoSaveInterval);
        Exam.autoSaveInterval = setInterval(async () => {
            if (Exam.currentAttemptId && Exam.d) {
                const pendingData = {
                    firestoreId: Exam.currentAttemptId,
                    localId: Exam.currentAttemptId,
                    answers: Exam.ans,
                    markedAnswers: Exam.marked,
                    status: 'in-progress',
                    lastSaved: new Date().toISOString()
                };
                localStorage.setItem('currentExamProgress', JSON.stringify(pendingData));
                
                if (navigator.onLine && !Exam.currentAttemptId.startsWith('local_')) {
                    try {
                        await updateDoc(doc(db, "attempts", Exam.currentAttemptId), {
                            answers: Exam.ans,
                            markedAnswers: Exam.marked,
                            lastSaved: new Date()
                        });
                    } catch (e) {
                        console.warn('Online save failed', e);
                    }
                }
            }
        }, 20000);
    },
    
    toggleMark: (index) => {
        Exam.marked[index] = !Exam.marked[index];
        const btn = document.getElementById(`mark-btn-${index}`);
        if (btn) {
            if (Exam.marked[index]) {
                btn.classList.add('text-amber-500');
                btn.classList.remove('text-slate-400');
                btn.innerHTML = '<i class="fas fa-bookmark"></i> চিহ্নিত';
            } else {
                btn.classList.remove('text-amber-500');
                btn.classList.add('text-slate-400');
                btn.innerHTML = '<i class="far fa-bookmark"></i> চিহ্নিত করুন';
            }
        }
        Exam.updateReviewPanel();
    },
    
    updateReviewPanel: () => {
        const panel = document.getElementById('question-numbers');
        if (!panel) return;
        panel.innerHTML = '';
        const questionsPerPage = 25;

        Exam.d.qs.forEach((_, i) => {
            const btn = document.createElement('button');
            btn.className = 'question-number-btn';
            if (Exam.ans[i] !== null) btn.classList.add('answered');
            
            const startIdx = Exam.currentPage * questionsPerPage;
            const endIdx = startIdx + questionsPerPage;
            if (i >= startIdx && i < endIdx) btn.classList.add('current-view');
            
            btn.textContent = i + 1;
            btn.onclick = async () => {
                const targetPage = Math.floor(i / questionsPerPage);
                if (targetPage !== Exam.currentPage) {
                    Exam.currentPage = targetPage;
                    await Exam.render();
                }
                setTimeout(() => {
                    const el = document.getElementById(`q-${i}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'instant', block: 'center' });
                        el.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
                        el.style.transition = 'background-color 0.3s';
                        setTimeout(() => el.style.backgroundColor = '', 1000);
                    }
                }, 50);
                document.getElementById('review-panel').classList.remove('show');
            };
            panel.appendChild(btn);
        });
    },
    
    render: async () => {
        const questionsPerPage = 25;
        const startIndex = Exam.currentPage * questionsPerPage;
        const endIndex = Math.min(startIndex + questionsPerPage, Exam.d.qs.length);
        
        const answeredCount = Exam.ans.filter(a => a !== null).length;
        
        let questionHTML = '';
        for (let i = startIndex; i < endIndex; i++) {
            const q = Exam.d.qs[i];
            
            const qText = MathHelper.renderExamContent(q.q);
            
            const isAnswered = Exam.ans[i] !== null;
            
            questionHTML += `<div class="p-4 rounded-xl shadow-sm border mb-4" id="q-${i}" style="background-color:var(--card-bg);border-color:var(--border-light);">
                <div class="flex justify-between items-center mb-3">
                    <span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 text-sm rounded h-fit">${i+1}</span>
                    <button id="mark-btn-${i}" onclick="Exam.toggleMark(${i})" class="text-xs font-bold ${Exam.marked[i] ? 'text-amber-500' : 'text-slate-400'}">
                        <i class="${Exam.marked[i] ? 'fas' : 'far'} fa-bookmark"></i> ${Exam.marked[i] ? 'চিহ্নিত' : 'চিহ্নিত করুন'}
                    </button>
                </div>
                <p class="font-bold mb-3 text-slate-800 text-left flex gap-2">
                    <span class="flex-1" style="font-family: 'SolaimanLipi', sans-serif; font-size: 14px; line-height: 1.5;">${qText}</span>
                </p>
                <div class="space-y-2">
                    ${q.options.map((o,oi) => {
                        const selected = Exam.ans[i] === oi ? 'selected' : '';
                        const locked = isAnswered ? 'locked' : '';
                        
                        const optionText = MathHelper.renderExamContent(o);
                        
                        return `<button onclick="Exam.sel(${i},${oi})" class="opt-btn option-btn w-full text-left p-3 rounded-lg border text-sm flex gap-2 transition ${selected} ${locked}" ${isAnswered ? 'disabled' : ''}>
                            <span class="font-bold opacity-50 w-6">${String.fromCharCode(65+oi)}.</span>
                            <span class="flex-1 text-left" style="font-family: 'SolaimanLipi', sans-serif; font-size: 14px; line-height: 1.5;">${optionText}</span>
                            ${selected ? '<i class="fas fa-check text-indigo-600 ml-2"></i>' : ''}
                        </button>`;
                    }).join('')}
                </div>
            </div>`;
        }
        
        const totalPages = Math.ceil(Exam.d.qs.length / questionsPerPage);
        let paginationHTML = '';
        if (totalPages > 1) {
            paginationHTML = `
                <div class="flex justify-center gap-2 mt-6">
                    <button onclick="Exam.prevPage()" class="px-4 py-2 bg-slate-100 rounded-lg ${Exam.currentPage === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${Exam.currentPage === 0 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left"></i> পূর্ববর্তী
                    </button>
                    <span class="px-4 py-2 text-sm">পৃষ্ঠা ${Exam.currentPage + 1}/${totalPages}</span>
                    <button onclick="Exam.nextPage()" class="px-4 py-2 bg-slate-100 rounded-lg ${Exam.currentPage === totalPages - 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${Exam.currentPage === totalPages - 1 ? 'disabled' : ''}>
                        পরবর্তী <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
        }
        
        const practiceIndicator = Exam.isPractice ? 
            `<div class="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded inline-block mb-2 text-center">
                <i class="fas fa-flask"></i> অনুশীলন মোড
            </div>` : '';
        
        document.getElementById('app-container').innerHTML = `
        <div class="sticky top-0 border-b px-4 py-3 flex justify-between items-center z-30 shadow-md exam-header-bar" style="background-color:var(--header-bg);border-color:var(--header-border);">
            <div>
                ${practiceIndicator}
                <div class="text-center">
                    <span class="font-bold block text-sm truncate w-32 mx-auto">${Exam.d.title}</span>
                    <div class="flex items-center justify-center gap-2 mt-1">
                        <span id="tm" class="text-xs font-mono bg-slate-100 px-1 rounded text-slate-600">00:00</span>
                        <span id="answered-counter" class="text-xs font-mono bg-indigo-100 text-indigo-600 px-1 rounded">সম্পন্ন: ${answeredCount}/${Exam.d.qs.length}</span>
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="Exam.sub()" class="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow hover:bg-indigo-700 transition">জমা দিন</button>
            </div>
        </div>
        <div class="p-4 pb-20 min-h-screen select-none exam-question-container" style="background-color:var(--bg-primary);">
            ${questionHTML}
            ${paginationHTML}
        </div>`;
        
        loadMathJax(null, document.getElementById('app-container'));
        Exam.updateReviewPanel();
    },
    
    sel: (qi, oi) => {
        if (Exam.ans[qi] !== null) return;
        
        Exam.ans[qi] = oi;
        
        const questionDiv = document.getElementById(`q-${qi}`);
        if (questionDiv) {
            const buttons = questionDiv.querySelectorAll('.option-btn');
            buttons.forEach((btn, index) => {
                if (index === oi) {
                    btn.classList.add('selected');
                    if (!btn.querySelector('.fa-check')) {
                        const checkIcon = document.createElement('i');
                        checkIcon.className = 'fas fa-check text-indigo-600 ml-2';
                        btn.appendChild(checkIcon);
                    }
                }
                btn.classList.add('locked');
                btn.disabled = true;
            });
        }
        
        const answeredCount = Exam.ans.filter(a => a !== null).length;
        const counterEl = document.getElementById('answered-counter');
        if (counterEl) counterEl.textContent = `সম্পন্ন: ${answeredCount}/${Exam.d.qs.length}`;
        
        Exam.updateReviewPanel();
    },
    
    prevPage: () => {
        if (Exam.currentPage > 0) {
            Exam.currentPage--;
            Exam.render();
        }
    },
    
    nextPage: () => {
        const totalPages = Math.ceil(Exam.d.qs.length / 25);
        if (Exam.currentPage < totalPages - 1) {
            Exam.currentPage++;
            Exam.render();
        }
    },
    
    runT: (sec) => {
        Exam.t = setInterval(()=>{ 
            sec--; 
            const el = document.getElementById('tm');
            if (el) el.innerText = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`; 
            if(sec<=0) Exam.sub(true); 
        },1000);
    },
    
    sub: async (auto=false) => {
        if(!auto && !confirm('পরীক্ষা জমা দিতে চান?')) return;
        clearInterval(Exam.t);
        if (Exam.autoSaveInterval) clearInterval(Exam.autoSaveInterval);
        
        // পূর্ণাঙ্গ প্রশ্নপত্র বের করা
        let fullExam, fullQs;
        if (Exam.d.fullQuestions) {
            fullQs = Exam.d.fullQuestions;
            fullExam = Exam.d;
        } else {
            if (navigator.onLine) {
                try {
                    const examDocRef = await getDoc(doc(db, "exams", Exam.d.id));
                    if (!examDocRef.exists()) throw new Error('Exam not found');
                    fullExam = examDocRef.data();
                } catch(e) {
                    fullExam = OfflineManager.loadExamFromCache(Exam.d.id);
                }
            } else {
                fullExam = OfflineManager.loadExamFromCache(Exam.d.id);
            }
            if (!fullExam) {
                Swal.fire('ত্রুটি', 'পরীক্ষার তথ্য পাওয়া যায়নি', 'error');
                return;
            }
            fullQs = JSON.parse(fullExam.questions);
        }
        
        const neg = fullExam.negativeMark ? parseFloat(fullExam.negativeMark) : 0;
        let score = 0;
        fullQs.forEach((q,i) => { 
            if(Exam.ans[i] == q.correct) score++; 
            else if(Exam.ans[i] !== null) score -= neg; 
        });
        score = Math.max(0, score);
        
        const showInstant = (fullExam.type === 'mock' || Exam.isPractice || !navigator.onLine); // অফলাইনে সবসময় রেজাল্ট দেখাবে
        
        // সাবমিশন ডেটা
        const submissionData = {
            userId: auth.currentUser.uid, 
            userName: AppState.userProfile?.name || auth.currentUser.displayName,
            examId: Exam.d.id, 
            examTitle: Exam.d.title, 
            score, 
            answers: Exam.ans,
            markedAnswers: Exam.marked,
            startedAt: Exam.startedAt,
            submittedAt: new Date().toISOString(),
            isPractice: Exam.isPractice || fullExam.type === 'mock',
            groupId: AppState.activeGroupId,
            status: 'submitted'
        };
        
        // অফলাইন/অনলাইন সাবমিট
        if (navigator.onLine && !Exam.currentAttemptId?.startsWith('local_')) {
            try {
                if (Exam.currentAttemptId) {
                    await updateDoc(doc(db, "attempts", Exam.currentAttemptId), {
                        answers: Exam.ans,
                        markedAnswers: Exam.marked,
                        score,
                        submittedAt: new Date(),
                        status: 'submitted'
                    });
                } else {
                    await addDoc(collection(db, "attempts"), {
                        ...submissionData,
                        submittedAt: new Date(),
                        startedAt: Exam.startedAt
                    });
                }
                localStorage.removeItem('currentExamProgress');
            } catch(e) {
                // অনলাইন থাকা সত্ত্বেও ব্যর্থ হলে লোকালে সেভ
                OfflineManager.savePendingAttempt(submissionData, Exam.currentAttemptId);
            }
        } else {
            // অফলাইন বা লোকাল আইডি থাকলে লোকালে জমা
            OfflineManager.savePendingAttempt(submissionData, Exam.currentAttemptId);
            if (!navigator.onLine) {
                Swal.fire({
                    title: 'অফলাইন সাবমিশন',
                    text: 'আপনার পরীক্ষা লোকালি সেভ হয়েছে। ইন্টারনেট ফিরে আসলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।',
                    icon: 'info',
                    confirmButtonText: 'ঠিক আছে'
                });
            }
        }
        
        // তাৎক্ষণিক রেজাল্ট দেখানো (মক বা অফলাইনে)
        if(showInstant) {
            Swal.fire({
                title: 'ফলাফল',
                html: `আপনার স্কোর: <strong>${score.toFixed(2)}</strong>`,
                icon: 'success',
                confirmButtonText: 'দেখুন'
            }).then(() => { 
                document.getElementById('review-panel-btn').classList.add('hidden');
                document.getElementById('review-panel').classList.remove('show');
                
                // সরাসরি রেজাল্ট পেজে নিয়ে যাওয়া
                import('./state.js').then(({ resultTypeFilter }) => {
                    if (fullExam.type === 'mock' || Exam.isPractice) {
                        resultTypeFilter = 'mock';
                    }
                });
                import('./router.js').then(({ Router }) => {
                    Router.student('results');
                });
            });
        } else {
            Swal.fire('জমা দেওয়া হয়েছে', 'ফলাফলের জন্য অপেক্ষা করুন।', 'success').then(() => {
                document.getElementById('review-panel-btn').classList.add('hidden');
                document.getElementById('review-panel').classList.remove('show');
                import('./router.js').then(({ Router }) => {
                    Router.student('dashboard');
                });
            });
        }
    }
};

window.Exam = Exam;
