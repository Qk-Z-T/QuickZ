// js/teacher/rankings.js
// Rankings and Result Viewing Features (with course info card)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let ExamCache = window.ExamCache;
let unsubscribes = window.unsubscribes;

// ------------- Rank View (with course card) -------------
Teacher.rankView = () => {
    if (!AppState.selectedGroup) {
        Teacher.selectGroupView('rank');
        return;
    }
    
    document.getElementById('floating-math-btn').classList.add('hidden');
    document.getElementById('math-symbols-panel').classList.remove('show');
    
    const c = document.getElementById('app-container');
    
    // প্রথমে কোর্সের তথ্যসহ উপরের অংশ রেন্ডার করি, তারপর পরীক্ষার তালিকা লোড হবে
    c.innerHTML = `
    <div class="pb-6">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold font-en dark:text-white">Live Exam Rankings</h2>
        </div>
        
        <!-- Current Course Info Card -->
        <div id="rank-course-info-card" class="bg-white dark:bg-dark-secondary rounded-2xl shadow-sm border dark:border-dark-tertiary overflow-hidden mb-6">
            <div class="p-5">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-bold dark:text-white">${AppState.selectedGroup.name}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400">বর্তমান কোর্স</p>
                    </div>
                </div>
            </div>
        </div>
        
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Only showing published live exams for the selected course.</p>
        <div id="rank-exams-list" class="text-center p-10">
            <div class="loader mx-auto"></div>
        </div>
    </div>`;
    
    // কোর্সের পূর্ণ তথ্য এনে কার্ড আপডেট করি
    Teacher.updateRankCourseCard();
    
    // পরীক্ষার তালিকা লোড করি
    Teacher.loadRankExamsList();
};

// কোর্সের বিস্তারিত তথ্য এনে কার্ড আপডেট করার ফাংশন
Teacher.updateRankCourseCard = async () => {
    try {
        const groupDoc = await getDoc(doc(db, "groups", AppState.selectedGroup.id));
        if (!groupDoc.exists()) return;
        const group = groupDoc.data();
        
        const cardContainer = document.getElementById('rank-course-info-card');
        if (!cardContainer) return;
        
        const classBadge = group.classLevel ? 
            `<span class="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">${group.classLevel === 'Admission' ? 'এডমিশন' : group.classLevel}</span>` : '';
        const streamBadge = group.admissionStream ? 
            `<span class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full ml-1">${group.admissionStream}</span>` : '';
        const joinMethodText = {
            'public': 'পাবলিক',
            'code': 'কোর্স কোড',
            'permission': 'পারমিশন কী'
        }[group.joinMethod] || 'কোর্স কোড';
        
        const imageHtml = group.imageUrl ? 
            `<img src="${group.imageUrl}" alt="${group.name}" class="w-full h-32 object-cover rounded-t-2xl">` : 
            `<div class="w-full h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-2xl"><i class="fas fa-trophy"></i></div>`;
        
        cardContainer.innerHTML = `
            ${imageHtml}
            <div class="p-5">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-xl font-bold dark:text-white bengali-text">${group.name}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            ${classBadge} ${streamBadge}
                            <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">${joinMethodText}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${group.studentIds?.length || 0}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400">শিক্ষার্থী</div>
                    </div>
                </div>
                ${group.description ? `<p class="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">${group.description}</p>` : '<p class="text-sm text-slate-400 italic mb-4">কোনো বিবরণ নেই</p>'}
            </div>
        `;
    } catch (e) {
        console.error('Error updating rank course card:', e);
    }
};

// পরীক্ষার তালিকা লোড করে UI-তে বসানো
Teacher.loadRankExamsList = async () => {
    const container = document.getElementById('rank-exams-list');
    if (!container) return;
    
    const exams = Object.values(ExamCache)
        .filter(e => e.type === 'live' && 
               e.groupId === AppState.selectedGroup.id && 
               e.resultPublished &&
               !e.cancelled)
        .sort((a,b) => b.createdAt - a.createdAt);
    
    if (exams.length === 0) {
        container.innerHTML = '<div class="text-center p-10 text-slate-400">No published live exams found</div>';
        return;
    }
    
    let h = '';
    exams.forEach(e => {
        const date = moment(e.createdAt.toDate()).format('DD MMM, YYYY');
        h += `<div onclick="Teacher.viewRank('${e.id}', '${e.title.replace(/'/g, "\\'")}')" class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-tertiary cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase">Live</span>
                <div class="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition">
                    <i class="fas fa-trophy text-sm"></i>
                </div>
            </div>
            <div class="font-bold text-sm text-slate-800 dark:text-white mb-2" style="line-height:1.4;">${e.title}</div>
            <div class="text-xs text-slate-400">${date}</div>
            <div class="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">View Rank <i class="fas fa-arrow-right text-xs"></i></div>
        </div>`;
    });
    
    container.innerHTML = h;
};

Teacher.viewRank = async (eid, title) => {
    const c = document.getElementById('app-container');
    c.innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-2 text-xs">Loading rankings...</p></div>';
    
    try {
        const exSnap = await getDoc(doc(db, "exams", eid));
        if (!exSnap.exists()) {
            Swal.fire('Error', 'Exam information not found.', 'error');
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
                    <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition"><i class="fas fa-arrow-left mr-1"></i> Rankings</button>
                    <div class="text-center p-10 text-slate-500">No one has participated in this exam yet.</div>
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
                        <div class="font-bold text-sm dark:text-white">${a.userName || 'Unknown Student'}</div>
                        <div class="text-[9px] text-slate-500 uppercase">Accuracy: ${accuracy}% | Time: ${moment(a.submittedAt?.toDate()).format('h:mm A')}</div>
                    </div>
                    <div class="font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/50 px-3 py-1 rounded text-xs">${scoreValue.toFixed(2)}</div>
                </div>`;
            });
            
            c.innerHTML = `
            <div class="pb-6">
                <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition"><i class="fas fa-arrow-left mr-1"></i> Rankings</button>
                
                <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-lg mb-6 text-center">
                    <h3 class="font-bold text-white text-lg">${title}</h3>
                    <div class="grid grid-cols-2 gap-4 mt-5">
                        <div class="bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                            <div class="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Students</div>
                            <div class="text-xl font-bold text-white">${snap.size}</div>
                        </div>
                        <div class="bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                            <div class="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Highest Score</div>
                            <div class="text-xl font-bold text-emerald-400">${highest.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="mt-3 flex justify-end">
                        <button onclick="Teacher.openExamAnalysis('${eid}')" class="text-indigo-300 hover:text-indigo-100 px-3 py-1 rounded-full text-xs font-bold transition border border-indigo-500/50">
                            <i class="fas fa-chart-bar mr-1"></i> Analysis
                        </button>
                    </div>
                </div>

                <div class="bg-white dark:bg-dark-secondary rounded-2xl border dark:border-dark-tertiary overflow-hidden shadow-sm">
                    <div class="bg-slate-50 dark:bg-dark-tertiary/50 p-3 text-[10px] font-bold text-slate-500 flex uppercase tracking-widest border-b dark:border-dark-tertiary">
                        <div class="w-8 text-center">Pos</div>
                        <div class="flex-1 ml-3">Student Details</div>
                        <div>Score</div>
                    </div>
                    <div class="max-h-[60vh] overflow-y-auto">
                        ${rows}
                    </div>
                </div>
                <p class="text-[10px] text-slate-400 text-center mt-4 italic">Click to view student's detailed answer script</p>
            </div>`;
        }, (error) => {
            console.error("Snapshot Error:", error);
            Swal.fire('Query Error', 'Indexing may take some time or check browser console.', 'error');
        });
        unsubscribes.push(unsub);

    } catch (e) {
        console.error("ViewRank Error:", e);
        Swal.fire('Error', 'Failed to load rankings.', 'error');
        Teacher.rankView();
    }
};

// Analysis Function (adapted from Student Panel)
Teacher.openExamAnalysis = async (examId) => {
    const c = document.getElementById('app-container');
    c.innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div><p>Loading analysis...</p></div>';
    
    try {
        const examDoc = await getDoc(doc(db, "exams", examId));
        if (!examDoc.exists()) throw new Error("Exam not found");
        const examData = examDoc.data();
        
        if (!examData.questions) throw new Error("Question paper not found");
        let questions;
        try {
            questions = JSON.parse(examData.questions);
        } catch (e) {
            throw new Error("Invalid question paper format");
        }
        if (!Array.isArray(questions) || questions.length === 0) throw new Error("No questions found");
        
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
                    <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500"><i class="fas fa-arrow-left"></i> Back to Rankings</button>
                    <div class="p-10 text-slate-400">No one has taken this exam yet.</div>
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
            <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                <i class="fas fa-arrow-left"></i> Back to Rankings
            </button>
            <h2 class="text-xl font-bold mb-4 text-center dark:text-white">${examData.title} - Detailed Analysis</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">Total Participants: ${totalAttempts}</p>
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
                    <span class="font-bold">Question ${i+1}</span>
                    <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Correct Answer: ${correctOpt}</span>
                </div>
                <p class="font-semibold mb-3 math-render">${qText}</p>
                <div class="space-y-1 mb-4">
                    ${optionsHtml}
                </div>
                ${q.expl ? `<div class="text-xs p-3 rounded mb-3 explanation-box"><b>Explanation:</b> ${window.MathHelper.renderExamContent(q.expl)}</div>` : ''}
                
                <div class="mt-3">
                    <div class="flex items-center gap-2 text-xs mb-2">
                        <span class="w-16">Correct ${q.correctCount}</span>
                        <span class="w-16 text-right">Wrong ${q.wrongCount}</span>
                        <span class="w-16 text-right">Skipped ${q.skippedCount}</span>
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
        Swal.fire('Error', 'Failed to load analysis', 'error');
        Teacher.rankView();
    }
};

Teacher.viewUserResult = async (attemptId) => {
    const c = document.getElementById('app-container');
    c.innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-2 text-xs">Loading result...</p></div>';
    
    try {
        const attSnap = await getDoc(doc(db, "attempts", attemptId));
        if(!attSnap.exists()) throw new Error("Result not found");
        
        const att = attSnap.data();
        const exSnap = await getDoc(doc(db, "exams", att.examId));
        if(!exSnap.exists()) throw new Error("Exam not found");
        
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
            timeTaken = `${diff} min`;
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
                let badge = '<span class="text-amber-600 font-bold text-xs">Skipped</span>';
                
                if(u !== undefined && u === corr) { 
                    st = 'correct'; 
                    stats.correct++; 
                    badge = '<span class="text-emerald-600 font-bold text-xs">Correct</span>'; 
                } else if (u !== undefined && u !== null) { 
                    st = 'wrong'; 
                    stats.wrong++; 
                    badge = '<span class="text-red-600 font-bold text-xs">Wrong</span>'; 
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
                        <span class="font-bold text-sm text-slate-700 dark:text-white">Question ${originalIndex+1}</span>
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
                            
                            return `<div class="${cls}"><span>${String.fromCharCode(65+oi)}. ${optionText}</span> ${icon}</div>`;
                        }).join('')}
                    </div>
                    <div class="mt-3 text-xs bg-white/60 dark:bg-dark-tertiary p-3 rounded border border-slate-200 dark:border-dark-tertiary">
                        <span class="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Explanation:</span>
                        ${q.expl ? `<span>${window.MathHelper.renderExamContent(q.expl)}</span>` : "<span>No explanation provided.</span>"}
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
                    <button onclick="Teacher.setResultFilter('all')" class="filter-btn ${window.resultFilter === 'all' ? 'active bg-indigo-600 text-white border-indigo-600' : ''}">
                        All (${qs.length})
                    </button>
                    <button onclick="Teacher.setResultFilter('correct')" class="filter-btn correct ${window.resultFilter === 'correct' ? 'active' : ''}">
                        Correct (${correctAnswers})
                    </button>
                    <button onclick="Teacher.setResultFilter('wrong')" class="filter-btn wrong ${window.resultFilter === 'wrong' ? 'active' : ''}">
                        Wrong (${userAnswers.filter(a => a !== null && a !== undefined).length - correctAnswers})
                    </button>
                    <button onclick="Teacher.setResultFilter('skipped')" class="filter-btn skipped ${window.resultFilter === 'skipped' ? 'active' : ''}">
                        Skipped (${qs.length - userAnswers.filter(a => a !== null && a !== undefined).length})
                    </button>
                </div>
            `;
            
            const pagination = totalPages > 1 ? `
                <div class="pagination flex justify-between items-center mt-4">
                    <button onclick="Teacher.prevResultPage()" class="page-btn bg-slate-100 dark:bg-dark-tertiary px-3 py-1 rounded text-sm ${window.currentResultPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${window.currentResultPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left"></i> Previous
                    </button>
                    <span class="text-sm">Page ${window.currentResultPage} of ${totalPages}</span>
                    <button onclick="Teacher.nextResultPage()" class="page-btn bg-slate-100 dark:bg-dark-tertiary px-3 py-1 rounded text-sm ${window.currentResultPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${window.currentResultPage === totalPages ? 'disabled' : ''}>
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            ` : '';
            
            const header = `
            <div class="compact-summary-card">
                <div class="compact-header">
                    <div class="flex-1">
                        <div class="compact-title">${att.userName}</div>
                        <div class="compact-date">${exam.title}</div>
                    </div>
                    <div class="compact-score-section">
                        <div class="compact-score">${parseFloat(att.score).toFixed(2)}</div>
                        <div class="compact-accuracy">${accuracy}% Acc.</div>
                    </div>
                </div>
                <div class="compact-grid">
                    <div class="compact-stat-item">
                        <div class="compact-stat-value">${qs.length}</div>
                        <div class="compact-stat-label">Total</div>
                    </div>
                    <div class="compact-stat-item">
                        <div class="compact-stat-value text-emerald-600">${correctAnswers}</div>
                        <div class="compact-stat-label">Correct</div>
                    </div>
                    <div class="compact-stat-item">
                        <div class="compact-stat-value text-red-500">${userAnswers.filter(a => a !== null && a !== undefined).length - correctAnswers}</div>
                        <div class="compact-stat-label">Wrong</div>
                    </div>
                    <div class="compact-stat-item">
                        <div class="compact-stat-value">${qs.length - userAnswers.filter(a => a !== null && a !== undefined).length}</div>
                        <div class="compact-stat-label">Skip</div>
                    </div>
                    <div class="compact-stat-item border-2 border-indigo-100">
                        <div class="compact-stat-value text-indigo-600">${userRank}</div>
                        <div class="compact-stat-label">Rank</div>
                    </div>
                    <div class="compact-stat-item">
                        <div class="compact-stat-value">${timeTaken}</div>
                        <div class="compact-stat-label">Time</div>
                    </div>
                    <div class="compact-stat-item">
                        <div class="compact-stat-value">${totalParticipants}</div>
                        <div class="compact-stat-label">Total Students</div>
                    </div>
                    <div class="compact-stat-item">
                        <div class="compact-stat-value">${highestScore.toFixed(2)}</div>
                        <div class="compact-stat-label">Highest</div>
                    </div>
                </div>
            </div>
            `;
            
            c.innerHTML = `
                <div class="pb-6">
                    <button onclick="Teacher.rankView()" class="mb-4 text-xs font-bold text-slate-500">
                        <i class="fas fa-arrow-left"></i> Back to Rankings
                    </button>
                    <h2 class="font-bold text-xl mb-4 dark:text-white">User Result Analysis</h2>
                    ${header}
                    ${filterButtons}
                    ${result.html || '<div class="text-center p-10 text-slate-400">No questions match the filter</div>'}
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
        Swal.fire('Error', e.message, 'error');
        Teacher.rankView();
    }
};
