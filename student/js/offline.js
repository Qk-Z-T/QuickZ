// js/offline.js
// Offline manager module

import { db } from './config.js';
import { AppState, ExamCache } from './state.js';

import { 
    doc, 
    collection, 
    query, 
    where, 
    getDocs,
    updateDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export const OfflineManager = {
    init: () => {
        window.addEventListener('online', async () => {
            document.getElementById('offline-toast').classList.remove('show');
            const onlineToast = document.getElementById('online-toast');
            if (onlineToast) {
                onlineToast.classList.add('show');
                // ২ সেকেন্ড পর অটো-হাইড (FIX 2)
                setTimeout(() => {
                    onlineToast.classList.remove('show');
                }, 2000);
            }
            await OfflineManager.syncPendingAttempts();
            if (AppState.activeGroupId) await OfflineManager.cacheAllExams();
        });
        window.addEventListener('offline', () => {
            document.getElementById('offline-toast').classList.add('show');
        });
        if (!navigator.onLine) {
            document.getElementById('offline-toast').classList.add('show');
        }
        if (navigator.onLine) {
            OfflineManager.syncPendingAttempts();
        }
    },
    
    cacheAllExams: async () => {
        if (!AppState.activeGroupId) return;
        try {
            const snap = await getDocs(query(
                collection(db, "exams"),
                where("groupId", "==", AppState.activeGroupId)
            ));
            const examCache = {};
            snap.forEach(d => { examCache[d.id] = { id: d.id, ...d.data() }; });
            localStorage.setItem('offlineExamCache_' + AppState.activeGroupId, JSON.stringify(examCache));
            localStorage.setItem('offlineExamCacheTime_' + AppState.activeGroupId, Date.now().toString());
            if (!ExamCache) window.ExamCache = {};
            Object.assign(ExamCache, examCache);
        } catch(e) {
            console.warn('Cache failed', e);
        }
    },
    
    loadExamFromCache: (examId) => {
        if (ExamCache && ExamCache[examId]) return ExamCache[examId];
        if (!AppState.activeGroupId) return null;
        const cached = localStorage.getItem('offlineExamCache_' + AppState.activeGroupId);
        if (!cached) return null;
        const cacheObj = JSON.parse(cached);
        return cacheObj[examId] || null;
    },
    
    savePendingAttempt: (submissionData, attemptId) => {
        const offlineData = {
            ...submissionData,
            firestoreId: attemptId,
            localId: attemptId || ('local_' + Date.now())
        };
        const pending = JSON.parse(localStorage.getItem('pendingSyncAttempts') || '[]');
        const existIdx = pending.findIndex(p => p.localId === offlineData.localId);
        if (existIdx >= 0) pending[existIdx] = offlineData;
        else pending.push(offlineData);
        localStorage.setItem('pendingSyncAttempts', JSON.stringify(pending));
        localStorage.removeItem('currentExamProgress');
    },
    
    syncPendingAttempts: async () => {
        const pending = JSON.parse(localStorage.getItem('pendingSyncAttempts') || '[]');
        if (pending.length === 0) return;
        
        const stillPending = [];
        let syncedCount = 0;
        
        for (const attempt of pending) {
            try {
                const submitData = {
                    userId: attempt.userId,
                    userName: attempt.userName,
                    examId: attempt.examId,
                    examTitle: attempt.examTitle,
                    score: attempt.score,
                    answers: attempt.answers,
                    markedAnswers: attempt.markedAnswers || [],
                    startedAt: attempt.startedAt ? new Date(attempt.startedAt) : new Date(),
                    submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt) : new Date(),
                    isPractice: attempt.isPractice || false,
                    groupId: attempt.groupId || AppState.activeGroupId,
                    status: 'submitted',
                    syncedAt: new Date(),
                    syncedOffline: true
                };
                
                if (attempt.firestoreId && !attempt.firestoreId.startsWith('local_')) {
                    await updateDoc(doc(db, "attempts", attempt.firestoreId), {
                        answers: attempt.answers,
                        markedAnswers: attempt.markedAnswers || [],
                        score: attempt.score,
                        submittedAt: submitData.submittedAt,
                        status: 'submitted',
                        syncedAt: new Date(),
                        syncedOffline: true
                    });
                } else {
                    await addDoc(collection(db, "attempts"), submitData);
                }
                syncedCount++;
            } catch(e) {
                stillPending.push(attempt);
            }
        }
        
        localStorage.setItem('pendingSyncAttempts', JSON.stringify(stillPending));
        
        if (syncedCount > 0) {
            Swal.fire({
                title: '✅ সিঙ্ক সম্পন্ন',
                text: syncedCount + 'টি পরীক্ষার উত্তর সফলভাবে আপলোড হয়েছে।',
                icon: 'success',
                timer: 3000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    }
};
