 // js/student.js
// Student module - all student-related functionality

import { auth, db } from './config.js';
import { 
    AppState, 
    ExamCache, 
    unsubscribes, 
    currentResultPage, 
    resultFilter, 
    filteredQuestions,
    resultTypeFilter,
    pastSubjectFilter,
    resultsSubjectFilter,
    rankSearchQuery,
    allRankAttempts,
    clearListeners,
    loadMathJax,
    StarRating,
    MathHelper,
    renderHeader,
    refreshExamCache
} from './state.js';
import { renderRankSkeleton, renderAnalysisSkeleton, renderManagementSkeleton, renderResultsSkeleton } from './ui.js';
import { OfflineManager } from './offline.js';

import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs,
    onSnapshot,
    addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { 
    signInWithEmailAndPassword, 
    updatePassword, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

export const Student = {
    initNotificationListener: () => {
        if (!AppState.activeGroupId) return;
        const uid = auth.currentUser.uid;
        const q = query(
            collection(db, "notices"),
            where("groupId", "==", AppState.activeGroupId)
        );
        const unsub = onSnapshot(q, (snap) => {
            let unreadCount = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if (!data.views || !data.views[uid]) {
                    unreadCount++;
                }
            });
            const badge = document.getElementById('notification-badge');
            const badgeMobile = document.getElementById('notification-badge-mobile');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.classList.remove('hidden');
                    badge.classList.add('animate-pulse');
                } else {
                    badge.classList.add('hidden');
                }
            }
            if (badgeMobile) {
                if (unreadCount > 0) {
                    badgeMobile.textContent = unreadCount;
                    badgeMobile.classList.remove('hidden');
                } else {
                    badgeMobile.classList.add('hidden');
                }
            }
        });
        unsubscribes.push(unsub);
    },

    loadNotices: async () => {
        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('notices') + '<div class="p-5"><div class="loader mx-auto"></div></div>';

        const q = query(
            collection(db, "notices"),
            where("groupId", "==", AppState.activeGroupId),
            orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const notices = [];
        snap.forEach(d => notices.push({ id: d.id, ...d.data() }));

        const uid = auth.currentUser.uid;
        let html = `<div class="p-5 pb-20"><h2 class="text-xl font-bold mb-4">নোটিস ও পোল</h2>`;

        if (notices.length === 0) {
            html += `<div class="text-center p-8 text-slate-400">কোনো নোটিস নেই</div>`;
        } else {
            notices.forEach(n => {
                const isPoll = n.type === 'poll';
                const hasVoted = isPoll && n.votes && n.votes[uid] !== undefined;
                const userVote = hasVoted ? n.votes[uid] : null;

                if (!n.views || !n.views[uid]) {
                    updateDoc(doc(db, "notices", n.id), {
                        [`views.${uid}`]: new Date()
                    }).catch(console.error);
                }

                html += `<div class="bg-white dark:bg-dark-secondary p-4 rounded-xl border mb-4">`;
                html += `<span class="text-xs font-bold px-2 py-1 rounded ${isPoll ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${isPoll ? '📊 পোল' : '📢 নোটিস'}</span>`;
                html += `<h3 class="font-bold text-lg mt-2">${n.title}</h3>`;
                if (!isPoll) {
                    html += `<p class="text-sm mt-2 whitespace-pre-line">${n.content}</p>`;
                } else {
                    const totalVotes = Object.keys(n.votes || {}).length;
                    html += `<div class="mt-3 space-y-2">`;
                    n.options.forEach((opt, idx) => {
                        const voteCount = Object.values(n.votes || {}).filter(v => v === idx).length;
                        const percent = totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0;
                        const isSelected = userVote === idx;
                        html += `<div class="relative">
                            <div class="flex items-center gap-2 p-2 border rounded ${isSelected ? 'bg-indigo-50 border-indigo-300' : ''}">
                                ${!hasVoted ? 
                                    `<input type="radio" name="poll_${n.id}" value="${idx}" onchange="Student.votePoll('${n.id}', ${idx})" class="mr-2">` : 
                                    (isSelected ? '<i class="fas fa-check-circle text-indigo-600 mr-2"></i>' : '')
                                }
                                <span class="flex-1">${opt}</span>
                                ${hasVoted ? `<span class="text-sm">${voteCount} (${percent}%)</span>` : ''}
                            </div>`;
                        if (hasVoted) {
                            html += `<div class="h-2 bg-gray-200 rounded mt-1"><div class="h-2 bg-indigo-500 rounded" style="width:${percent}%"></div></div>`;
                        }
                        html += `</div>`;
                    });
                    html += `</div>`;
                    if (hasVoted) {
                        html += `<p class="text-xs text-slate-500 mt-2">আপনি ভোট দিয়েছেন • মোট ভোট: ${totalVotes}</p>`;
                    }
                }
                html += `<div class="text-xs text-slate-400 mt-3">${moment(n.createdAt.toDate()).format('DD MMM, YYYY h:mm A')}</div>`;
                html += `</div>`;
            });
        }
        html += `</div>`;
        c.innerHTML = renderHeader('notices') + html;
    },

    votePoll: async (noticeId, optionIndex) => {
        const uid = auth.currentUser.uid;
        try {
            await updateDoc(doc(db, "notices", noticeId), {
                [`votes.${uid}`]: optionIndex
            });
            Student.loadNotices();
        } catch (e) {
            Swal.fire('ত্রুটি', 'ভোট দেওয়া যায়নি', 'error');
        }
    },

    loadAllGroupsForTeacher: async (teacherCode) => {
        try {
            if (!teacherCode) return [];
            const q = query(collection(db, "groups"), where("teacherCode", "==", teacherCode));
            const snap = await getDocs(q);
            const groups = [];
            snap.forEach(doc => groups.push({ groupId: doc.id, ...doc.data() }));
            return groups;
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    loadRankings: async () => {
        const myRouteId = window.currentRouteId;

        if (AppState.userDisabled) {
            Swal.fire('প্রবেশাধিকার নেই', 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়।', 'warning');
            return;
        }
        if (!AppState.activeGroupId) {
            Swal.fire('কোর্স প্রয়োজন', 'র‍্যাংক দেখতে আগে একটি কোর্সে যোগ দিন।', 'warning');
            return;
        }

        const c = document.getElementById('app-container');
        const q = query(
            collection(db, "exams"), 
            where("groupId", "==", AppState.activeGroupId),
            where("type", "==", "live"),
            where("resultPublished", "==", true)
        );
        
        const snap = await getDocs(q);
        if (myRouteId !== window.currentRouteId) return;

        const exams = [];
        snap.forEach(doc => exams.push({ id: doc.id, ...doc.data() }));
        exams.sort((a,b) => b.createdAt - a.createdAt);
        
        if (exams.length === 0) {
            c.innerHTML = renderHeader('rank') + `<div class="p-5 pb-20 text-center">
                <div class="p-10 text-slate-400">কোনো পরীক্ষার ফলাফল এখনো প্রকাশ করা হয়নি।</div>
            </div>`;
            return;
        }
        
        let h = exams.map(e => `
            <div onclick="Student.openRank('${e.id}', '${e.title}')" class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-3 flex justify-between items-center cursor-pointer hover:scale-[1.02] transition-all">
                <div>
                    <div class="font-bold text-sm">${e.title}</div>
                    <div class="text-xs text-slate-400 mt-1">${e.subject || ''} • ${moment(e.createdAt.toDate()).format('DD MMM, YYYY')}</div>
                </div>
                <div class="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>`).join('');

        c.innerHTML = renderHeader('rank') + `<div class="p-5 pb-20">
            ${h}
        </div>`;
    },

    openRank: async (eid, title) => {
        const myRouteId = window.currentRouteId;
        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('rank') + '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-2 text-xs">র‍্যাংক লোড হচ্ছে...</p></div>';
        
        try {
            const exSnap = await getDoc(doc(db, "exams", eid));
            if (!exSnap.exists()) throw new Error("পরীক্ষা পাওয়া যায়নি");
            
            const exam = { id: exSnap.id, ...exSnap.data() };
            const qs = JSON.parse(exam.questions);
            window.currentExamForAnalysis = exam;
            window.currentQuestionsForAnalysis = qs;
            window.currentExamIdForRank = eid;
            window.currentExamTitle = exam.title;

            const rankQuery = query(
                collection(db, "attempts"), 
                where("examId", "==", eid),
                where("isPractice", "==", false),
                orderBy("score", "desc"),
                orderBy("submittedAt", "asc")
            );
            
            const snap = await getDocs(rankQuery);
            const attempts = [];
            snap.forEach(d => attempts.push({ id: d.id, ...d.data() }));

            const studentIds = [...new Set(attempts.map(a => a.userId))];
            const studentMap = {};
            await Promise.all(studentIds.map(async (sid) => {
                const sdoc = await getDoc(doc(db, "students", sid));
                if (sdoc.exists()) {
                    const data = sdoc.data();
                    studentMap[sid] = {
                        school: data.schoolName || '',
                        college: data.collegeName || ''
                    };
                }
            }));

            attempts.forEach(a => {
                if (a.startedAt && a.submittedAt) {
                    const diffMs = a.submittedAt.toDate() - a.startedAt.toDate();
                    a.timeTakenSeconds = Math.floor(diffMs / 1000);
                } else {
                    a.timeTakenSeconds = Infinity;
                }
                const totalQ = qs.length;
                if (totalQ > 0) {
                    const correct = a.answers.filter((ans, idx) => ans === qs[idx].correct).length;
                    a.accuracy = (correct / totalQ) * 100;
                } else {
                    a.accuracy = 0;
                }
            });

            allRankAttempts.length = 0;
            allRankAttempts.push(...attempts);
            window.rankStudentMap = studentMap;

            Student.renderRankList();
        } catch (e) {
            if (myRouteId !== window.currentRouteId) return;
            Swal.fire('ত্রুটি', 'র‍্যাংক লোড করা সম্ভব হয়নি।', 'error');
            Student.loadRankings();
        }
    },

    renderRankList: () => {
        const c = document.getElementById('app-container');
        const uid = auth.currentUser.uid;
        const searchQuery = rankSearchQuery.toLowerCase();

        let filtered = allRankAttempts;
        if (searchQuery) {
            filtered = filtered.filter(a => {
                const student = window.rankStudentMap[a.userId] || {};
                const name = (a.userName || '').toLowerCase();
                const school = (student.school || '').toLowerCase();
                const college = (student.college || '').toLowerCase();
                return name.includes(searchQuery) || school.includes(searchQuery) || college.includes(searchQuery);
            });
        }

        let myRank = 'N/A';
        let myScore = 0;
        filtered.forEach((a, i) => {
            if (a.userId === uid) {
                myRank = i + 1;
                myScore = a.score || 0;
            }
        });

        let rows = '';
        filtered.forEach((a, i) => {
            const isMe = a.userId === uid;
            const studentInfo = window.rankStudentMap[a.userId] || {};
            const displayInstitute = studentInfo.college || studentInfo.school || '';
            const accuracy = a.accuracy || 0;

            let timeDisplay = 'N/A';
            if (a.timeTakenSeconds && a.timeTakenSeconds !== Infinity) {
                const mins = Math.floor(a.timeTakenSeconds / 60);
                const secs = a.timeTakenSeconds % 60;
                timeDisplay = `${mins}m ${secs}s`;
            }

            let rankBadge = `<span class="font-bold text-slate-500 text-lg">${i+1}</span>`;
            let cardClass = 'p-3 border-b flex items-center' + (document.documentElement.classList.contains('theme-dark') ? ' bg-opacity-0' : ' bg-white');
            if (i === 0) { 
                rankBadge = '<span class="rank-badge-large">🥇</span>'; 
                cardClass += ' rank-card-top rank-1'; 
            } else if (i === 1) { 
                rankBadge = '<span class="rank-badge-large">🥈</span>'; 
                cardClass += ' rank-card-top rank-2'; 
            } else if (i === 2) { 
                rankBadge = '<span class="rank-badge-large">🥉</span>'; 
                cardClass += ' rank-card-top rank-3'; 
            }
            if (isMe) cardClass += ' bg-indigo-50 border-indigo-200';

            rows += `
            <div class="${cardClass}">
                <div class="w-10 text-center">${rankBadge}</div>
                <div class="flex-1 ml-3">
                    <div class="font-bold text-sm">${a.userName} ${isMe?'(You)':''}</div>
                    <div class="text-[9px] text-slate-500">${displayInstitute}</div>
                    <div class="text-[9px] text-slate-400"><i class="far fa-clock"></i> ${timeDisplay}</div>
                    <div class="mt-1">${StarRating(accuracy)}</div>
                </div>
                <div class="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded text-sm">${(a.score || 0).toFixed(2)}</div>
            </div>`;
        });

        const title = window.currentExamTitle || 'Exam';
        c.innerHTML = renderHeader('rank') + `
        <div class="p-5 pb-20" style="background-color:var(--bg-primary);">
            <button onclick="Student.loadRankings()" class="mb-4 text-xs font-bold" style="color:var(--text-muted);"><i class="fas fa-arrow-left"></i> ফিরে যান</button>
            <div class="rounded-xl p-4 mb-6 shadow-sm border" style="background-color:var(--card-bg);border-color:var(--border-light);">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-bold text-base">${title}</h3>
                        <div class="text-xs text-slate-500">অংশগ্রহণকারী: ${filtered.length}</div>
                    </div>
                    <div class="text-right">
                        <span class="text-xs text-indigo-600 px-3 py-1 rounded-full block mb-1" style="background-color:var(--expl-bg);">আমার র‍্যাংক: ${myRank}</span>
                        <span class="text-xs text-emerald-600 px-3 py-1 rounded-full block" style="background-color:#0a2e1e;">আমার মার্ক: ${myScore.toFixed(2)}</span>
                    </div>
                </div>
                <div class="mt-3 flex justify-end">
                    <button onclick="Student.openExamAnalysis('${window.currentExamIdForRank}')" class="text-indigo-700 px-3 py-1 rounded-full text-xs font-bold transition" style="background-color:var(--expl-bg);">বিশ্লেষণ</button>
                </div>
            </div>
            <div class="mb-4">
                <div class="results-search-box">
                    <input type="text" id="rank-search-input" placeholder="নাম, স্কুল বা কলেজ দিয়ে খুঁজুন..." value="${rankSearchQuery}">
                    <button onclick="Student.performRankSearch()" class="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-500 text-white px-3 py-1 rounded text-xs">খুঁজুন</button>
                    <i class="fas fa-search search-icon" style="right: 70px;"></i>
                </div>
            </div>
            <div class="rounded-xl border overflow-hidden shadow-sm" style="background-color:var(--card-bg);border-color:var(--border-light);">
                ${rows || '<div class="p-10 text-center text-slate-400">কোনো ফলাফল পাওয়া যায়নি।</div>'}
            </div>
        </div>`;
        loadMathJax(null, c);
    },

    performRankSearch: () => {
        const input = document.getElementById('rank-search-input');
        if (input) {
            rankSearchQuery = input.value;
            Student.renderRankList();
        }
    },

    openExamAnalysis: async (examId) => {
        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('rank') + '<div class="p-10 text-center"><div class="loader mx-auto"></div><p>বিশ্লেষণ লোড হচ্ছে...</p></div>';
        
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
                c.innerHTML = renderHeader('rank') + `
                    <div class="p-5 pb-20 text-center">
                        <button onclick="Student.loadRankings()" class="mb-4 text-xs font-bold" style="color:var(--text-muted);"><i class="fas fa-arrow-left"></i> র‍্যাংকে ফিরুন</button>
                        <div class="p-10 text-slate-400">এখনো কেউ এই পরীক্ষায় অংশগ্রহণ করেনি</div>
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
                <button onclick="Student.loadRankings()" class="mb-4 text-xs font-bold" style="color:var(--text-muted);"><i class="fas fa-arrow-left"></i> র‍্যাংকে ফিরুন</button>
                <h2 class="text-xl font-bold mb-4 text-center">${examData.title} - বিস্তারিত বিশ্লেষণ</h2>
                <p class="text-sm text-slate-500 mb-6 text-center">মোট পরীক্ষার্থী: ${totalAttempts}</p>
            `;
            
            questionStats.forEach((q, i) => {
                const qText = MathHelper.renderExamContent(q.q);
                const correctOpt = String.fromCharCode(65 + q.correct);
                
                let optionsHtml = '';
                q.options.forEach((opt, oi) => {
                    const optText = MathHelper.renderExamContent(opt);
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
                        <span class="font-bold">প্রশ্ন ${i+1}</span>
                        <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">সঠিক উত্তর: ${correctOpt}</span>
                    </div>
                    <p class="font-semibold mb-3 math-render">${qText}</p>
                    <div class="space-y-1 mb-4">
                        ${optionsHtml}
                    </div>
                    ${q.expl ? `<div class="text-xs p-3 rounded mb-3 explanation-box" style="background-color:var(--expl-bg);border:1px solid var(--expl-border);color:var(--text-primary);"><b style="color:var(--expl-text);">ব্যাখ্যা:</b> ${MathHelper.renderExamContent(q.expl)}</div>` : ''}
                    
                    <div class="mt-3">
                        <div class="flex items-center gap-2 text-xs mb-2">
                            <span class="w-16">সঠিক ${q.correctCount}</span>
                            <span class="w-16 text-right">ভুল ${q.wrongCount}</span>
                            <span class="w-16 text-right">স্কিপ ${q.skippedCount}</span>
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
            c.innerHTML = renderHeader('rank') + html;
            
            loadMathJax(null, c);
        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'বিশ্লেষণ লোড করতে ব্যর্থ', 'error');
            Student.loadRankings();
        }
    },

    loadTeacherNames: async () => {
        try {
            const teacherNames = {};
            for (const tc of AppState.teacherCodes) {
                const teachersQuery = query(collection(db, "teachers"), where("teacherCode", "==", tc.code));
                const querySnapshot = await getDocs(teachersQuery);
                if (!querySnapshot.empty) {
                    const teacherDoc = querySnapshot.docs[0];
                    const teacherData = teacherDoc.data();
                    teacherNames[tc.code] = teacherData.fullName || teacherData.name || "Unknown Teacher";
                } else {
                    teacherNames[tc.code] = "Unknown Teacher";
                }
            }
            AppState.teacherNames = teacherNames;
        } catch (error) {
            console.error(error);
        }
    },

    getTeacherName: (teacherCode) => {
        return AppState.teacherNames[teacherCode] || "Unknown Teacher";
    },

    verifyTeacherCode: async (teacherCode) => {
        try {
            const teachersQuery = query(collection(db, "teachers"), where("teacherCode", "==", teacherCode));
            const querySnapshot = await getDocs(teachersQuery);
            return !querySnapshot.empty;
        } catch (error) {
            console.error(error);
            return false;
        }
    },

    getTeacherInfo: async (teacherCode) => {
        try {
            const teachersQuery = query(collection(db, "teachers"), where("teacherCode", "==", teacherCode));
            const querySnapshot = await getDocs(teachersQuery);
            
            if (querySnapshot.empty) return { name: "Unknown Teacher", phone: "" };
            
            const teacherDoc = querySnapshot.docs[0];
            const teacherData = teacherDoc.data();
            
            return { 
                name: teacherData.fullName || teacherData.name || "Unknown Teacher",
                phone: teacherData.phone || ""
            };
        } catch (error) {
            console.error(error);
            return { name: "Unknown Teacher", phone: "" };
        }
    },

    getGroupInfo: async (groupId) => {
        try {
            if (!groupId) return { name: "No Course", totalStudents: 0 };
            
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            
            if (!groupDoc.exists()) return { name: "Unknown Course", totalStudents: 0 };
            
            const groupData = groupDoc.data();
            const studentIds = groupData.studentIds || [];
            
            return { 
                name: groupData.name || groupData.code || "Unknown Course",
                totalStudents: studentIds.length,
                teacherName: groupData.teacherName || "",
                teacherPhone: groupData.teacherPhone || "",
                teacherCode: groupData.teacherCode || "",
                teacherId: groupData.teacherId || ""
            };
        } catch (error) {
            console.error(error);
            return { name: "Error Loading", totalStudents: 0 };
        }
    },

    getGroupStudents: async (groupId) => {
        try {
            if (!groupId) return [];
            
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (!groupDoc.exists()) return [];
            
            const groupData = groupDoc.data();
            const studentIds = groupData.studentIds || [];
            
            if (studentIds.length === 0) return [];
            
            const students = [];
            
            for (const studentId of studentIds) {
                const studentDoc = await getDoc(doc(db, "students", studentId));
                if (studentDoc.exists()) {
                    const studentData = studentDoc.data();
                    if (studentData.blocked) continue;
                    
                    students.push({
                        id: studentId,
                        name: studentData.name || "No Name",
                        email: studentData.email || "No Email",
                        disabled: studentData.disabled || false
                    });
                }
            }
            
            return students;
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    loadGroupsForCurrentTeacher: async () => {
        try {
            const currentTeacherCode = AppState.activeTeacherCode;
            if (!currentTeacherCode) return [];
            
            const user = auth.currentUser;
            if (!user) return [];
            
            const groupsQuery = query(
                collection(db, "groups"), 
                where("teacherCode", "==", currentTeacherCode)
            );
            
            const querySnapshot = await getDocs(groupsQuery);
            const groups = [];
            
            querySnapshot.forEach((doc) => {
                const groupData = doc.data();
                if (groupData.studentIds && groupData.studentIds.includes(user.uid)) {
                    groups.push({
                        groupId: doc.id,
                        groupName: groupData.name || groupData.code || "Unknown Course",
                        teacherCode: currentTeacherCode
                    });
                }
            });
            
            return groups;
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    showGroupCodeModal: () => {
        document.getElementById('group-code-modal').classList.remove('hidden');
    },
    
    hideGroupCodeModal: () => {
        document.getElementById('group-code-modal').classList.add('hidden');
    },
    
    showGroupMembersModal: async (groupId) => {
        const modal = document.getElementById('group-members-modal');
        const title = document.getElementById('group-members-title');
        const subtitle = document.getElementById('group-members-subtitle');
        const list = document.getElementById('group-members-list');
        
        modal.classList.remove('hidden');
        
        list.innerHTML = '<div class="text-center p-10"><div class="loader mx-auto"></div><p class="text-xs text-slate-400 mt-2">সদস্য লোড হচ্ছে...</p></div>';
        
        try {
            const groupInfo = await Student.getGroupInfo(groupId);
            const students = await Student.getGroupStudents(groupId);
            
            title.textContent = groupInfo.name + ' - সদস্যবৃন্দ';
            subtitle.textContent = `মোট ${students.length} জন সদস্য`;
            
            if (students.length === 0) {
                list.innerHTML = '<div class="text-center p-10" style="color:var(--text-muted);"><i class="fas fa-users text-4xl mb-3 opacity-30"></i><p>এই কোর্সে কোনো সদস্য নেই</p></div>';
            } else {
                const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
                let studentsHTML = '';
                students.forEach((student, index) => {
                    const isCurrentUser = student.id === currentUserId;
                    studentsHTML += `
                    <div class="group-member-item">
                        <div class="group-member-avatar">${student.name.charAt(0)}</div>
                        <div class="group-member-info">
                            <div class="group-member-name">
                                ${student.name} ${isCurrentUser ? '<span class="text-indigo-500 font-normal">(আপনি)</span>' : ''}
                            </div>
                        </div>
                        <div class="student-status ${student.disabled ? 'status-disabled' : 'status-active'}">
                            ${student.disabled ? 'নিষ্ক্রিয়' : 'সক্রিয়'}
                        </div>
                    </div>`;
                });
                list.innerHTML = studentsHTML;
            }
        } catch (error) {
            list.innerHTML = '<div class="text-center p-10 text-red-400"><i class="fas fa-exclamation-circle text-3xl mb-3"></i><p>সদস্য লোড করতে ত্রুটি</p></div>';
        }
    },
    
    hideGroupMembersModal: () => {
        document.getElementById('group-members-modal').classList.add('hidden');
    },
    
    saveGroupCode: async () => {
        const groupCode = document.getElementById('group-code-input').value.trim();
        
        if (!groupCode) {
            Swal.fire('ত্রুটি', 'কোর্স কোড দিন', 'error');
            return;
        }
        
        if (!navigator.onLine) {
            Swal.fire('অফলাইন', 'ইন্টারনেট সংযোগ ছাড়া কোর্সে যোগ দেওয়া যাবে না।', 'warning');
            return;
        }
        
        try {
            const gQuery = query(collection(db, "groups"), where("groupCode", "==", groupCode));
            const gSnap = await getDocs(gQuery);
            
            if (gSnap.empty) {
                Swal.fire('ত্রুটি', 'ভুল কোর্স কোড!', 'error');
                return;
            }
            
            const groupDoc = gSnap.docs[0];
            const groupData = groupDoc.data();
            const groupId = groupDoc.id;
            
            const user = auth.currentUser;
            
            let joinedGroups = AppState.userProfile.joinedGroups || [];
            
            if (joinedGroups.find(g => g.groupId === groupId)) {
                Swal.fire('তথ্য', 'আপনি ইতিমধ্যে এই কোর্সে যুক্ত আছেন', 'info');
                return;
            }
            
            // teacherCode বাদ দিয়ে শুধু groupId ও groupName রাখা হয়েছে
            joinedGroups.push({ groupId, groupName: groupData.name });
            
            await updateDoc(doc(db, "students", user.uid), { joinedGroups });
            
            const studentIds = groupData.studentIds || [];
            if(!studentIds.includes(user.uid)) {
                studentIds.push(user.uid);
                await updateDoc(doc(db, "groups", groupId), { studentIds });
            }
            
            AppState.activeGroupId = groupId;
            localStorage.setItem('activeGroupId', groupId);
            AppState.joinedGroups = joinedGroups;
            AppState.userProfile.joinedGroups = joinedGroups;
            
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            
            refreshExamCache();
            
            Student.hideGroupCodeModal();
            Swal.fire('সফল', `${groupData.name} কোর্সে জয়েন হয়েছেন`, 'success').then(() => {
                import('./router.js').then(({ Router }) => {
                    Router.student('dashboard');
                });
            });
            
        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'কোর্সে জয়েন ব্যর্থ', 'error');
        }
    },
    
    // Updated switchGroup function with UI sync for course switcher
    switchGroup: async (groupId) => {
        AppState.activeGroupId = groupId;
        localStorage.setItem('activeGroupId', groupId);
        refreshExamCache();
        
        // Update UI: change the course name display in desktop header
        const activeGroup = (AppState.joinedGroups || []).find(g => g.groupId === groupId);
        if (activeGroup) {
            const displayName = document.getElementById('current-course-name-display');
            if (displayName) displayName.textContent = activeGroup.groupName || 'অজানা কোর্স';
            // Also update mobile select if present
            const mobileSelect = document.getElementById('mobile-course-switcher');
            if (mobileSelect) mobileSelect.value = groupId;
        }
        
        Swal.fire('সফল', 'কোর্স পরিবর্তন করা হয়েছে', 'success').then(() => {
            import('./router.js').then(({ Router }) => {
                Router.student('dashboard');
            });
        });
    },
    
    // ----- Course Switcher Dropdown Functions -----
    toggleCourseSwitcher: function() {
        const menu = document.getElementById('course-switcher-menu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
        // Add outside click listener if menu is opened
        if (menu && !menu.classList.contains('hidden')) {
            setTimeout(() => {
                window.addEventListener('click', Student.closeCourseSwitcherOnOutsideClick);
            }, 10);
        } else {
            window.removeEventListener('click', Student.closeCourseSwitcherOnOutsideClick);
        }
    },

    closeCourseSwitcherOnOutsideClick: function(e) {
        const btn = document.getElementById('course-switcher-btn');
        const menu = document.getElementById('course-switcher-menu');
        if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
            menu.classList.add('hidden');
            window.removeEventListener('click', Student.closeCourseSwitcherOnOutsideClick);
        }
    },

    switchCourseFromDropdown: async function(groupId) {
        const menu = document.getElementById('course-switcher-menu');
        if (menu) menu.classList.add('hidden');
        
        if (groupId === AppState.activeGroupId) return;
        
        await Student.switchGroup(groupId);
    },

    switchCourseFromMobile: async function(groupId) {
        if (!groupId || groupId === AppState.activeGroupId) return;
        await Student.switchGroup(groupId);
    },
    
    saveProfile: async () => {
        const fullName = document.getElementById('full-name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const fatherPhone = document.getElementById('father-phone').value.trim();
        const motherPhone = document.getElementById('mother-phone').value.trim();
        const schoolName = document.getElementById('school-name').value.trim();
        const collegeName = document.getElementById('college-name').value.trim();
        const teacherCode = document.getElementById('teacher-code').value.trim();
        const classLevel = document.getElementById('class-level').value;
        const admissionStream = document.getElementById('admission-stream')?.value || null;
        
        if (!fullName || !fatherPhone || !motherPhone || !schoolName || !teacherCode || !classLevel) {
            Swal.fire('ত্রুটি', 'সব আবশ্যক তথ্য পূরণ করুন', 'error');
            return;
        }
        
        if (classLevel === 'Admission' && !admissionStream) {
            Swal.fire('ত্রুটি', 'অনুগ্রহ করে শাখা নির্বাচন করুন', 'error');
            return;
        }
        
        const isValidTeacherCode = await Student.verifyTeacherCode(teacherCode);
        if (!isValidTeacherCode) {
            Swal.fire('ত্রুটি', 'ভুল শিক্ষক কোড', 'error');
            return;
        }
        
        const profileData = {
            name: fullName,
            phone: phone || "",
            fatherPhone: fatherPhone,
            motherPhone: motherPhone,
            schoolName: schoolName,
            collegeName: collegeName || "",
            classLevel: classLevel,
            admissionStream: admissionStream,
            teacherCodes: [{ code: teacherCode, active: true }],
            profileCompleted: true,
            updatedAt: new Date()
        };
        
        // অফলাইন হলে সিঙ্ক কিউতে জমা
        if (!navigator.onLine) {
            await DB.addToSyncQueue({
                collection: 'students',
                operation: 'update',
                docId: auth.currentUser.uid,
                payload: profileData
            });
            // লোকাল স্টেট আপডেট
            AppState.profileCompleted = true;
            AppState.userProfile = { ...AppState.userProfile, ...profileData };
            AppState.teacherCodes = [{ code: teacherCode, active: true }];
            AppState.activeTeacherCode = teacherCode;
            AppState.classLevel = classLevel;
            AppState.admissionStream = admissionStream;
            localStorage.setItem('studentClassLevel', classLevel);
            if (admissionStream) localStorage.setItem('studentAdmissionStream', admissionStream);
            const teacherInfo = await Student.getTeacherInfo(teacherCode);
            AppState.teacherNames = { [teacherCode]: teacherInfo.name };
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            localStorage.setItem('userLoggedIn', 'true');
            
            Swal.fire('অফলাইন', 'প্রোফাইল সংরক্ষিত হয়েছে, অনলাইনে এলে সিঙ্ক হবে।', 'info').then(() => {
                import('./router.js').then(({ Router }) => {
                    Router.initStudent();
                });
            });
            return;
        }
        
        try {
            const user = auth.currentUser;
            if (!user) return;
            
            await updateProfile(user, { displayName: fullName });
            
            const teacherInfo = await Student.getTeacherInfo(teacherCode);
            
            await updateDoc(doc(db, "students", user.uid), profileData);
            
            AppState.profileCompleted = true;
            AppState.userProfile = { ...AppState.userProfile, ...profileData };
            AppState.teacherCodes = [{ code: teacherCode, active: true }];
            AppState.activeTeacherCode = teacherCode;
            AppState.teacherNames = { [teacherCode]: teacherInfo.name };
            AppState.classLevel = classLevel;
            AppState.admissionStream = admissionStream;
            localStorage.setItem('studentClassLevel', classLevel);
            if (admissionStream) localStorage.setItem('studentAdmissionStream', admissionStream);
            
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            localStorage.setItem('userLoggedIn', 'true');
            
            Swal.fire('সফল', 'প্রোফাইল সংরক্ষিত হয়েছে!', 'success').then(() => {
                import('./router.js').then(({ Router }) => {
                    Router.initStudent();
                });
            });
        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'প্রোফাইল সংরক্ষণ ব্যর্থ', 'error');
        }
    },
    
    loadDashboard: async () => {
        const myRouteId = window.currentRouteId;
        const c = document.getElementById('app-container');

        c.innerHTML = renderHeader('dashboard') + `
        <div class="p-5 pb-20 max-w-lg mx-auto">
            <!-- Active Course Card (replaces old teacher card) -->
            <div id="active-course-card" class="bg-white dark:bg-dark-secondary rounded-2xl shadow-md border dark:border-dark-tertiary overflow-hidden mb-6">
                <div class="p-5">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 text-xl">
                            <i class="fas fa-book-open"></i>
                        </div>
                        <div class="flex-1">
                            <h4 class="font-bold dark:text-white">লোড হচ্ছে...</h4>
                            <p class="text-xs text-slate-500 dark:text-slate-400">কোর্স তথ্য</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Live & Mock Exam Cards -->
            <div class="grid grid-cols-1 gap-6">
                <button id="live-exam-card" onclick="Student.checkGroupAndLoad('live')" class="dashboard-card bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl">
                    <div class="dashboard-card-indicator live-now"></div>
                    <div class="dashboard-card-indicator upcoming"></div>
                    <div class="dashboard-card-content">
                        <div class="dashboard-card-icon"><i class="fas fa-broadcast-tower"></i></div>
                        <div class="dashboard-card-title">Live exam</div>
                    </div>
                </button>
                <button onclick="Student.checkGroupAndLoad('mock')" class="dashboard-card bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl">
                    <div class="dashboard-card-content">
                        <div class="dashboard-card-icon"><i class="fas fa-book-reader"></i></div>
                        <div class="dashboard-card-title">Mock exam</div>
                    </div>
                </button>
            </div>
        </div>`;

        if (AppState.activeGroupId) {
            try {
                // সরাসরি গ্রুপ ডকুমেন্ট থেকে পূর্ণ তথ্য আনা
                const groupDoc = await getDoc(doc(db, "groups", AppState.activeGroupId));
                if (!groupDoc.exists()) return;

                const group = groupDoc.data();
                const cardContainer = document.getElementById('active-course-card');
                if (!cardContainer) return;

                const classBadge = group.classLevel ? 
                    `<span class="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">${group.classLevel === 'Admission' ? 'এডমিশন' : group.classLevel}</span>` : '';
                const streamBadge = group.admissionStream ? 
                    `<span class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full ml-1">${group.admissionStream}</span>` : '';
                
                const imageHtml = group.imageUrl ? 
                    `<img src="${group.imageUrl}" alt="${group.name}" class="w-full h-36 object-cover rounded-t-2xl">` : 
                    `<div class="w-full h-36 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-2xl"><i class="fas fa-book-open"></i></div>`;

                cardContainer.innerHTML = `
                    ${imageHtml}
                    <div class="p-5">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h3 class="text-xl font-bold dark:text-white bengali-text">${group.name}</h3>
                                <div class="flex items-center gap-2 mt-1">
                                    ${classBadge} ${streamBadge}
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${group.studentIds?.length || 0}</div>
                                <div class="text-xs text-slate-500 dark:text-slate-400">শিক্ষার্থী</div>
                            </div>
                        </div>
                        <p class="text-xs text-slate-500 mb-1"><i class="fas fa-user-tie"></i> ${group.teacherName || 'শিক্ষক'}</p>
                        <p class="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-3">${group.description || 'কোনো বিবরণ নেই'}</p>
                        <div class="flex gap-2">
                            <button onclick="Student.showGroupMembersModal('${AppState.activeGroupId}')" class="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 py-2 rounded-lg text-xs font-bold">
                                <i class="fas fa-users mr-1"></i>সদস্য দেখুন
                            </button>
                            <button onclick="Router.student('courses')" class="flex-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 py-2 rounded-lg text-xs font-bold">
                                <i class="fas fa-plus mr-1"></i>নতুন কোর্স
                            </button>
                        </div>
                    </div>
                `;

                // লাইভ পরীক্ষার স্ট্যাটাস চেক (আগের মত)
                const snap = await getDocs(query(
                    collection(db, "exams"),
                    where("groupId", "==", AppState.activeGroupId),
                    where("type", "==", "live")
                ));
                const now = new Date();
                let hasOngoing = false, hasUpcoming = false;
                snap.forEach(doc => {
                    const e = doc.data();
                    if (e.isDraft || e.cancelled || e.resultPublished) return;
                    const startTime = new Date(e.startTime);
                    const endTime = new Date(e.endTime);
                    if (now >= startTime && now <= endTime) hasOngoing = true;
                    else if (now < startTime) hasUpcoming = true;
                });
                const liveCard = document.getElementById('live-exam-card');
                if (liveCard) {
                    if (hasOngoing) {
                        liveCard.classList.add('has-live');
                        liveCard.classList.remove('has-upcoming');
                    } else if (hasUpcoming) {
                        liveCard.classList.add('has-upcoming');
                        liveCard.classList.remove('has-live');
                    } else {
                        liveCard.classList.remove('has-live', 'has-upcoming');
                    }
                }
            } catch (e) {
                console.error("Dashboard error:", e);
            }
        } else {
            // কোনো অ্যাক্টিভ কোর্স না থাকলে
            const cardContainer = document.getElementById('active-course-card');
            if (cardContainer) {
                cardContainer.innerHTML = `
                    <div class="p-5 text-center">
                        <i class="fas fa-info-circle text-3xl text-slate-400 mb-3"></i>
                        <h4 class="font-bold dark:text-white mb-2">কোনো সক্রিয় কোর্স নেই</h4>
                        <p class="text-xs text-slate-500 mb-4">পরীক্ষা দিতে ও র‍্যাংক দেখতে একটি কোর্সে জয়েন করুন</p>
                        <button onclick="Router.student('courses')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
                            কোর্স খুঁজুন
                        </button>
                    </div>
                `;
            }
        }
    },
    

    checkGroupAndLoad: (type) => {
        if (!AppState.activeGroupId) {
            Swal.fire('কোর্স প্রয়োজন', 'আপনাকে অবশ্যই একটি কোর্সে যোগ দিতে হবে', 'warning').then(() => {
                Student.showGroupCodeModal();
            });
            return;
        }
        
        if (type === 'live') Student.loadLiveExams();
        else if (type === 'mock') Student.loadMockHub();
    },

    loadLiveExams: async () => {
        const myRouteId = window.currentRouteId;
        if (AppState.userDisabled) {
            Swal.fire('প্রবেশাধিকার নেই', 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়।', 'warning');
            return;
        }
        if (!AppState.activeGroupId) {
            Swal.fire('কোর্স প্রয়োজন', 'প্রথমে কোর্সে জয়েন করুন', 'warning').then(() => Student.showGroupCodeModal());
            return;
        }

        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('dashboard') + '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="text-xs text-slate-400 mt-2">লাইভ পরীক্ষা লোড হচ্ছে...</p></div>';

        const uid = auth.currentUser ? auth.currentUser.uid : null;
        const now = new Date();

        // অফলাইন ক্যাশ থেকে ডাটা আনার চেষ্টা
        let exams = [];
        let userAttempts = {};
        let useCached = false;
        if (!navigator.onLine) {
            const cached = localStorage.getItem('offlineExamCache_' + AppState.activeGroupId);
            if (cached) {
                try {
                    exams = Object.values(JSON.parse(cached));
                    useCached = true;
                } catch(e) {}
            }
            if (exams.length === 0) {
                c.innerHTML = renderHeader('dashboard') + `<div class="p-10 text-center" style="color:var(--text-muted);">
                    <i class="fas fa-wifi-slash text-4xl mb-3 opacity-30"></i>
                    <p>অফলাইনে কোনো ক্যাশকৃত পরীক্ষা নেই।</p>
                    <p class="text-xs mt-2">ইন্টারনেট সংযোগ দিন।</p>
                </div>`;
                return;
            }
        }

        try {
            if (!useCached) {
                const userAttemptsQuery = query(collection(db, "attempts"), 
                    where("userId", "==", uid),
                    where("isPractice", "==", false));
                const userAttemptsSnap = await getDocs(userAttemptsQuery);
                userAttemptsSnap.forEach(doc => {
                    const attempt = doc.data();
                    userAttempts[attempt.examId] = { id: doc.id, ...attempt };
                });

                const snap = await getDocs(query(collection(db, "exams"), where("groupId", "==", AppState.activeGroupId)));
                snap.forEach(doc => exams.push({ id: doc.id, ...doc.data() }));
                
                // ক্যাশ সংরক্ষণ
                const cacheObj = {};
                exams.forEach(e => cacheObj[e.id] = e);
                localStorage.setItem('offlineExamCache_' + AppState.activeGroupId, JSON.stringify(cacheObj));
                localStorage.setItem('offlineExamCacheTime_' + AppState.activeGroupId, Date.now().toString());
            } else {
                // ক্যাশ থেকে ইউজার অ্যাটেম্পট বের করা সম্ভব নয়, তাই ফাঁকা রাখি
            }
        } catch(e) {
            if (useCached) {
                // already using cached, ignore
            } else {
                const cached = localStorage.getItem('offlineExamCache_' + AppState.activeGroupId);
                if (cached) {
                    exams = Object.values(JSON.parse(cached));
                    useCached = true;
                } else {
                    throw e;
                }
            }
        }

        if (myRouteId !== window.currentRouteId) return;

        const ongoingExams = [];
        const upcomingExams = [];

        for (const e of exams) {
            if (e.type === 'live' && !e.isDraft && !e.cancelled && !e.resultPublished) {
                const startTime = new Date(e.startTime);
                const endTime = new Date(e.endTime);

                if (now >= startTime && now <= endTime) {
                    let totalAttempts = 0, runningCount = 0;
                    if (!useCached) {
                        const attemptsSnap = await getDocs(query(
                            collection(db, "attempts"),
                            where("examId", "==", e.id),
                            where("isPractice", "==", false)
                        ));
                        totalAttempts = attemptsSnap.size;
                        runningCount = attemptsSnap.docs.filter(d => !d.data().submittedAt).length;
                    }
                    ongoingExams.push({ ...e, startTime, endTime, status: 'ongoing', totalAttempts, runningCount });
                } else if (now < startTime) {
                    upcomingExams.push({...e, startTime, endTime, status: 'upcoming'});
                }
            }
        }

        upcomingExams.sort((a, b) => a.startTime - b.startTime);
        ongoingExams.sort((a, b) => a.endTime - b.endTime);

        const renderLiveExamCard = (exam, status = 'ongoing') => {
            const startTime = exam.startTime ? moment(exam.startTime).format('DD MMM, h:mm A') : '';
            const endTime = exam.endTime ? moment(exam.endTime).format('h:mm A') : '';
            const examDate = exam.startTime ? moment(exam.startTime).format('DD MMM YYYY') : '';
            const userAttempt = userAttempts[exam.id];
            const isSubmitted = userAttempt && userAttempt.submittedAt;
            const totalAttempts = exam.totalAttempts || 0;
            const runningCount = exam.runningCount || 0;
            
            let buttonHTML = '';
            let statusBadge = '';
            let liveIndicator = '';
            
            if (status === 'ongoing') {
                statusBadge = '<span class="live-status-badge status-live">চলমান</span>';
                liveIndicator = '<div class="live-indicator live-now"></div>';
                if (isSubmitted) {
                    buttonHTML = `
                        <div class="mt-3">
                            <button class="w-full bg-gray-400 text-white py-2 rounded-lg text-sm font-bold cursor-not-allowed" disabled>
                                <i class="fas fa-check-circle mr-2"></i> জমা দেওয়া হয়েছে
                            </button>
                        </div>`;
                } else {
                    buttonHTML = `
                        <div class="mt-3 flex gap-2">
                            <button onclick="Exam.start('${exam.id}')" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold">
                                <i class="fas fa-play-circle mr-2"></i> ${userAttempt ? 'আবার শুরু করুন' : 'যোগ দিন'}
                            </button>
                            <button onclick="Student.refreshLiveExamCard('${exam.id}')" class="px-3 bg-indigo-100 text-indigo-600 rounded-lg refresh-btn">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>`;
                }
            } else if (status === 'upcoming') {
                statusBadge = '<span class="live-status-badge status-upcoming">আসন্ন</span>';
                liveIndicator = '<div class="live-indicator upcoming"></div>';
                buttonHTML = `
                    <div class="mt-3">
                        <button class="w-full bg-blue-100 text-blue-600 py-2 rounded-lg text-sm font-bold cursor-not-allowed" disabled>
                            <i class="far fa-clock mr-2"></i> শুরু হবে ${startTime}
                        </button>
                    </div>`;
            }
            
            return `
            <div class="p-4 rounded-xl shadow-sm border mb-3 text-sm" style="background-color:var(--card-bg);border-color:var(--border-light);color:var(--text-primary);">
                <div class="flex justify-between items-start mb-1">
                    <div>
                        ${liveIndicator}
                        ${statusBadge}
                    </div>
                    ${userAttempt ? `<span class="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded">অংশগ্রহণ করেছেন</span>` : ''}
                </div>
                <h3 class="font-bold text-base leading-tight mb-1" style="color:var(--text-primary);">${exam.title}</h3>
                ${exam.subject ? `<div class="text-xs text-indigo-500 font-medium mb-1">${exam.subject} ${exam.chapter ? '• '+exam.chapter : ''}</div>` : ''}
                <div class="text-xs mb-2 flex gap-2 flex-wrap" style="color:var(--text-muted);">
                    <span><i class="fas fa-star text-amber-400"></i> ${exam.totalMarks} মার্ক</span>
                    <span><i class="far fa-clock"></i> ${exam.duration}মি</span>
                    <span><i class="far fa-calendar-alt"></i> ${examDate}</span>
                </div>
                ${status === 'ongoing' ? `
                <div class="live-exam-stats p-2 rounded-lg mb-2" style="background-color:var(--bg-tertiary);color:var(--text-secondary);">
                    <div><i class="fas fa-users"></i> মোট অংশগ্রহণ: ${totalAttempts}</div>
                    <div><i class="fas fa-user-check"></i> এখন পরীক্ষায়: ${runningCount}</div>
                </div>` : ''}
                ${buttonHTML}
            </div>`;
        };

        let ongoingHTML = '';
        if (ongoingExams.length > 0) {
            ongoingHTML = `
                <div class="mb-6">
                    <h3 class="text-base font-bold mb-2">চলমান পরীক্ষা</h3>
                    ${ongoingExams.map(exam => renderLiveExamCard(exam, 'ongoing')).join('')}
                </div>
            `;
        }

        let upcomingHTML = '';
        if (upcomingExams.length > 0) {
            upcomingHTML = `
                <div class="mb-6">
                    <h3 class="text-base font-bold mb-2">আসন্ন লাইভ পরীক্ষা</h3>
                    ${upcomingExams.map(exam => renderLiveExamCard(exam, 'upcoming')).join('')}
                </div>
            `;
        }

        const pastHTML = `
            <div class="grid grid-cols-1 gap-6 mb-8">
                <button onclick="Student.checkGroupAndLoadPast()" class="h-32 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-900 text-white p-5 relative overflow-hidden shadow-lg transition active:scale-95 text-left group">
                    <div class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm mb-3"><i class="fas fa-history text-xl"></i></div>
                    <h3 class="text-xl font-bold">পূর্বের লাইভ পরীক্ষা</h3>
                    <p class="text-slate-300 text-xs mt-1">প্রশ্ন ও সমাধান সহ সকল পূর্ববর্তী লাইভ পরীক্ষা দেখুন</p>
                    <i class="fas fa-chevron-right absolute right-6 top-1/2 -translate-y-1/2 text-4xl opacity-20 group-hover:scale-110 transition"></i>
                </button>
            </div>
        `;

        let content = '';
        if (ongoingExams.length === 0 && upcomingExams.length === 0) {
            content = `
                ${pastHTML}
                <div class="text-center p-10" style="color:var(--text-muted);">
                    <i class="fas fa-calendar-times text-4xl mb-3 opacity-30"></i>
                    <p>কোনো আসন্ন বা চলমান লাইভ পরীক্ষা নেই</p>
                    <p class="text-xs mt-2">পরে আবার চেক করুন</p>
                </div>
            `;
        } else {
            content = ongoingHTML + upcomingHTML + pastHTML;
        }

        c.innerHTML = renderHeader('dashboard') + `
        <div class="p-5 pb-20 min-h-screen" style="background-color:var(--bg-primary);">
            <button onclick="Student.loadDashboard()" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                <i class="fas fa-arrow-left"></i> ড্যাশবোর্ড
            </button>
            <h2 class="text-2xl font-bold font-bn mb-4 text-center" style="color:var(--text-primary);">লাইভ এক্সাম</h2>
            ${content}
        </div>`;
    },

    refreshLiveExamCard: async (examId) => {
        Student.loadLiveExams();
    },

    checkGroupAndLoadPast: () => {
        if (!AppState.activeGroupId) {
            Swal.fire('কোর্স প্রয়োজন', 'আপনাকে অবশ্যই একটি কোর্সে যোগ দিতে হবে', 'warning').then(() => Student.showGroupCodeModal());
            return;
        }
        Student.loadPastLiveExams();
    },

    loadPastLiveExams: async () => {
        if (AppState.userDisabled) return;
        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('dashboard') + '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="text-xs text-slate-400 mt-2">পূর্ববর্তী পরীক্ষা লোড হচ্ছে...</p></div>';

        try {
            const uid = auth.currentUser.uid;
            const now = new Date();

            const q = query(
                collection(db, "exams"),
                where("groupId", "==", AppState.activeGroupId),
                where("type", "==", "live")
            );
            const snap = await getDocs(q);
            const liveExams = [];
            snap.forEach(doc => {
                const e = { id: doc.id, ...doc.data() };
                if (e.resultPublished || (e.endTime && new Date(e.endTime) < now) || (e.startTime && new Date(e.startTime) < now)) {
                    liveExams.push(e);
                }
            });

            const userAttemptsSnap = await getDocs(query(
                collection(db, "attempts"),
                where("userId", "==", uid),
                where("isPractice", "==", false)
            ));
            const userAttempts = {};
            userAttemptsSnap.forEach(d => {
                userAttempts[d.data().examId] = { id: d.id, ...d.data() };
            });

            const attendedExams = [];
            const absentExams = [];
            liveExams.forEach(exam => {
                if (userAttempts[exam.id]) attendedExams.push({...exam, attempt: userAttempts[exam.id]});
                else absentExams.push(exam);
            });

            const subjects = new Set();
            liveExams.forEach(ex => {
                const sub = ex.subject && ex.subject.trim() !== '' ? ex.subject : 'Uncategorized';
                subjects.add(sub);
            });
            const subjectList = Array.from(subjects).sort();
            
            let filterButtons = `<button class="past-filter-btn ${pastSubjectFilter === 'all' ? 'active' : ''}" style="color:var(--text-secondary);background-color:var(--card-bg);border-color:var(--border-light);" onclick="Student.setPastSubjectFilter('all')">সব</button>`;
            subjectList.forEach(sub => {
                filterButtons += `<button class="past-filter-btn ${pastSubjectFilter === sub ? 'active' : ''}" onclick="Student.setPastSubjectFilter('${sub}')">${sub}</button>`;
            });

            const renderExamCard = (exam, isAttended = false) => {
                const examDate = exam.createdAt ? moment(exam.createdAt.toDate()).format('DD MMM, YYYY') : '';
                const subject = exam.subject && exam.subject.trim() !== '' ? exam.subject : 'Uncategorized';
                let actions = `
                    <div class="action-grid">
                        <button onclick="Exam.start('${exam.id}', true)" class="past-action-btn questions bg-blue-600 text-white text-[10px] py-2 px-1 rounded shadow">
                            পরীক্ষা দিন
                        </button>
                        <button onclick="Student.viewExamSolutions('${exam.id}', 'live')" class="past-action-btn solutions bg-emerald-500 text-white text-[10px] py-2 px-1 rounded shadow">
                            সমাধান
                        </button>
                    </div>`;
                return `
                <div class="p-3 rounded-xl shadow-sm border mb-2 text-sm" style="background-color:var(--card-bg);border-color:var(--border-light);color:var(--text-primary);">
                    <div class="flex justify-between items-start mb-1">
                        <span class="live-status-badge status-ended">শেষ</span>
                        ${isAttended 
                            ? `<span class="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded">অংশগ্রহণ করেছেন</span>` 
                            : `<span class="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded">অনুপস্থিত</span>`}
                    </div>
                    <h3 class="font-bold text-base leading-tight mb-1" style="color:var(--text-primary);">${exam.title}</h3>
                    <div class="text-xs text-indigo-500 font-medium mb-1">${subject} ${exam.chapter ? '• '+exam.chapter : ''}</div>
                    <div class="text-xs text-slate-500 mb-2 flex gap-2">
                        <span><i class="fas fa-star text-amber-400"></i> ${exam.totalMarks} মার্ক</span>
                        <span><i class="far fa-clock"></i> ${exam.duration}মি</span>
                        <span><i class="far fa-calendar-alt"></i> ${examDate}</span>
                    </div>
                    ${actions}
                </div>`;
            };

            let examsToShow = [...attendedExams, ...absentExams];
            if (pastSubjectFilter !== 'all') {
                examsToShow = examsToShow.filter(e => {
                    const sub = e.subject && e.subject.trim() !== '' ? e.subject : 'Uncategorized';
                    return sub === pastSubjectFilter;
                });
            }
            examsToShow.sort((a, b) => (b.endTime ? new Date(b.endTime) : new Date(b.createdAt)) - (a.endTime ? new Date(a.endTime) : new Date(a.createdAt)));

            let content = examsToShow.length === 0 
                ? `<div class="text-center py-20 text-slate-400">কোনো পূর্ববর্তী লাইভ পরীক্ষা পাওয়া যায়নি</div>` 
                : examsToShow.map(e => renderExamCard(e, e.attempt !== undefined)).join('');

            c.innerHTML = renderHeader('dashboard') + `
            <div class="p-5 pb-20 min-h-screen" style="background-color:var(--bg-primary);">
                <button onclick="Student.loadLiveExams()" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);"><i class="fas fa-arrow-left"></i> লাইভ পরীক্ষায় ফিরুন</button>
                <h2 class="text-2xl font-bold font-bn mb-4 text-center" style="color:var(--text-primary);">পূর্বের লাইভ পরীক্ষা</h2>
                <div class="past-exam-filters">${filterButtons}</div>
                ${content}
            </div>`;

            if (content.includes('$') || content.includes('\\(')) {
                loadMathJax(null, document.getElementById('app-container'));
            }
        } catch(e) {
            console.error(e);
        }
    },
    
    setPastSubjectFilter: (subject) => {
        pastSubjectFilter = subject;
        Student.loadPastLiveExams();
    },
    
    viewExamSolutions: async (examId, examType, subjectId, chapterId, teacherId) => {
        const myRouteId = window.currentRouteId;
        if (AppState.userDisabled) {
            Swal.fire('প্রবেশাধিকার নেই', 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়।', 'warning');
            return;
        }

        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('dashboard') + '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="text-xs text-slate-400 mt-2">সমাধান লোড হচ্ছে...</p></div>';
        
        // অফলাইন চেক
        if (!navigator.onLine) {
            c.innerHTML = renderHeader('dashboard') + `<div class="p-10 text-center" style="color:var(--text-muted);">
                <i class="fas fa-wifi-slash text-4xl mb-3 opacity-30"></i>
                <p>সমাধান দেখতে ইন্টারনেট সংযোগ প্রয়োজন।</p>
            </div>`;
            return;
        }
        
        if (examType === 'mock') {
            const uid = auth.currentUser ? auth.currentUser.uid : null;
            const attemptQuery = query(
                collection(db, "attempts"), 
                where("userId", "==", uid), 
                where("examId", "==", examId),
                where("isPractice", "==", true)
            );
            
            const attemptSnap = await getDocs(attemptQuery);
            
            if (attemptSnap.empty) {
                Swal.fire({
                    title: 'আগে পরীক্ষা দিন',
                    text: 'আপনাকে কমপক্ষে একবার পরীক্ষা দিতে হবে উত্তর দেখতে।',
                    icon: 'warning',
                    confirmButtonText: 'ঠিক আছে'
                }).then(() => {
                    if (subjectId && chapterId && teacherId) {
                        Student.loadMockExamsByStructure(subjectId, chapterId, teacherId);
                    } else {
                        Student.loadMockHub();
                    }
                });
                return;
            }
        }
        
        const examDoc = await getDoc(doc(db, "exams", examId));
        if (!examDoc.exists()) {
            Swal.fire('ত্রুটি', 'পরীক্ষা পাওয়া যায়নি!', 'error');
            return;
        }
        if (myRouteId !== window.currentRouteId) return;
        
        const exam = { id: examDoc.id, ...examDoc.data() };
        const qs = JSON.parse(exam.questions);
        
        let backButton = '';
        if (examType === 'mock' && subjectId && chapterId && teacherId) {
            backButton = `<button onclick="Student.loadMockExamsByStructure('${subjectId}', '${chapterId}', '${teacherId}')" class="mb-4 text-xs font-bold text-slate-500">
                <i class="fas fa-arrow-left"></i> মক পরীক্ষায় ফিরুন
            </button>`;
        } else {
            backButton = `<button onclick="Student.loadPastLiveExams()" class="mb-4 text-xs font-bold text-slate-500">
                <i class="fas fa-arrow-left"></i> পূর্ববর্তী পরীক্ষায় ফিরুন
            </button>`;
        }
        
        let solutionsHTML = '';
        qs.forEach((q, i) => {
            const questionText = MathHelper.renderExamContent(q.q);
            
            let optionsHTML = '';
            q.options.forEach((opt, oi) => {
                let optText = MathHelper.renderExamContent(opt);
                let isCorrect = oi === q.correct;
                let optionClass = 'opt-res';
                let icon = '';
                
                if (isCorrect) {
                    optionClass += ' right';
                    icon = '<i class="fas fa-check float-right mt-1 text-emerald-600"></i>';
                }
                
                optionsHTML += `
                <div class="${optionClass}">
                    <div class="option-math">
                        <span>${String.fromCharCode(65 + oi)}.</span>
                        <span>${optText}</span>
                        ${icon}
                    </div>
                </div>`;
            });
            
            let explanationText = q.expl || "কোনো ব্যাখ্যা প্রদান করা হয়নি।";
            
            solutionsHTML += `
            <div class="ans-card correct p-4 rounded-xl mb-4 shadow-sm border" style="background-color:var(--card-bg);border-color:var(--border-light);">
                <div class="flex justify-between mb-2 pb-2 border-b border-black/5">
                    <span class="font-bold text-sm text-slate-700">প্রশ্ন ${i+1}</span>
                    <span class="text-emerald-600 font-bold text-xs">সঠিক উত্তর: ${String.fromCharCode(65 + q.correct)}</span>
                </div>
                <p class="text-sm font-semibold mb-3 text-slate-800 math-render">${questionText}</p>
                <div class="space-y-1">
                    ${optionsHTML}
                </div>
                <div class="mt-3 text-xs p-3 rounded explanation-box" style="background-color:var(--expl-bg);border:1px solid var(--expl-border);color:var(--text-primary);">
                    <span class="font-bold block mb-1" style="color:var(--expl-text);">ব্যাখ্যা:</span>
                    <div class="math-render">${MathHelper.renderExamContent(explanationText)}</div>
                </div>
            </div>`;
        });
        
        c.innerHTML = renderHeader('dashboard') + `<div class="p-5 pb-24">
            ${backButton}
            <h2 class="font-bold text-xl mb-4 text-center">${exam.title} - সমাধান</h2>
            <p class="text-sm text-slate-500 mb-6 text-center">মোট প্রশ্ন: ${qs.length}</p>
            ${solutionsHTML}
        </div>`;
        
        loadMathJax(null, c);
    },

    loadMockHub: async () => {
        const myRouteId = window.currentRouteId;
        if (AppState.userDisabled || !AppState.activeGroupId) return;

        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('dashboard') + '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="text-xs mt-2">লোড হচ্ছে...</p></div>';
        
        // অফলাইন চেক
        if (!navigator.onLine) {
            const offlineCached = localStorage.getItem('mockFolderCache_' + AppState.activeGroupId);
            if (offlineCached) {
                try {
                    const structure = JSON.parse(offlineCached);
                    const mockSubjects = structure.mock || [];
                    if(mockSubjects.length === 0) {
                        c.innerHTML = renderHeader('dashboard') + `<div class="p-5 pb-20 text-center">
                            <button onclick="Student.loadDashboard()" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                                <i class="fas fa-arrow-left"></i> ড্যাশবোর্ড
                            </button>
                            <div class="text-center py-20 text-slate-400">কোনো বিষয় নেই</div>
                        </div>`;
                        return;
                    }
                    let h = mockSubjects.map(sub => `
                        <div onclick="Student.loadMockChaptersByStructure('${sub.id}', '${sub.teacherId}')" class="p-5 rounded-2xl shadow-sm border mb-3 flex justify-between items-center cursor-pointer transition" style="background-color:var(--card-bg);border-color:var(--border-light);">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">${sub.name[0]}</div>
                                <div class="font-bold text-lg bengali-text" style="color:var(--text-primary);">${sub.name}</div>
                            </div>
                            <i class="fas fa-chevron-right text-slate-300"></i>
                        </div>`).join('');
                    c.innerHTML = renderHeader('dashboard') + `<div class="p-5 pb-20 min-h-screen" style="background-color:var(--bg-primary);">
                        <button onclick="Student.loadDashboard()" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                            <i class="fas fa-arrow-left"></i> ড্যাশবোর্ড
                        </button>
                        <h2 class="text-2xl font-bold font-bn text-slate-800 mb-4 text-center">বিষয় নির্বাচন করুন</h2>
                        ${h}
                    </div>`;
                    return;
                } catch(e) {}
            }
            c.innerHTML = renderHeader('dashboard') + `<div class="p-10 text-center" style="color:var(--text-muted);">
                <i class="fas fa-wifi-slash text-4xl mb-3 opacity-30"></i>
                <p>অফলাইন মোডে মক পরীক্ষার তথ্য পাওয়া যায়নি।</p>
                <p class="text-xs mt-2">ইন্টারনেট সংযোগ করে একবার লোড করুন।</p>
            </div>`;
            return;
        }
        
        try {
            const groupDoc = await getDoc(doc(db, "groups", AppState.activeGroupId));
            if (!groupDoc.exists()) return;
            const teacherId = groupDoc.data().teacherId;

            const folderRef = doc(db, "folderStructures", `${teacherId}_${AppState.activeGroupId}`);
            
            const docSnap = await getDoc(folderRef);
            if (myRouteId !== window.currentRouteId) return;

            if (!docSnap.exists()) {
                c.innerHTML = renderHeader('dashboard') + `<div class="p-10 text-center text-slate-400">কোনো অনুশীলন ফোল্ডার পাওয়া যায়নি।</div>`;
                return;
            }

            const structure = docSnap.data();
            // ক্যাশে সংরক্ষণ
            localStorage.setItem('mockFolderCache_' + AppState.activeGroupId, JSON.stringify(structure));
            
            const mockSubjects = structure.mock || [];

            if(mockSubjects.length === 0) {
                c.innerHTML = renderHeader('dashboard') + `<div class="p-5 pb-20 text-center">
                    <button onclick="Student.loadDashboard()" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                        <i class="fas fa-arrow-left"></i> ড্যাশবোর্ড
                    </button>
                    <div class="text-center py-20 text-slate-400">কোনো বিষয় নেই</div>
                </div>`;
                return;
            }

            let h = mockSubjects.map(sub => `
                <div onclick="Student.loadMockChaptersByStructure('${sub.id}', '${teacherId}')" class="p-5 rounded-2xl shadow-sm border mb-3 flex justify-between items-center cursor-pointer transition" style="background-color:var(--card-bg);border-color:var(--border-light);">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">${sub.name[0]}</div>
                        <div class="font-bold text-lg bengali-text" style="color:var(--text-primary);">${sub.name}</div>
                    </div>
                    <i class="fas fa-chevron-right text-slate-300"></i>
                </div>`).join('');

            c.innerHTML = renderHeader('dashboard') + `<div class="p-5 pb-20 min-h-screen" style="background-color:var(--bg-primary);">
                <button onclick="Student.loadDashboard()" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                    <i class="fas fa-arrow-left"></i> ড্যাশবোর্ড
                </button>
                <h2 class="text-2xl font-bold font-bn text-slate-800 mb-4 text-center">বিষয় নির্বাচন করুন</h2>
                ${h}
            </div>`;
        } catch (e) {
            c.innerHTML = renderHeader('dashboard') + `<div class="p-10 text-center text-red-500">লোডিং এরর হয়েছে</div>`;
        }
    },

    loadMockChaptersByStructure: async (subId, teacherId) => {
        const myRouteId = window.currentRouteId;
        const c = document.getElementById('app-container');
        const folderRef = doc(db, "folderStructures", `${teacherId}_${AppState.activeGroupId}`);
        const docSnap = await getDoc(folderRef);
        const structure = docSnap.data();
        
        const subject = structure.mock.find(s => s.id === subId);
        if (!subject) { Student.loadMockHub(); return; }

        window.lastMockContext = { subject: subId, chapter: null, teacherId };
        
        let h = subject.children.map(chap => `
            <div onclick="Student.loadMockExamsByStructure('${subId}', '${chap.id}', '${teacherId}')" class="p-4 rounded-xl shadow-sm border mb-3 flex justify-between items-center cursor-pointer transition" style="background-color:var(--card-bg);border-color:var(--border-light);">
                <div class="font-bold bengali-text" style="color:var(--text-primary);">${chap.name}</div>
                <div class="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">${chap.exams.length} পরীক্ষা</div>
            </div>`).join('');

        c.innerHTML = renderHeader('dashboard') + `<div class="p-5 pb-20 min-h-screen" style="background-color:var(--bg-primary);">
            <button onclick="Student.loadMockHub()" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                <i class="fas fa-arrow-left"></i> বিষয় তালিকা
            </button>
            <h2 class="text-xl font-bold text-slate-800 mb-2 text-center bengali-text">${subject.name}</h2>
            <p class="text-xs text-slate-400 mb-4 text-center">অধ্যায় নির্বাচন করুন</p>
            ${h}
        </div>`;
    },

    loadMockExamsByStructure: async (subId, chapId, teacherId) => {
        const myRouteId = window.currentRouteId;
        const c = document.getElementById('app-container');
        const folderRef = doc(db, "folderStructures", `${teacherId}_${AppState.activeGroupId}`);
        const docSnap = await getDoc(folderRef);
        const structure = docSnap.data();
        
        const subject = structure.mock.find(s => s.id === subId);
        const chapter = subject?.children.find(c => c.id === chapId);
        
        if (!chapter) { Student.loadMockHub(); return; }

        window.lastMockContext = { subject: subId, chapter: chapId, teacherId };
        
        const uid = auth.currentUser ? auth.currentUser.uid : null;
        const examsWithAttemptStatus = [];
        
        for (const e of chapter.exams) {
            const attemptQuery = query(
                collection(db, "attempts"), 
                where("userId", "==", uid), 
                where("examId", "==", e.id),
                where("isPractice", "==", true)
            );
            
            const attemptSnap = await getDocs(attemptQuery);
            const hasAttempted = !attemptSnap.empty;
            
            examsWithAttemptStatus.push({ ...e, hasAttempted });
        }
        
        let h = examsWithAttemptStatus.map(e => {
            const seeAnswerBtnClass = e.hasAttempted ? 'mock-btn answer' : 'mock-btn answer disabled';
            const seeAnswerOnClick = e.hasAttempted ? 
                `Student.viewExamSolutions('${e.id}', 'mock', '${subId}', '${chapId}', '${teacherId}')` : 
                `Swal.fire('আগে পরীক্ষা দিন', 'আপনাকে কমপক্ষে একবার পরীক্ষা দিতে হবে উত্তর দেখতে।', 'warning')`;
            
            return `
            <div class="p-5 rounded-2xl shadow-sm border mb-4" style="background-color:var(--card-bg);border-color:var(--border-light);">
                <h3 class="font-bold text-lg mb-1 text-center bengali-text" style="color:var(--text-primary);">${e.name}</h3>
                <p class="text-xs text-slate-500 mb-4 flex gap-3 justify-center">
                    <span>মার্ক: ${e.examData?.totalMarks || 0}</span> 
                    <span>সময়: ${e.examData?.duration || 0}মি</span>
                    ${!e.hasAttempted ? '<span class="text-amber-500"><i class="fas fa-exclamation-circle"></i> দেওয়া হয়নি</span>' : ''}
                </p>
                <div class="mock-buttons">
                    <button onclick="Exam.start('${e.id}')" class="mock-btn practice">অনুশীলন শুরু</button>
                    <button onclick="${seeAnswerOnClick}" class="${seeAnswerBtnClass}">
                        ${e.hasAttempted ? 'উত্তর দেখুন' : 'আগে পরীক্ষা দিন'}
                    </button>
                </div>
            </div>`;
        }).join('');

        c.innerHTML = renderHeader('dashboard') + `<div class="p-5 pb-20 min-h-screen" style="background-color:var(--bg-primary);">
            <button onclick="Student.loadMockChaptersByStructure('${subId}', '${teacherId}')" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                <i class="fas fa-arrow-left"></i> অধ্যায় তালিকা
            </button>
            <h2 class="text-xl font-bold text-slate-800 mb-1 text-center bengali-text">${subject.name}</h2>
            <p class="text-sm text-slate-500 mb-4 text-center bengali-text">${chapter.name}</p>
            ${h}
        </div>`;
    },

    loadResults: async () => {
        const myRouteId = window.currentRouteId;
        if (AppState.userDisabled) {
            Swal.fire('প্রবেশাধিকার নেই', 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়।', 'warning');
            return;
        }
        if (!AppState.activeGroupId) {
            Swal.fire('কোর্স প্রয়োজন', 'প্রথমে কোর্সে জয়েন করুন', 'warning').then(() => Student.showGroupCodeModal());
            return;
        }

        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('results') + renderResultsSkeleton();

        // অফলাইন চেক
        if (!navigator.onLine) {
            c.innerHTML = renderHeader('results') + `<div class="p-10 text-center text-slate-400">
                <i class="fas fa-wifi-slash text-4xl mb-3 opacity-30"></i>
                <p>ফলাফল দেখতে ইন্টারনেট সংযোগ প্রয়োজন।</p>
            </div>`;
            return;
        }

        const uid = auth.currentUser.uid;
        
        const q = query(
            collection(db, "attempts"), 
            where("userId", "==", uid), 
            orderBy("submittedAt", "desc")
        );
        
        const snap = await getDocs(q);
        if (myRouteId !== window.currentRouteId) return;

        if(snap.empty) {
            c.innerHTML = renderHeader('results') + `<div class="p-10 text-center text-slate-400">আপনি এখনো কোনো পরীক্ষা দেননি।</div>`;
            return;
        }

        const attempts = [];
        snap.forEach(d => attempts.push({id: d.id, ...d.data()}));

        const subjectsSet = new Set();
        const resultsData = { live: [], mock: [] };

        for (const attempt of attempts) {
            try {
                const exam = ExamCache[attempt.examId];
                if (!exam) continue;
                
                if (exam.groupId !== AppState.activeGroupId) continue;
                
                const isCancelled = exam.cancelled;
                const isPub = !isCancelled && (exam.type === 'mock' || exam.resultPublished);
                
                if (isCancelled && !exam.resultPublished) continue;
                
                const subject = exam.subject || 'Uncategorized';
                subjectsSet.add(subject);
                
                const resultItem = { attempt, exam, subject };
                if (attempt.isPractice || exam.type === 'mock') {
                    resultsData.mock.push(resultItem);
                } else {
                    resultsData.live.push(resultItem);
                }
            } catch (error) {
                console.error(error);
            }
        }

        const subjectList = Array.from(subjectsSet).sort();
        let filterButtons = `<button class="past-filter-btn ${resultsSubjectFilter === 'all' ? 'active' : ''}" onclick="Student.setResultsSubjectFilter('all')">সব</button>`;
        subjectList.forEach(sub => {
            filterButtons += `<button class="past-filter-btn ${resultsSubjectFilter === sub ? 'active' : ''}" onclick="Student.setResultsSubjectFilter('${sub}')">${sub}</button>`;
        });

        const renderResultCard = (item) => {
            const { attempt, exam } = item;
            let scoreDisplay = parseFloat(attempt.score).toFixed(2);
            let actions = `<div class="flex gap-2 mt-3 pt-3 border-t" style="border-color:var(--border-light);">
                <button onclick="Student.viewResult('${attempt.id}')" class="w-full bg-emerald-50 text-emerald-700 py-2 rounded-lg text-xs font-bold border border-emerald-100">ফলাফল</button>
            </div>`;
            
            return `<div class="bg-white p-4 mb-3 rounded-2xl border border-slate-100 shadow-sm">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-bold text-sm" style="color:var(--text-primary);">${attempt.examTitle}</div>
                        <div class="text-xs text-slate-400 mt-1">${attempt.submittedAt ? moment(attempt.submittedAt.toDate()).format('DD MMM, h:mm A') : ''}</div>
                        <div class="text-[10px] mt-1">
                            <span class="px-2 py-1 rounded ${attempt.isPractice ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                                ${attempt.isPractice ? 'মক' : 'লাইভ'}
                            </span>
                            <span class="ml-1 text-slate-500">${exam.subject || ''}</span>
                        </div>
                    </div>
                    <div class="font-bold text-xl font-en" style="color:var(--text-primary);">${scoreDisplay}</div>
                </div>
                ${actions}
            </div>`;
        };

        let filteredLive = resultsData.live;
        let filteredMock = resultsData.mock;
        if (resultsSubjectFilter !== 'all') {
            filteredLive = filteredLive.filter(item => item.subject === resultsSubjectFilter);
            filteredMock = filteredMock.filter(item => item.subject === resultsSubjectFilter);
        }

        let liveHTML = filteredLive.map(renderResultCard).join('') || '<div class="text-center p-10" style="color:var(--text-muted);">কোনো লাইভ পরীক্ষার ফলাফল নেই</div>';
        let mockHTML = filteredMock.map(renderResultCard).join('') || '<div class="text-center p-10" style="color:var(--text-muted);">কোনো মক পরীক্ষার ফলাফল নেই</div>';

        const liveActive = resultTypeFilter === 'live' ? 'active' : '';
        const mockActive = resultTypeFilter === 'mock' ? 'active' : '';

        c.innerHTML = renderHeader('results') + `<div class="p-5 pb-20">
            <div class="result-tabs justify-center">
                <button class="result-tab ${liveActive}" onclick="Student.filterResultType('live')">লাইভ (${filteredLive.length})</button>
                <button class="result-tab ${mockActive}" onclick="Student.filterResultType('mock')">মক (${filteredMock.length})</button>
            </div>
            <div class="past-exam-filters justify-center my-3">${filterButtons}</div>
            <div id="results-container">
                ${resultTypeFilter === 'live' ? liveHTML : mockHTML}
            </div>
        </div>`;
    },

    setResultsSubjectFilter: (subject) => {
        resultsSubjectFilter = subject;
        Student.loadResults();
    },

    filterResultType: (type) => {
        resultTypeFilter = type;
        Student.loadResults();
    },

    viewResult: async (id) => {
        if (AppState.userDisabled) {
            Swal.fire('প্রবেশাধিকার নেই', 'অ্যাকাউন্ট নিষ্ক্রিয়', 'warning');
            return;
        }

        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('results') + '<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-2 text-xs">ফলাফল বিশ্লেষণ করা হচ্ছে...</p></div>';
        
        try {
            const attSnap = await getDoc(doc(db, "attempts", id));
            if(!attSnap.exists()) throw new Error("ফলাফল পাওয়া যায়নি");
            const att = attSnap.data();
            
            const exSnap = await getDoc(doc(db, "exams", att.examId));
            if(!exSnap.exists()) throw new Error("পরীক্ষার তথ্য পাওয়া যায়নি");
            const exam = { id: exSnap.id, ...exSnap.data() };

            const qs = JSON.parse(exam.questions);
            window.currentExamForPDF = exam;
            window.currentAttemptForPDF = att;
            window.currentQuestionsForPDF = qs;

            const totalQuestions = qs.length;
            const correctAnswers = qs.reduce((acc, q, i) => acc + (att.answers[i] === q.correct ? 1 : 0), 0);
            const accuracy = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100) : 0;
            
            const wrongAnswers = att.answers.reduce((acc, answer, i) => acc + (answer !== null && answer !== qs[i].correct ? 1 : 0), 0);
            const skippedAnswers = att.answers.filter(a => a === null).length;
            const markedAnswers = att.markedAnswers || [];
            
            let timeTakenSeconds = 0, timeTakenFormatted = 'N/A';
            if (att.submittedAt && att.startedAt) {
                const diffMs = att.submittedAt.toDate() - att.startedAt.toDate();
                timeTakenSeconds = Math.floor(diffMs / 1000);
                const hours = Math.floor(timeTakenSeconds / 3600);
                const minutes = Math.floor((timeTakenSeconds % 3600) / 60);
                const seconds = timeTakenSeconds % 60;
                if (hours > 0) {
                    timeTakenFormatted = `${hours}h ${minutes}m ${seconds}s`;
                } else if (minutes > 0) {
                    timeTakenFormatted = `${minutes}m ${seconds}s`;
                } else {
                    timeTakenFormatted = `${seconds}s`;
                }
            }

            currentResultPage = 1;
            resultFilter = 'all';
            filteredQuestions.length = 0;
            filteredQuestions.push(...qs);

            const renderQuestionsInternal = (questionsToShow) => {
                let h = '';
                questionsToShow.forEach((q) => {
                    const originalIndex = qs.indexOf(q);
                    const u = att.answers[originalIndex];
                    const corr = q.correct;
                    let st = (u === corr) ? 'correct' : (u === null ? 'skipped' : 'wrong');
                    let badge = st === 'correct' ? 'সঠিক' : (st === 'skipped' ? 'স্কিপ' : 'ভুল');
                    
                    const questionText = MathHelper.renderExamContent(q.q);
                    
                    h += `<div class="ans-card ${st} p-4 rounded-xl mb-4 shadow-sm border pdf-question-container" style="background-color:var(--card-bg);border-color:var(--border-light);">
                        <div class="flex justify-between mb-2">
                            <span class="font-bold text-sm">প্রশ্ন ${originalIndex+1}</span>
                            <span class="text-[10px] font-bold uppercase">${badge}</span>
                        </div>
                        <p class="text-sm font-semibold mb-3 math-render">${questionText}</p>
                        <div class="space-y-1">
                            ${q.options.map((o,oi)=>{ 
                                let cls="opt-res bg-white";
                                if(oi===corr) cls+=" right";
                                else if(oi===u) cls+=" wrong-select";
                                
                                const optionText = MathHelper.renderExamContent(o);
                                return `<div class="${cls}">
                                    <div class="option-math">
                                        <span>${String.fromCharCode(65+oi)}.</span>
                                        <span>${optionText}</span>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                        ${q.expl ? `<div class="mt-3 text-xs p-3 rounded explanation-box" style="background-color:var(--expl-bg);border:1px solid var(--expl-border);color:var(--text-primary);"><b style="color:var(--expl-text);">ব্যাখ্যা:</b> <div class="math-render mt-1">${MathHelper.renderExamContent(q.expl)}</div></div>` : ''}
                    </div>`;
                });
                return h;
            };

            const updateView = () => {
                const questionsPerPage = 25;
                const startIndex = (currentResultPage - 1) * questionsPerPage;
                const currentQs = filteredQuestions.slice(startIndex, startIndex + questionsPerPage);
                const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage);

                const summaryHeader = `
                <div class="compact-summary-card">
                    <div class="compact-header">
                        <div>
                            <div class="compact-title">${exam.title}</div>
                            <div class="compact-date">${moment(att.submittedAt.toDate()).format('lll')}</div>
                        </div>
                        <div class="text-right">
                            <div class="compact-score">${parseFloat(att.score).toFixed(2)}</div>
                            <div class="compact-accuracy">${accuracy.toFixed(1)}% নির্ভুলতা</div>
                        </div>
                    </div>
                    <div class="compact-grid">
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${totalQuestions}</div>
                            <div class="compact-stat-label">মোট</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${correctAnswers}</div>
                            <div class="compact-stat-label">সঠিক</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${wrongAnswers}</div>
                            <div class="compact-stat-label">ভুল</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${skippedAnswers}</div>
                            <div class="compact-stat-label">স্কিপ</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${timeTakenFormatted}</div>
                            <div class="compact-stat-label">সময়</div>
                        </div>
                        <div class="compact-stat-item">
                            <div class="compact-stat-value">${(wrongAnswers * (exam.negativeMark || 0)).toFixed(2)}</div>
                            <div class="compact-stat-label">নেগেটিভ</div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center mt-3 text-xs">
                        <div>মোট সময়: ${exam.duration} মিনিট</div>
                        <div>${StarRating(accuracy)}</div>
                    </div>
                </div>
                <div class="flex gap-2 my-4 overflow-x-auto pb-2 justify-center">
                    <button onclick="Student.setResultFilter('all')" class="filter-btn ${resultFilter==='all'?'active bg-indigo-600 text-white':''}">সব</button>
                    <button onclick="Student.setResultFilter('correct')" class="filter-btn correct ${resultFilter==='correct'?'active':''}">সঠিক</button>
                    <button onclick="Student.setResultFilter('wrong')" class="filter-btn wrong ${resultFilter==='wrong'?'active':''}">ভুল</button>
                    <button onclick="Student.setResultFilter('skipped')" class="filter-btn skipped ${resultFilter==='skipped'?'active':''}">স্কিপ</button>
                    <button onclick="Student.setResultFilter('marked')" class="filter-btn ${resultFilter==='marked'?'active bg-amber-500 text-white':''}">চিহ্নিত</button>
                </div>`;

                const pagination = totalPages > 1 ? `
                <div class="flex justify-center items-center gap-4 mt-4">
                    <button onclick="Student.prevResultPage()" ${currentResultPage===1?'disabled':''} class="px-3 py-1 bg-slate-200 rounded disabled:opacity-50">পূর্ববর্তী</button>
                    <span class="text-xs">পৃষ্ঠা ${currentResultPage}/${totalPages}</span>
                    <button onclick="Student.nextResultPage()" ${currentResultPage===totalPages?'disabled':''} class="px-3 py-1 bg-slate-200 rounded disabled:opacity-50">পরবর্তী</button>
                </div>` : '';

                c.innerHTML = renderHeader('results') + `
                <div class="p-5 pb-24">
                    <button onclick="Router.student('results')" class="mb-4 text-xs font-bold" style="color:var(--text-muted);"><i class="fas fa-arrow-left"></i> ফলাফল তালিকা</button>
                    ${summaryHeader}
                    ${renderQuestionsInternal(currentQs)}
                    ${pagination}
                </div>`;
                loadMathJax(null, c);
            };

            Student.setResultFilter = (f) => {
                resultFilter = f; 
                currentResultPage = 1;
                if(f === 'all') {
                    filteredQuestions.length = 0;
                    filteredQuestions.push(...qs);
                } else if (f === 'marked') {
                    filteredQuestions.length = 0;
                    filteredQuestions.push(...qs.filter((_, i) => markedAnswers[i] === true));
                } else {
                    filteredQuestions.length = 0;
                    filteredQuestions.push(...qs.filter((q,i) => {
                        const u = att.answers[i];
                        const st = (u === q.correct) ? 'correct' : (u === null ? 'skipped' : 'wrong');
                        return st === f;
                    }));
                }
                updateView();
            };
            
            Student.prevResultPage = () => { 
                if(currentResultPage > 1) { 
                    currentResultPage--; 
                    updateView(); 
                }
            };
            
            Student.nextResultPage = () => { 
                if(currentResultPage < Math.ceil(filteredQuestions.length/25)) { 
                    currentResultPage++; 
                    updateView(); 
                }
            };

            updateView();

        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'ফলাফল লোড ব্যর্থ', 'error');
            import('./router.js').then(({ Router }) => {
                Router.student('results');
            });
        }
    },
    
    loadAnalysis: async () => {
        if (!AppState.activeGroupId) {
            Swal.fire('কোর্স প্রয়োজন', 'প্রথমে কোর্সে জয়েন করুন', 'warning').then(() => Student.showGroupCodeModal());
            return;
        }
        const c = document.getElementById('app-container');
        const uid = auth.currentUser.uid;

        try {
            const liveExamsSnap = await getDocs(query(
                collection(db, "exams"),
                where("groupId", "==", AppState.activeGroupId),
                where("type", "==", "live")
            ));
            const allLiveExams = [];
            liveExamsSnap.forEach(doc => allLiveExams.push({ id: doc.id, ...doc.data() }));

            const attemptsSnap = await getDocs(query(
                collection(db, "attempts"),
                where("userId", "==", uid)
            ));
            const userAttempts = {};
            const mockAttemptsMap = {};
            attemptsSnap.forEach(doc => {
                const a = doc.data();
                if (a.isPractice) {
                    if (!mockAttemptsMap[a.examId]) mockAttemptsMap[a.examId] = [];
                    mockAttemptsMap[a.examId].push(a);
                } else {
                    userAttempts[a.examId] = a;
                }
            });

            const totalLiveExams = allLiveExams.length;
            const attendedLive = allLiveExams.filter(ex => userAttempts[ex.id]).length;

            let totalMarksAvailable = 0;
            let totalMarksObtained = 0;
            const subjectScores = {};
            const examPerformance = [];

            allLiveExams.forEach(ex => {
                if (ex.totalMarks) totalMarksAvailable += ex.totalMarks;
                const attempt = userAttempts[ex.id];
                const subj = ex.subject || 'Uncategorized';
                if (!subjectScores[subj]) subjectScores[subj] = { obtained: 0, total: 0, count: 0 };
                subjectScores[subj].total += ex.totalMarks || 0;
                if (attempt) {
                    totalMarksObtained += attempt.score || 0;
                    subjectScores[subj].obtained += attempt.score || 0;
                    subjectScores[subj].count++;
                    examPerformance.push({
                        title: ex.title,
                        date: ex.createdAt?.toDate(),
                        score: attempt.score,
                        total: ex.totalMarks,
                        percentage: (attempt.score / ex.totalMarks) * 100
                    });
                }
            });

            const overallPercent = totalMarksAvailable ? (totalMarksObtained / totalMarksAvailable) * 100 : 0;

            const folderSnap = await getDoc(doc(db, "folderStructures", `${AppState.activeTeacherCode}_${AppState.activeGroupId}`));
            let totalMockExams = 0;
            let attemptedMockExams = 0;
            let mockScores = [];
            const subjectMockStats = {};
            if (folderSnap.exists()) {
                const mockSubjects = folderSnap.data().mock || [];
                mockSubjects.forEach(sub => {
                    let subTotal = 0;
                    let subCompleted = 0;
                    sub.children.forEach(chap => {
                        chap.exams.forEach(ex => {
                            subTotal++;
                            totalMockExams++;
                            if (mockAttemptsMap[ex.id]) {
                                subCompleted++;
                                attemptedMockExams++;
                                const bestAttempt = mockAttemptsMap[ex.id].reduce((best, curr) => curr.score > best.score ? curr : best, {score:0});
                                mockScores.push({ name: ex.name, score: bestAttempt.score, total: ex.examData?.totalMarks || 0 });
                            }
                        });
                    });
                    subjectMockStats[sub.name] = { total: subTotal, completed: subCompleted };
                });
            }
            const mockCompletionPercent = totalMockExams ? (attemptedMockExams / totalMockExams) * 100 : 0;

            let subjectBars = '';
            for (const [subj, data] of Object.entries(subjectScores)) {
                const percent = data.total ? (data.obtained / data.total) * 100 : 0;
                subjectBars += `
                <div class="subject-row">
                    <span class="subject-name">${subj}</span>
                    <div class="subject-bar"><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%"></div></div></div>
                    <span class="subject-percent">${percent.toFixed(1)}%</span>
                </div>`;
            }

            let recentPerfHTML = '';
            examPerformance.sort((a,b) => b.date - a.date).slice(0,5).forEach(perf => {
                recentPerfHTML += `
                <tr class="border-b">
                    <td class="py-2 text-sm">${perf.title}</td>
                    <td class="py-2 text-sm">${perf.score.toFixed(2)}/${perf.total}</td>
                    <td class="py-2 text-sm">${perf.percentage.toFixed(1)}%</td>
                </table>`;
            });

            const attendancePercent = totalLiveExams ? (attendedLive / totalLiveExams) * 100 : 0;

            let mockSubjectListHTML = '';
            for (const [subName, stats] of Object.entries(subjectMockStats)) {
                const subPercent = stats.total ? (stats.completed / stats.total) * 100 : 0;
                mockSubjectListHTML += `
                <div class="subject-row">
                    <span class="subject-name">${subName}</span>
                    <div class="subject-bar">
                        <div class="progress-bar-bg"><div class="progress-bar-fill bg-amber-500" style="width: ${subPercent}%"></div></div>
                    </div>
                    <span class="subject-percent">${stats.completed}/${stats.total}</span>
                </div>`;
            }

            c.innerHTML = renderHeader('analysis') + `
            <div class="p-5 pb-20" style="background-color:var(--bg-primary);">
                <div class="analysis-stat-card">
                    <h3 class="font-bold text-lg mb-3">উপস্থিতি ও সার্বিক পারফরম্যান্স</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <canvas id="attendanceChart" style="max-height:160px; width:100%"></canvas>
                            <p class="text-center text-sm font-bold mt-1">উপস্থিতি: ${attendancePercent.toFixed(1)}%</p>
                            <p class="text-center text-xs text-slate-500">${attendedLive}/${totalLiveExams} পরীক্ষা</p>
                        </div>
                        <div>
                            <div class="text-3xl font-bold text-emerald-600">${totalMarksObtained.toFixed(2)}</div>
                            <div class="text-xs text-slate-500">মোট প্রাপ্ত নম্বর</div>
                            <div class="text-sm mt-2">সম্ভাব্য: ${totalMarksAvailable}</div>
                            <div class="progress-bar-bg mt-2"><div class="progress-bar-fill" style="width: ${overallPercent}%"></div></div>
                            <div class="text-right text-xs">${overallPercent.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
                
                <div class="analysis-stat-card">
                    <h3 class="font-bold text-lg mb-3">বিষয়ভিত্তিক পারফরম্যান্স</h3>
                    ${subjectBars || '<p class="text-slate-400">কোনো তথ্য নেই</p>'}
                </div>
                
                <div class="analysis-stat-card">
                    <h3 class="font-bold text-lg mb-3">সাম্প্রতিক লাইভ পরীক্ষার ফলাফল</h3>
                    ${recentPerfHTML ? `<table class="w-full text-sm">${recentPerfHTML}</table>` : '<p class="text-slate-400">কোনো লাইভ পরীক্ষায় অংশগ্রহণ করেননি</p>'}
                </div>
                
                <div class="analysis-stat-card">
                    <h3 class="font-bold text-lg mb-3">মক টেস্ট অগ্রগতি</h3>
                    <div class="mb-4">
                        <div class="flex justify-between text-sm">
                            <span>সামগ্রিক সম্পন্ন</span>
                            <span>${attemptedMockExams}/${totalMockExams} (${mockCompletionPercent.toFixed(1)}%)</span>
                        </div>
                        <div class="progress-bar-bg mt-1"><div class="progress-bar-fill bg-amber-500" style="width: ${mockCompletionPercent}%"></div></div>
                    </div>
                    ${mockSubjectListHTML ? `
                    <div class="mt-4">
                        <h4 class="font-semibold text-sm mb-2">বিষয় অনুযায়ী</h4>
                        ${mockSubjectListHTML}
                    </div>` : '<p class="text-slate-400">কোনো মক পরীক্ষা নেই</p>'}
                </div>
            </div>`;

            setTimeout(() => {
                new Chart(document.getElementById('attendanceChart'), {
                    type: 'doughnut',
                    data: {
                        labels: ['উপস্থিত', 'অনুপস্থিত'],
                        datasets: [{
                            data: [attendedLive, totalLiveExams - attendedLive],
                            backgroundColor: ['#4f46e5', '#e2e8f0'],
                            borderWidth: 0
                        }]
                    },
                    options: { 
                        cutout: '70%', 
                        responsive: true, 
                        maintainAspectRatio: true,
                        plugins: { 
                            legend: { display: false },
                            tooltip: { enabled: true }
                        }
                    }
                });
            }, 100);
        } catch(e) {
            console.error(e);
        }
    },
    
    profile: async () => {
        let cachedProfile = localStorage.getItem('userProfile');
        if (cachedProfile) {
            AppState.userProfile = JSON.parse(cachedProfile);
        } else {
            const u = auth.currentUser;
            const s = await getDoc(doc(db, "students", u.uid));
            if (s.exists()) {
                AppState.userProfile = s.data();
                localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            }
        }

        const u = auth.currentUser || {email:'demo@test.com'};
        const profile = AppState.userProfile || {};
        
        const name = profile.name || 'Not Set';
        const phone = profile.phone || 'Not Set';
        const school = profile.schoolName;
        const college = profile.collegeName;
        const fatherPhone = profile.fatherPhone || 'Not Set';
        const motherPhone = profile.motherPhone || 'Not Set';
        const classLevel = profile.classLevel || '';
        const admissionStream = profile.admissionStream || '';
        
        const schoolHTML = school ? `<div class="flex justify-between">
            <span class="text-slate-600">বিদ্যালয়:</span>
            <span class="font-medium">${school}</span>
        </div>` : '';
        const collegeHTML = college ? `<div class="flex justify-between">
            <span class="text-slate-600">কলেজ:</span>
            <span class="font-medium">${college}</span>
        </div>` : '';
        const classHTML = classLevel ? `<div class="flex justify-between">
            <span class="text-slate-600">ক্লাস:</span>
            <span class="font-medium">${classLevel === 'Admission' ? 'এডমিশন' : (classLevel === 'SSC' ? 'এসএসসি' : (classLevel === 'HSC' ? 'এইচএসসি' : classLevel+'ম শ্রেণী'))} ${admissionStream ? '('+admissionStream+')' : ''}</span>
        </div>` : '';

        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('profile') + `
        <div class="p-5 max-w-md mx-auto">
            <div class="p-6 rounded-2xl shadow-sm border" style="background-color:var(--card-bg);border-color:var(--border-light);color:var(--text-primary);">
                <button onclick="Router.student('dashboard')" class="mb-4 text-xs font-bold flex items-center gap-1" style="color:var(--text-muted);">
                    <i class="fas fa-arrow-left"></i> ড্যাশবোর্ডে ফিরে যান
                </button>
                
                <div class="w-20 h-20 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full mx-auto text-white flex items-center justify-center text-3xl font-bold mb-4 shadow-lg border-4 border-white">
                    ${name.charAt(0)}
                </div>
                
                <h2 class="text-xl font-bold text-center text-slate-800 mb-1">${name}</h2>
                <p class="text-sm text-slate-500 text-center mb-6">${u.email}</p>
                
                <div class="mb-6">
                    <h3 class="font-bold text-lg mb-3">প্রোফাইল তথ্য</h3>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-slate-600">ফোন:</span>
                            <span class="font-medium">${phone}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-600">পিতার ফোন:</span>
                            <span class="font-medium">${fatherPhone}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-600">মাতার ফোন:</span>
                            <span class="font-medium">${motherPhone}</span>
                        </div>
                        ${schoolHTML}
                        ${collegeHTML}
                        ${classHTML}
                    </div>
                </div>
                
                <button onclick="Student.showEditProfile()" class="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-600 transition">
                    <i class="fas fa-edit mr-2"></i> প্রোফাইল সম্পাদনা
                </button>
            </div>
        </div>`;
    },

    showEditProfile: () => {
        const profile = AppState.userProfile || {};
        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('profile') + `
        <div class="p-5 max-w-md mx-auto">
            <div class="p-6 rounded-2xl shadow-sm border" style="background-color:var(--card-bg);border-color:var(--border-light);color:var(--text-primary);">
                <button onclick="Student.profile()" class="mb-6 text-sm font-bold text-slate-500 flex items-center gap-2 hover:text-indigo-600 transition">
                    <i class="fas fa-arrow-left"></i> প্রোফাইলে ফিরে যান
                </button>
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-xl">
                        <i class="fas fa-user-edit"></i>
                    </div>
                    <h2 class="text-xl font-bold text-slate-800">প্রোফাইল আপডেট</h2>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">পূর্ণ নাম</label>
                        <input id="edit-name" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition" value="${profile.name || ''}" placeholder="আপনার পুরো নাম লিখুন">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">ফোন নম্বর</label>
                        <input id="edit-phone" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition" value="${profile.phone || ''}" placeholder="ফোন নম্বর লিখুন">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">বিদ্যালয়ের নাম</label>
                        <input id="edit-school" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition" value="${profile.schoolName || ''}" placeholder="বিদ্যালয়ের নাম লিখুন">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">কলেজের নাম</label>
                        <input id="edit-college" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition" value="${profile.collegeName || ''}" placeholder="কলেজের নাম লিখুন">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">ক্লাস/লেভেল</label>
                        <select id="edit-class-level" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition">
                            <option value="6" ${profile.classLevel === '6' ? 'selected' : ''}>৬ষ্ঠ শ্রেণী</option>
                            <option value="7" ${profile.classLevel === '7' ? 'selected' : ''}>৭ম শ্রেণী</option>
                            <option value="8" ${profile.classLevel === '8' ? 'selected' : ''}>৮ম শ্রেণী</option>
                            <option value="SSC" ${profile.classLevel === 'SSC' ? 'selected' : ''}>এসএসসি</option>
                            <option value="HSC" ${profile.classLevel === 'HSC' ? 'selected' : ''}>এইচএসসি</option>
                            <option value="Admission" ${profile.classLevel === 'Admission' ? 'selected' : ''}>এডমিশন</option>
                        </select>
                    </div>
                    <div id="edit-admission-stream-group" style="${profile.classLevel === 'Admission' ? '' : 'display:none;'}">
                        <label class="block text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">শাখা</label>
                        <select id="edit-admission-stream" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition">
                            <option value="">নির্বাচন করুন</option>
                            <option value="Science" ${profile.admissionStream === 'Science' ? 'selected' : ''}>সায়েন্স</option>
                            <option value="Humanities" ${profile.admissionStream === 'Humanities' ? 'selected' : ''}>মানবিক</option>
                            <option value="Commerce" ${profile.admissionStream === 'Commerce' ? 'selected' : ''}>কমার্স</option>
                        </select>
                    </div>
                    <button onclick="Student.saveEditedProfile()" class="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-4 rounded-xl font-bold mt-2 shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 transition">
                        পরিবর্তন সংরক্ষণ
                    </button>
                </div>
            </div>
        </div>`;
        
        const classSelect = document.getElementById('edit-class-level');
        const streamGroup = document.getElementById('edit-admission-stream-group');
        classSelect.addEventListener('change', function() {
            if (this.value === 'Admission') {
                streamGroup.style.display = 'block';
            } else {
                streamGroup.style.display = 'none';
            }
        });
    },

    saveEditedProfile: async () => {
        const newName = document.getElementById('edit-name').value.trim();
        const newPhone = document.getElementById('edit-phone').value.trim();
        const newSchool = document.getElementById('edit-school').value.trim();
        const newCollege = document.getElementById('edit-college').value.trim();
        const newClassLevel = document.getElementById('edit-class-level').value;
        const newAdmissionStream = document.getElementById('edit-admission-stream')?.value || null;

        if (!newName || !newClassLevel) {
            Swal.fire('ত্রুটি', 'নাম ও ক্লাস আবশ্যক', 'error');
            return;
        }

        if (newClassLevel === 'Admission' && !newAdmissionStream) {
            Swal.fire('ত্রুটি', 'অনুগ্রহ করে শাখা নির্বাচন করুন', 'error');
            return;
        }

        const profileData = {
            name: newName,
            phone: newPhone,
            schoolName: newSchool,
            collegeName: newCollege,
            classLevel: newClassLevel,
            admissionStream: newAdmissionStream,
            updatedAt: new Date()
        };

        if (!navigator.onLine) {
            await DB.addToSyncQueue({
                collection: 'students',
                operation: 'update',
                docId: auth.currentUser.uid,
                payload: profileData
            });
            AppState.userProfile.name = newName;
            AppState.userProfile.phone = newPhone;
            AppState.userProfile.schoolName = newSchool;
            AppState.userProfile.collegeName = newCollege;
            AppState.userProfile.classLevel = newClassLevel;
            AppState.userProfile.admissionStream = newAdmissionStream;
            AppState.classLevel = newClassLevel;
            AppState.admissionStream = newAdmissionStream;
            localStorage.setItem('studentClassLevel', newClassLevel);
            if (newAdmissionStream) localStorage.setItem('studentAdmissionStream', newAdmissionStream);
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            Swal.fire('অফলাইন', 'প্রোফাইল সংরক্ষিত হয়েছে, অনলাইনে এলে সিঙ্ক হবে।', 'info').then(() => {
                Student.profile();
            });
            return;
        }

        try {
            Swal.fire({title: 'সংরক্ষণ হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            const user = auth.currentUser;
            await updateDoc(doc(db, "students", user.uid), profileData);
            AppState.userProfile.name = newName;
            AppState.userProfile.phone = newPhone;
            AppState.userProfile.schoolName = newSchool;
            AppState.userProfile.collegeName = newCollege;
            AppState.userProfile.classLevel = newClassLevel;
            AppState.userProfile.admissionStream = newAdmissionStream;
            AppState.classLevel = newClassLevel;
            AppState.admissionStream = newAdmissionStream;
            localStorage.setItem('studentClassLevel', newClassLevel);
            if (newAdmissionStream) localStorage.setItem('studentAdmissionStream', newAdmissionStream);
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            Swal.fire('সফল', 'প্রোফাইল আপডেট হয়েছে', 'success').then(() => {
                Student.profile();
            });
        } catch (e) {
            console.error(e);
            Swal.fire('ত্রুটি', 'প্রোফাইল আপডেট ব্যর্থ', 'error');
        }
    },

    loadManagement: async () => {
        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('management') + renderManagementSkeleton();

        const teacherCodes = AppState.teacherCodes || [];
        await Student.loadTeacherNames();

        let teacherCodesHTML = '';
        if (teacherCodes.length > 0) {
            const activeTeacher = teacherCodes.find(tc => tc.active);
            const teacherName = activeTeacher ? Student.getTeacherName(activeTeacher.code) : 'শিক্ষক নির্বাচন করুন';
            
            teacherCodesHTML = `
            <div class="relative teacher-switcher mb-6">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-bold text-lg">শিক্ষক অ্যাকাউন্ট</h3>
                    <button onclick="Student.addTeacherCode()" class="text-sm bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg font-bold">
                        <i class="fas fa-plus mr-1"></i> যোগ করুন
                    </button>
                </div>
                <div class="relative">
                    <button onclick="document.getElementById('teacher-drop').classList.toggle('hidden')" class="flex items-center justify-between w-full px-4 py-3 rounded-xl text-indigo-600 font-bold text-sm transition border border-indigo-100" style="background-color:var(--expl-bg);">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-chalkboard-teacher"></i>
                            <span>${teacherName}</span>
                            ${activeTeacher ? '<span class="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">সক্রিয়</span>' : ''}
                        </div>
                        <i class="fas fa-chevron-down text-xs"></i>
                    </button>
                    <div id="teacher-drop" class="hidden absolute top-12 left-0 w-full bg-white border rounded-xl shadow-xl z-50 overflow-hidden mt-1">
                        ${teacherCodes.map(tc => {
                            const teacherName = Student.getTeacherName(tc.code);
                            return `
                            <div class="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b ${tc.active ? 'bg-indigo-50' : ''} flex justify-between items-center">
                                <div class="flex-1" onclick="Student.switchTeacherCode('${tc.code}')">
                                    <div>${teacherName}</div>
                                </div>
                                ${teacherCodes.length > 1 ? `
                                    <button onclick="Student.confirmDeleteTeacher('${tc.code}')" class="delete-teacher-btn ml-2" title="শিক্ষক অ্যাকাউন্ট মুছুন">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                                ${tc.active ? '<i class="fas fa-check text-green-500"></i>' : ''}
                            </div>`;
                        }).join('')}
                        <div onclick="Student.addTeacherCode()" class="p-3 text-indigo-600 font-bold text-center text-xs cursor-pointer hover:bg-indigo-50 border-t">
                            <i class="fas fa-plus-circle mr-1"></i> নতুন শিক্ষক যোগ করুন
                        </div>
                    </div>
                </div>
                <p class="text-xs text-slate-500 mt-2">
                    <i class="fas fa-info-circle mr-1"></i>
                    শিক্ষক অ্যাকাউন্ট নির্বাচন করুন। একসাথে কেবল একটি সক্রিয় থাকতে পারে।
                </p>
            </div>`;
        } else {
            teacherCodesHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-bold text-lg">শিক্ষক অ্যাকাউন্ট</h3>
                    <button onclick="Student.addTeacherCode()" class="text-sm bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg font-bold">
                        <i class="fas fa-plus mr-1"></i> যোগ করুন
                    </button>
                </div>
                <div class="alert-message alert-warning">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    কোনো শিক্ষক অ্যাকাউন্ট যোগ করা হয়নি। পরীক্ষা দেখতে অন্তত একটি শিক্ষক অ্যাকাউন্ট প্রয়োজন।
                </div>
            </div>`;
        }

        let joinedGroupsHTML = '';
        if (AppState.joinedGroups && AppState.joinedGroups.length > 0) {
            joinedGroupsHTML = AppState.joinedGroups.map(group => {
                const isActive = group.groupId === AppState.activeGroupId;
                return `
                <div class="p-3 rounded-xl mb-2 flex justify-between items-center border" style="background-color:var(--bg-tertiary);border-color:var(--border-light);">
                    <div>
                        <div class="font-bold text-sm">${group.groupName || 'অজানা কোর্স'}</div>
                    </div>
                    <div class="flex gap-2">
                        ${!isActive ? `<button onclick="Student.switchGroup('${group.groupId}')" class="text-xs bg-indigo-500 text-white px-2 py-1 rounded">সুইচ</button>` : '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded">সক্রিয়</span>'}
                        <button onclick="Student.confirmLeaveGroup('${group.groupId}')" class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">ত্যাগ</button>
                    </div>
                </div>`;
            }).join('');
        } else {
            joinedGroupsHTML = '<p class="text-slate-400 text-sm">আপনি কোনো কোর্সে জয়েন করেননি।</p>';
        }

        const groupManagementHTML = `
        <div class="mb-6">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-lg">আমার কোর্স</h3>
                <button onclick="Router.student('courses')" class="text-sm bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg font-bold">
                    <i class="fas fa-plus mr-1"></i> নতুন কোর্স খুঁজুন
                </button>
            </div>
            <div class="space-y-2">
                ${joinedGroupsHTML}
            </div>
        </div>`;

        const passwordChangeSection = `
        <div class="change-password-dropdown">
            <div id="password-dropdown-header" class="password-dropdown-header" onclick="Student.togglePasswordDropdown()">
                <div class="flex items-center gap-2">
                    <i class="fas fa-key text-indigo-500"></i>
                    <span class="font-bold">পাসওয়ার্ড পরিবর্তন</span>
                </div>
                <i id="password-chevron" class="fas fa-chevron-down text-slate-400"></i>
            </div>
            <div id="password-form-content" class="password-form-content">
                <div class="space-y-3 mt-4">
                    <div>
                        <label class="form-label">বর্তমান পাসওয়ার্ড</label>
                        <div class="relative">
                            <input type="password" id="current-password" class="form-input" placeholder="বর্তমান পাসওয়ার্ড লিখুন">
                            <i class="fas fa-eye absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onclick="AuthUI.togglePass('current-password', this)"></i>
                        </div>
                    </div>
                    <div>
                        <label class="form-label">নতুন পাসওয়ার্ড</label>
                        <div class="relative">
                            <input type="password" id="new-password" class="form-input" placeholder="নতুন পাসওয়ার্ড লিখুন">
                            <i class="fas fa-eye absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onclick="AuthUI.togglePass('new-password', this)"></i>
                        </div>
                    </div>
                    <div>
                        <label class="form-label">নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
                        <div class="relative">
                            <input type="password" id="confirm-password" class="form-input" placeholder="পুনরায় লিখুন">
                            <i class="fas fa-eye absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onclick="AuthUI.togglePass('confirm-password', this)"></i>
                        </div>
                    </div>
                    <button onclick="Student.changePassword()" class="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">
                        পাসওয়ার্ড পরিবর্তন
                    </button>
                </div>
            </div>
        </div>`;

        c.innerHTML = renderHeader('management') + `
        <div class="p-5 pb-20 max-w-md mx-auto">
            <div class="p-6 rounded-2xl shadow-sm border" style="background-color:var(--card-bg);border-color:var(--border-light);color:var(--text-primary);">
                <h2 class="text-2xl font-bold mb-6 text-center">ম্যানেজমেন্ট</h2>
                
                ${teacherCodesHTML}
                ${groupManagementHTML}
                ${passwordChangeSection}
                
                <button onclick="Auth.confirmLogout()" class="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition mt-4">লগআউট</button>
            </div>
        </div>`;
    },

    togglePasswordDropdown: function() {
        const header = document.getElementById('password-dropdown-header');
        const content = document.getElementById('password-form-content');
        const chevron = document.getElementById('password-chevron');
        
        header.classList.toggle('expanded');
        content.classList.toggle('expanded');
        
        if (chevron.classList.contains('fa-chevron-down')) {
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-up');
        } else {
            chevron.classList.remove('fa-chevron-up');
            chevron.classList.add('fa-chevron-down');
        }
    },
    
    confirmLeaveGroup: async (groupId) => {
        const { value: confirmText } = await Swal.fire({
            title: 'কোর্স ত্যাগ করবেন?',
            text: "নিশ্চিত করতে 'QuickZ' লিখুন",
            input: 'text',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            inputValidator: (value) => {
                if (value !== 'QuickZ') return 'আপনাকে অবশ্যই QuickZ লিখতে হবে';
            }
        });
        
        if (confirmText === 'QuickZ') await Student.leaveGroup(groupId);
    },
    
    addTeacherCode: async () => {
        const { value: teacherCode } = await Swal.fire({
            title: 'শিক্ষক অ্যাকাউন্ট যোগ করুন',
            input: 'text',
            inputLabel: 'শিক্ষক কোড লিখুন',
            inputPlaceholder: 'শিক্ষক কোড',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'আপনাকে একটি শিক্ষক কোড দিতে হবে!';
            }
        });
        
        if (teacherCode) {
            // অফলাইন চেক
            if (!navigator.onLine) {
                Swal.fire('অফলাইন', 'ইন্টারনেট সংযোগ ছাড়া শিক্ষক যোগ করা যাবে না।', 'warning');
                return;
            }
            try {
                const isValidTeacherCode = await Student.verifyTeacherCode(teacherCode);
                if (!isValidTeacherCode) {
                    Swal.fire('ত্রুটি', 'ভুল শিক্ষক কোড। সঠিক কোড দিন।', 'error');
                    return;
                }
                
                const user = auth.currentUser;
                if (!user) return;
                
                const currentCodes = AppState.teacherCodes || [];
                
                const existingCode = currentCodes.find(tc => tc.code === teacherCode);
                if (existingCode) {
                    Swal.fire('ত্রুটি', 'এই শিক্ষক কোডটি ইতিমধ্যে যোগ করা আছে', 'error');
                    return;
                }
                
                const teacherInfo = await Student.getTeacherInfo(teacherCode);
                
                const newCodeObj = { code: teacherCode, active: currentCodes.length === 0 };
                const updatedCodes = [...currentCodes, newCodeObj];
                
                await updateDoc(doc(db, "students", user.uid), { teacherCodes: updatedCodes });
                
                AppState.teacherCodes = updatedCodes;
                AppState.teacherNames[teacherCode] = teacherInfo.name;
                if (newCodeObj.active) {
                    AppState.activeTeacherCode = teacherCode;
                    
                    const teacherGroups = await Student.loadGroupsForCurrentTeacher();
                    if (teacherGroups.length > 0) {
                        AppState.activeGroupId = teacherGroups[0].groupId;
                        localStorage.setItem('activeGroupId', AppState.activeGroupId);
                        refreshExamCache();
                    }
                }
                
                AppState.userProfile.teacherCodes = updatedCodes;
                localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
                
                Swal.fire('সফল', 'শিক্ষক অ্যাকাউন্ট যোগ করা হয়েছে!', 'success').then(() => Student.loadManagement());
            } catch (error) {
                console.error(error);
                Swal.fire('ত্রুটি', 'শিক্ষক কোড যোগ করতে ব্যর্থ', 'error');
            }
        }
    },
    
    switchTeacherCode: async (codeToSwitch) => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            
            const updatedCodes = AppState.teacherCodes.map(tc => ({ ...tc, active: tc.code === codeToSwitch }));
            
            await updateDoc(doc(db, "students", user.uid), { teacherCodes: updatedCodes });
            
            AppState.teacherCodes = updatedCodes;
            AppState.activeTeacherCode = codeToSwitch;
            
            AppState.userProfile.teacherCodes = updatedCodes;
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            
            const teacherGroups = await Student.loadGroupsForCurrentTeacher();
            if (teacherGroups.length > 0) {
                AppState.activeGroupId = teacherGroups[0].groupId;
                localStorage.setItem('activeGroupId', AppState.activeGroupId);
                refreshExamCache();
            } else {
                AppState.activeGroupId = null;
                localStorage.removeItem('activeGroupId');
                ExamCache = {};
            }
            
            Swal.fire('সফল', 'শিক্ষক অ্যাকাউন্টে সুইচ করা হয়েছে!', 'success').then(() => Student.loadManagement());
        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'শিক্ষক অ্যাকাউন্ট পরিবর্তন ব্যর্থ', 'error');
        }
    },
    
    confirmDeleteTeacher: async (teacherCode) => {
        if (AppState.teacherCodes.length <= 1) {
            Swal.fire('ত্রুটি', 'আপনার অন্তত একটি শিক্ষক অ্যাকাউন্ট থাকতে হবে', 'error');
            return;
        }
        
        const { value: confirmText } = await Swal.fire({
            title: 'শিক্ষক অ্যাকাউন্ট মুছবেন?',
            html: `
                <p>আপনি কি নিশ্চিত এই শিক্ষক অ্যাকাউন্ট মুছে ফেলতে চান?</p>
                <p class="text-sm text-red-500 mt-2">নিশ্চিত করতে নিচে <strong>QuickZ</strong> লিখুন:</p>
                <input type="text" id="delete-confirm" class="swal2-input mt-2" placeholder="QuickZ লিখুন">
            `,
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'মুছুন',
            preConfirm: () => {
                const confirmInput = document.getElementById('delete-confirm');
                if (!confirmInput || confirmInput.value !== 'QuickZ') {
                    Swal.showValidationMessage('অনুগ্রহ করে "QuickZ" লিখুন');
                    return false;
                }
                return true;
            }
        });
        
        if (confirmText) await Student.removeTeacherCode(teacherCode);
    },
    
    removeTeacherCode: async (codeToRemove) => {
        if (AppState.teacherCodes.length <= 1) {
            Swal.fire('ত্রুটি', 'আপনার অন্তত একটি শিক্ষক অ্যাকাউন্ট থাকতে হবে', 'error');
            return;
        }
        
        try {
            const user = auth.currentUser;
            if (!user) return;
            
            const removedCode = AppState.teacherCodes.find(tc => tc.code === codeToRemove);
            const updatedCodes = AppState.teacherCodes.filter(tc => tc.code !== codeToRemove);
            
            if (removedCode && removedCode.active) {
                updatedCodes[0].active = true;
                AppState.activeTeacherCode = updatedCodes[0].code;
                
                const teacherGroups = await Student.loadGroupsForCurrentTeacher();
                if (teacherGroups.length > 0) {
                    AppState.activeGroupId = teacherGroups[0].groupId;
                    localStorage.setItem('activeGroupId', AppState.activeGroupId);
                    refreshExamCache();
                } else {
                    AppState.activeGroupId = null;
                    localStorage.removeItem('activeGroupId');
                    ExamCache = {};
                }
            }
            
            await updateDoc(doc(db, "students", user.uid), { teacherCodes: updatedCodes });
            
            AppState.teacherCodes = updatedCodes;
            AppState.userProfile.teacherCodes = updatedCodes;
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            
            Swal.fire('সফল', 'শিক্ষক অ্যাকাউন্ট মুছে ফেলা হয়েছে', 'success').then(() => Student.loadManagement());
        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'শিক্ষক অ্যাকাউন্ট মুছতে ব্যর্থ', 'error');
        }
    },
    
    leaveGroup: async (groupId) => {
        // অফলাইন চেক
        if (!navigator.onLine) {
            Swal.fire('অফলাইন', 'ইন্টারনেট সংযোগ ছাড়া কোর্স ত্যাগ করা যাবে না।', 'warning');
            return;
        }
        try {
            const user = auth.currentUser;
            if (!user) return;
            
            const updatedGroups = AppState.joinedGroups.filter(g => g.groupId !== groupId);
            
            await updateDoc(doc(db, "students", user.uid), { joinedGroups: updatedGroups });
            
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (groupDoc.exists()) {
                const groupData = groupDoc.data();
                const updatedStudentIds = (groupData.studentIds || []).filter(id => id !== user.uid);
                
                await updateDoc(doc(db, "groups", groupId), { studentIds: updatedStudentIds });
            }
            
            AppState.joinedGroups = updatedGroups;
            
            if (AppState.activeGroupId === groupId) {
                const teacherGroups = await Student.loadGroupsForCurrentTeacher();
                if (teacherGroups.length > 0) {
                    AppState.activeGroupId = teacherGroups[0].groupId;
                    localStorage.setItem('activeGroupId', AppState.activeGroupId);
                } else {
                    AppState.activeGroupId = null;
                    localStorage.removeItem('activeGroupId');
                }
                
                refreshExamCache();
            }
            
            AppState.userProfile.joinedGroups = updatedGroups;
            localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));
            
            Swal.fire('সফল', 'কোর্স ত্যাগ করা হয়েছে', 'success').then(() => Student.loadManagement());
        } catch (error) {
            console.error(error);
            Swal.fire('ত্রুটি', 'কোর্স ত্যাগ করতে ব্যর্থ', 'error');
        }
    },
    
    changePassword: async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            Swal.fire('ত্রুটি', 'সবগুলো পাসওয়ার্ড ফিল্ড পূরণ করুন', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            Swal.fire('ত্রুটি', 'নতুন পাসওয়ার্ড মিলছে না', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            Swal.fire('ত্রুটি', 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'error');
            return;
        }
        
        if (!navigator.onLine) {
            Swal.fire('অফলাইন', 'ইন্টারনেট সংযোগ ছাড়া পাসওয়ার্ড পরিবর্তন করা যাবে না।', 'warning');
            return;
        }
        
        try {
            const user = auth.currentUser;
            await signInWithEmailAndPassword(auth, user.email, currentPassword);
            await updatePassword(user, newPassword);
            
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            
            Student.togglePasswordDropdown();
            Swal.fire('সফল', 'পাসওয়ার্ড পরিবর্তন হয়েছে!', 'success');
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                Swal.fire('ত্রুটি', 'বর্তমান পাসওয়ার্ড ভুল', 'error');
            } else {
                Swal.fire('ত্রুটি', 'পাসওয়ার্ড পরিবর্তন ব্যর্থ', 'error');
            }
        }
    },

    // ========== কোর্সসমূহ পেজ (নতুন ফিচার) ==========
    loadCourses: async () => {
        const c = document.getElementById('app-container');
        c.innerHTML = renderHeader('courses') + `
            <div class="p-5 pb-20">
                <h2 class="text-2xl font-bold mb-4 text-center">কোর্সসমূহ</h2>
                <div class="text-center p-10"><div class="loader mx-auto"></div></div>
            </div>
        `;

        try {
            const q = query(
                collection(db, "groups"),
                where("archived", "==", false),
                where("joinEnabled", "==", true)
            );
            const snap = await getDocs(q);
            const allGroups = [];
            snap.forEach(doc => allGroups.push({ id: doc.id, ...doc.data() }));

            window.allCoursesList = allGroups;
            Student.renderCourseList();
        } catch (error) {
            console.error(error);
            c.innerHTML = renderHeader('courses') + `<div class="p-5 text-center text-red-500">কোর্স লোড করতে ত্রুটি</div>`;
        }
    },

    renderCourseList: () => {
        const c = document.getElementById('app-container');
        const allGroups = window.allCoursesList || [];
        const studentClass = AppState.classLevel || '';
        const studentStream = AppState.admissionStream || '';
        const joinedGroupIds = (AppState.joinedGroups || []).map(g => g.groupId);

        const filterClass = document.getElementById('course-filter-class')?.value || 'all';
        const searchTerm = document.getElementById('course-search-input')?.value.toLowerCase().trim() || '';

        let filtered = allGroups.filter(g => {
            if (filterClass !== 'all') {
                if (filterClass === 'Admission') {
                    if (g.classLevel !== 'Admission') return false;
                    const streamFilter = document.getElementById('course-filter-stream')?.value;
                    if (streamFilter && streamFilter !== 'all' && g.admissionStream !== streamFilter) return false;
                } else {
                    if (g.classLevel !== filterClass) return false;
                }
            }
            if (searchTerm) {
                const name = (g.name || '').toLowerCase();
                const teacher = (g.teacherName || '').toLowerCase();
                const desc = (g.description || '').toLowerCase();
                if (!name.includes(searchTerm) && !teacher.includes(searchTerm) && !desc.includes(searchTerm)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (a.classLevel === studentClass && b.classLevel !== studentClass) return -1;
            if (a.classLevel !== studentClass && b.classLevel === studentClass) return 1;
            return 0;
        });

        const classLevels = ['6', '7', '8', 'SSC', 'HSC', 'Admission'];
        const classOptions = classLevels.map(lvl => `<option value="${lvl}">${lvl === 'Admission' ? 'এডমিশন' : (lvl === 'SSC' ? 'এসএসসি' : (lvl === 'HSC' ? 'এইচএসসি' : lvl+'ম শ্রেণী'))}</option>`).join('');

        const streamOptions = `
            <option value="all">সব শাখা</option>
            <option value="Science">সায়েন্স</option>
            <option value="Humanities">মানবিক</option>
            <option value="Commerce">কমার্স</option>
        `;

        let html = `
        <div class="p-5 pb-20">
            <h2 class="text-2xl font-bold mb-2 text-center">কোর্সসমূহ</h2>
            <p class="text-sm text-slate-500 mb-4 text-center">আপনার পছন্দের কোর্স খুঁজুন ও জয়েন করুন</p>
            
            <div class="bg-white dark:bg-dark-secondary p-4 rounded-xl shadow-sm border mb-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label class="block text-xs font-bold mb-1">সার্চ</label>
                        <input type="text" id="course-search-input" class="w-full p-2 border rounded-lg text-sm" placeholder="কোর্সের নাম, শিক্ষক...">
                    </div>
                    <div>
                        <label class="block text-xs font-bold mb-1">ক্লাস/লেভেল</label>
                        <select id="course-filter-class" class="w-full p-2 border rounded-lg text-sm">
                            <option value="all">সব ক্লাস</option>
                            ${classOptions}
                        </select>
                    </div>
                    <div id="stream-filter-container" style="display:none;">
                        <label class="block text-xs font-bold mb-1">শাখা</label>
                        <select id="course-filter-stream" class="w-full p-2 border rounded-lg text-sm">
                            ${streamOptions}
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button onclick="Student.applyCourseFilter()" class="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">ফিল্টার</button>
                    </div>
                </div>
                ${studentClass ? `<p class="text-xs text-indigo-600 mt-3"><i class="fas fa-graduation-cap"></i> আপনার ক্লাস: ${studentClass} ${studentStream ? '('+studentStream+')' : ''}</p>` : ''}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="course-list-container">
                ${Student.renderCourseCards(filtered, joinedGroupIds)}
            </div>
        </div>
        `;

        c.innerHTML = renderHeader('courses') + html;

        const classSelect = document.getElementById('course-filter-class');
        const streamContainer = document.getElementById('stream-filter-container');
        if (classSelect) {
            classSelect.addEventListener('change', function() {
                if (this.value === 'Admission') {
                    streamContainer.style.display = 'block';
                } else {
                    streamContainer.style.display = 'none';
                }
            });
            if (classSelect.value === 'Admission') streamContainer.style.display = 'block';
        }

        const searchInput = document.getElementById('course-search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') Student.applyCourseFilter();
            });
        }
    },

    renderCourseCards: (groups, joinedGroupIds) => {
        if (groups.length === 0) {
            return `<div class="col-span-2 text-center p-10 text-slate-400">কোনো কোর্স পাওয়া যায়নি</div>`;
        }

        return groups.map(group => {
            const isJoined = joinedGroupIds.includes(group.id);
            const joinMethodText = {
                'public': 'পাবলিক',
                'code': 'কোর্স কোড',
                'permission': 'পারমিশন কী'
            }[group.joinMethod] || 'কোর্স কোড';

            const classBadge = group.classLevel ? 
                `<span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${group.classLevel === 'Admission' ? 'এডমিশন' : group.classLevel}</span>` : '';
            
            const streamBadge = group.admissionStream ? 
                `<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">${group.admissionStream}</span>` : '';

            const imageHtml = group.imageUrl ? 
                `<img src="${group.imageUrl}" class="w-full h-36 object-cover rounded-t-xl">` : 
                `<div class="w-full h-36 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-xl"><i class="fas fa-book-open"></i></div>`;

            const actionButton = isJoined ? 
                `<button class="w-full bg-green-100 text-green-700 py-2 rounded-lg text-sm font-bold" disabled><i class="fas fa-check-circle"></i> জয়েন করেছেন</button>` :
                `<button onclick="Student.joinCourse('${group.id}', '${group.joinMethod}', '${group.groupCode || ''}')" class="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">জয়েন করুন</button>`;

            return `
            <div class="bg-white dark:bg-dark-secondary rounded-xl shadow-sm border overflow-hidden">
                ${imageHtml}
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-lg">${group.name}</h3>
                        <div class="flex gap-1">${classBadge} ${streamBadge}</div>
                    </div>
                    <p class="text-xs text-slate-500 mb-1"><i class="fas fa-user-tie"></i> ${group.teacherName || 'শিক্ষক'}</p>
                    <p class="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">${group.description || 'কোনো বিবরণ নেই'}</p>
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs bg-slate-100 dark:bg-dark-tertiary px-2 py-1 rounded-full">${joinMethodText}</span>
                        <span class="text-xs"><i class="fas fa-users"></i> ${group.studentIds?.length || 0} শিক্ষার্থী</span>
                    </div>
                    ${actionButton}
                </div>
            </div>`;
        }).join('');
    },

    applyCourseFilter: () => {
        Student.renderCourseList();
    },

    joinCourse: async (groupId, joinMethod, groupCode) => {
        if (!navigator.onLine) {
            Swal.fire('অফলাইন', 'ইন্টারনেট সংযোগ ছাড়া কোর্সে জয়েন করা যাবে না।', 'warning');
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) return;

            if (joinMethod === 'public') {
                await Student.addToGroupDirectly(groupId);
                return;
            }

            if (joinMethod === 'code') {
                const { value: code } = await Swal.fire({
                    title: 'কোর্স কোড লিখুন',
                    input: 'text',
                    inputPlaceholder: 'কোর্স কোড',
                    showCancelButton: true,
                    inputValidator: (val) => !val ? 'কোর্স কোড আবশ্যক' : null
                });
                if (!code) return;
                if (code !== groupCode) {
                    Swal.fire('ত্রুটি', 'ভুল কোর্স কোড', 'error');
                    return;
                }
                await Student.addToGroupDirectly(groupId);
                return;
            }

            if (joinMethod === 'permission') {
                const { value: key } = await Swal.fire({
                    title: 'পারমিশন কী লিখুন',
                    input: 'text',
                    inputPlaceholder: 'যেমন: abcde-12345',
                    showCancelButton: true,
                    inputValidator: (val) => !val ? 'পারমিশন কী আবশ্যক' : null
                });
                if (!key) return;

                const groupDoc = await getDoc(doc(db, "groups", groupId));
                if (!groupDoc.exists()) throw new Error("কোর্স নেই");
                const group = groupDoc.data();

                if (group.permissionKey !== key || group.permissionKeyUsed) {
                    Swal.fire('ত্রুটি', 'ভুল বা ব্যবহৃত পারমিশন কী', 'error');
                    return;
                }

                await updateDoc(doc(db, "groups", groupId), {
                    permissionKeyUsed: true,
                    permissionKeyUsedBy: user.uid,
                    permissionKeyUsedAt: new Date()
                });

                await Student.addToGroupDirectly(groupId);
            }
        } catch (error) {
            Swal.fire('ত্রুটি', error.message, 'error');
        }
    },

    addToGroupDirectly: async (groupId) => {
        const user = auth.currentUser;
        if (!user) return;

        if ((AppState.joinedGroups || []).find(g => g.groupId === groupId)) {
            Swal.fire('তথ্য', 'আপনি ইতিমধ্যে এই কোর্সে জয়েন করেছেন', 'info');
            return;
        }

        const groupSnap = await getDoc(doc(db, "groups", groupId));
        if (!groupSnap.exists()) throw new Error("কোর্স নেই");
        const groupData = groupSnap.data();

        if (groupData.approvalRequired) {
            await addDoc(collection(db, "join_requests"), {
                studentId: user.uid,
                studentName: AppState.userProfile?.name || user.displayName,
                studentEmail: user.email,
                groupId: groupId,
                teacherId: groupData.teacherId,
                status: 'pending',
                requestedAt: new Date()
            });
            Swal.fire('অনুরোধ পাঠানো হয়েছে', 'শিক্ষক অনুমোদন করলে আপনি কোর্সে যুক্ত হবেন।', 'success');
            return;
        }

        const studentIds = groupData.studentIds || [];
        if (!studentIds.includes(user.uid)) {
            studentIds.push(user.uid);
            await updateDoc(doc(db, "groups", groupId), { studentIds });
        }

        const joined = AppState.joinedGroups || [];
        joined.push({ groupId, groupName: groupData.name });
        await updateDoc(doc(db, "students", user.uid), { joinedGroups: joined });

        AppState.joinedGroups = joined;
        AppState.activeGroupId = groupId;
        localStorage.setItem('activeGroupId', groupId);
        localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));

        Swal.fire('সফল', `"${groupData.name}" কোর্সে জয়েন করেছেন`, 'success').then(() => {
            refreshExamCache();
            Router.student('dashboard');
        });
    }
};

window.Student = Student;  
