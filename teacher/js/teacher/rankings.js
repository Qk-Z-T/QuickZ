// js/teacher/rankings.js
// র‍্যাংকিং ও ফলাফল দেখার ফিচার (MathHelper ও loadMathJax সহ)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let ExamCache = window.ExamCache;
let unsubscribes = window.unsubscribes;

// ------------- র‍্যাংক ভিউ -------------
Teacher.rankView = () => {
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
            h += `<div onclick="Teacher.viewRank('${e.id}', '${e.title.replace(/'/g, "\\'")}')" class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-tertiary cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group">
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
};

Teacher.viewRank = async (eid, title) => {
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
                    <div class="mt-3 flex justify-end">
                        <button onclick="Teacher.openExamAnalysis('${eid}')" class="text-indigo-300 hover:text-indigo-100 px-3 py-1 rounded-full text-xs font-bold transition border border-indigo-500/50">
                            <i class="fas fa-chart-bar mr-1"></i> বিশ্লেষণ
                        </button>
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
};

// বিশ্লেষণ ফাংশন (স্টুডেন্ট প্যানেল থেকে গৃহীত ও অভিযোজিত)
Teacher.openExamAnalysis = async (examId) => {
    const c = document.getElementById('app-container');
    c.innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="bengali-text">বিশ্লেষণ লোড হচ্ছে...</p></div>';
    
    try {
        const examDoc = await getDoc(doc(db, "exams", examId));
        if (!examDoc.exists()) throw new Error("পরীক্ষা পাওয়া যায়নি");
        const examData = examDoc.data();
        
        if (!examData.questions) throw new Error("প্রশ্নপত্র পাওয়া যায়নি");
        let questions;
        try {
            questions = JSON.parse(examData.questions);
        } catch (e) {
            throw new Error("প্রশ্নপত্র ফরম্যাট সঠিক নয়");
        }
        if (!Array.isArray(questions) || questions.length === 0) throw new Error("কোনো প্রশ্ন নেই");
        
        const attemptsSnap = await getDocs(query(
            collection(db, "attempts"),
            where("examId", "==", examId),
            where("isPractice", "==", false)
        ));
        const attempts = [];
        attemptsSnap.forEach(d => {
            const data = d.data();
            if (data.answers && Array.isArray(data.answers)) {
                attempts.push(data);
            }
        });
        
        const totalAttempts = attempts.length;
        if (totalAttempts === 0) {
            c.innerHTML = `
                <div class="p-5 pb-20 text-center">
                    <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500"><i class="fas fa-arrow-left"></i> ফিরে যান</button>
                    <div class="p-10 text-slate-400 bengali-text">এখনো কেউ এই পরীক্ষায় অংশগ্রহণ করেনি</div>
                </div>`;
            return;
        }
        
        const questionStats = questions.map((q, idx) => {
            const optionCounts = new Array(q.options.length).fill(0);
            let correctCount = 0;
            let wrongCount = 0;
            let skippedCount = 0;
            
            attempts.forEach(att => {
                const answer = att.answers[idx];
                if (answer === null || answer === undefined) {
                    skippedCount++;
                } else if (answer >= 0 && answer < q.options.length) {
                    optionCounts[answer]++;
                    if (answer === q.correct) correctCount++;
                    else wrongCount++;
                } else {
                    skippedCount++;
                }
            });
            
            const optionPercentages = optionCounts.map(count => totalAttempts > 0 ? (count / totalAttempts) * 100 : 0);
            return {
                ...q,
                optionCounts,
                optionPercentages,
                correctCount,
                wrongCount,
                skippedCount,
                totalAttempts
            };
        });
        
        let html = `
        <div class="p-5 pb-20">
            <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 bengali-text">
                <i class="fas fa-arrow-left"></i> র‍্যাংকিংয়ে ফিরুন
            </button>
            <h2 class="text-xl font-bold mb-4 text-center dark:text-white bengali-text">${examData.title} - বিস্তারিত বিশ্লেষণ</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center bengali-text">মোট পরীক্ষার্থী: ${totalAttempts}</p>
        `;
        
        questionStats.forEach((q, i) => {
            const qText = window.MathHelper.renderExamContent(q.q);
            const correctOpt = String.fromCharCode(65 + q.correct);
            
            let optionsHtml = '';
            q.options.forEach((opt, oi) => {
                const optText = window.MathHelper.renderExamContent(opt);
                const percent = q.optionPercentages[oi].toFixed(1);
                const count = q.optionCounts[oi];
                const isCorrect = oi === q.correct;
                optionsHtml += `
                <div class="opt-res ${isCorrect ? 'right' : ''}">
                    <div class="option-math flex-1">
                        <span>${String.fromCharCode(65+oi)}.</span>
                        <span>${optText}</span>
                    </div>
                    <div class="text-xs font-bold ${isCorrect ? 'text-green-600' : 'text-slate-500'}">
                        ${percent}% (${count})
                    </div>
                </div>`;
            });
            
            const correctPercent = totalAttempts > 0 ? ((q.correctCount / totalAttempts)*100) : 0;
            const wrongPercent = totalAttempts > 0 ? ((q.wrongCount / totalAttempts)*100) : 0;
            const skippedPercent = totalAttempts > 0 ? ((q.skippedCount / totalAttempts)*100) : 0;
            
            html += `
            <div class="p-4 rounded-xl shadow-sm border mb-6" style="background-color:var(--card-bg);border-color:var(--border-light);">
                <div class="flex justify-between mb-2">
                    <span class="font-bold bengali-text">প্রশ্ন ${i+1}</span>
                    <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded bengali-text">সঠিক উত্তর: ${correctOpt}</span>
                </div>
                <p class="font-semibold mb-3 math-render">${qText}</p>
                <div class="space-y-1 mb-4">
                    ${optionsHtml}
                </div>
                ${q.expl ? `<div class="text-xs p-3 rounded mb-3 explanation-box"><b>ব্যাখ্যা:</b> ${window.MathHelper.renderExamContent(q.expl)}</div>` : ''}
                
                <div class="mt-3">
                    <div class="flex items-center gap-2 text-xs mb-2">
                        <span class="w-16 bengali-text">সঠিক ${q.correctCount}</span>
                        <span class="w-16 text-right bengali-text">ভুল ${q.wrongCount}</span>
                        <span class="w-16 text-right bengali-text">স্কিপ ${q.skippedCount}</span>
                    </div>
                    <div class="h-6 bg-gray-200 rounded-full overflow-hidden flex text-white text-[10px] font-bold">
                        <div class="bg-green-500 h-full flex items-center justify-center" style="width: ${correctPercent}%">${correctPercent.toFixed(1)}%</div>
                        <div class="bg-red-500 h-full flex items-center justify-center" style="width: ${wrongPercent}%">${wrongPercent.toFixed(1)}%</div>
                        <div class="bg-yellow-500 h-full flex items-center justify-center" style="width: ${skippedPercent}%">${skippedPercent.toFixed(1)}%</div>
                    </div>
                </div>
            </div>`;
        });
        
        html += `</div>`;
        c.innerHTML = html;
        
        window.loadMathJax(null, c);
    } catch (error) {
        console.error(error);
        Swal.fire('ত্রুটি', 'বিশ্লেষণ লোড করতে ব্যর্থ', 'error');
        Teacher.rankView();
    }
};

Teacher.viewUserResult = async (attemptId) => {
    const c = document.getElementById('app-container');
    c.innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-2 text-xs bengali-text">ফলাফল লোড হচ্ছে...</p></div>';
    
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
                
                const questionHTML = window.MathHelper.renderExamContent(q.q);
                
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
                            
                            const optionText = window.MathHelper.renderExamContent(o);
                            
                            return `<div class="${cls}"><span class="bengali-text">${String.fromCharCode(65+oi)}. ${optionText}</span> ${icon}</div>`;
                        }).join('')}
                    </div>
                    <div class="mt-3 text-xs bg-white/60 dark:bg-dark-tertiary p-3 rounded border border-slate-200 dark:border-dark-tertiary">
                        <span class="font-bold text-indigo-600 dark:text-indigo-400 block mb-1 bengali-text">ব্যাখ্যা:</span>
                        ${q.expl ? `<span class="bengali-text">${window.MathHelper.renderExamContent(q.expl)}</span>` : "<span class='bengali-text'>কোনো ব্যাখ্যা প্রদান করা হয়নি।</span>"}
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
            
            window.loadMathJax(null, c);
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
};
