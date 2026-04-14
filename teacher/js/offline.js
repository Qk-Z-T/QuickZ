// teacher/js/offline.js
import { AppState } from '../core/state.js';
import { db } from '../config/firebase.js';
import { 
    collection, addDoc, setDoc, doc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export const TeacherOffline = {
    isOnline: navigator.onLine,

    init() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        if (!this.isOnline) this.showToast('অফলাইন মোড সক্রিয়। পরিবর্তনগুলো পরবর্তীতে সিঙ্ক হবে।', 'warning');
    },

    handleOnline() {
        this.isOnline = true;
        this.showToast('অনলাইনে ফিরেছেন, ডাটা সিঙ্ক হচ্ছে...', 'success');
        this.syncPending();
    },

    handleOffline() {
        this.isOnline = false;
        this.showToast('ইন্টারনেট সংযোগ বিচ্ছিন্ন।', 'warning');
    },

    showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm shadow-lg z-50 flex items-center ${
            type === 'success' ? 'bg-green-600' : 'bg-amber-600'
        } text-white`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} mr-2"></i>${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    },

    // পরীক্ষা সংরক্ষণ (অফলাইন)
    async saveExamOffline(examData) {
        if (typeof DB === 'undefined') {
            console.warn('DB module not loaded');
            return;
        }
        const operation = examData.id ? 'update' : 'add';
        await DB.addToSyncQueue({
            collection: 'exams',
            operation,
            payload: examData,
            docId: examData.id || null,
            teacherId: AppState.user?.uid,
            timestamp: Date.now()
        });
        console.log('📝 Exam saved offline');
    },

    // সাবজেক্ট সংরক্ষণ
    async saveSubjectOffline(subjectData) {
        if (typeof DB === 'undefined') return;
        await DB.addToSyncQueue({
            collection: 'subjects',
            operation: subjectData.operation || 'add',
            payload: subjectData,
            teacherId: AppState.user?.uid,
            timestamp: Date.now()
        });
    },

    // চ্যাপ্টার সংরক্ষণ
    async saveChapterOffline(chapterData) {
        if (typeof DB === 'undefined') return;
        await DB.addToSyncQueue({
            collection: 'chapters',
            operation: chapterData.operation || 'add',
            payload: chapterData,
            teacherId: AppState.user?.uid,
            timestamp: Date.now()
        });
    },

    // রিনেইম অপারেশন
    async saveRenameOperation(renameData) {
        if (typeof DB === 'undefined') return;
        await DB.addToSyncQueue({
            collection: 'rename',
            operation: 'update',
            payload: renameData,
            teacherId: AppState.user?.uid,
            timestamp: Date.now()
        });
    },

    // ডিলিট অপারেশন
    async saveDeleteOperation(deleteData) {
        if (typeof DB === 'undefined') return;
        await DB.addToSyncQueue({
            collection: 'delete',
            operation: 'delete',
            payload: deleteData,
            teacherId: AppState.user?.uid,
            timestamp: Date.now()
        });
    },

    // সিঙ্ক পেন্ডিং আইটেম
    async syncPending() {
        if (!this.isOnline) return;
        if (typeof DB === 'undefined') {
            console.warn('DB module not loaded yet');
            return;
        }

        const pending = await DB.getPendingSyncItems();
        if (!pending || pending.length === 0) return;

        console.log(`🔄 Syncing ${pending.length} teacher items...`);
        for (let item of pending) {
            try {
                if (item.collection === 'exams') {
                    if (item.operation === 'add') {
                        await addDoc(collection(db, 'exams'), {
                            ...item.payload,
                            offlineSync: true,
                            syncedAt: new Date().toISOString()
                        });
                    } else if (item.operation === 'update' && item.docId) {
                        const examDoc = doc(db, 'exams', item.docId);
                        await setDoc(examDoc, { ...item.payload, offlineSync: true, syncedAt: new Date().toISOString() }, { merge: true });
                    }
                }
                // অন্যান্য collection এর জন্য প্রয়োজনীয় লজিক যোগ করতে পারেন
                await DB.markSyncItemDone(item.id);
            } catch (e) {
                console.error('Sync error for item', item.id, e);
            }
        }
        const remaining = await DB.getPendingSyncItems();
        if (remaining.length === 0) {
            this.showToast('সব ডাটা সফলভাবে সিঙ্ক হয়েছে।', 'success');
        }
    }
};

window.TeacherOffline = TeacherOffline;
