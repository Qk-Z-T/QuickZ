// teacher/js/offline.js
import { AppState } from '../core/state.js';
import { db } from '../config/firebase.js';
import { collection, addDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

  // পরীক্ষা তৈরি/এডিট করার সময় অফলাইনে সংরক্ষণ
  async saveExamOffline(examData) {
    // যদি examData তে id থাকে তাহলে update, না থাকলে add
    const operation = examData.id ? 'update' : 'add';
    await DB.addToSyncQueue({
      collection: 'exams',
      operation,
      payload: examData,
      docId: examData.id || null,
      teacherId: AppState.user?.uid,
      timestamp: Date.now()
    });
    console.log('📝 Exam saved offline, pending sync');
  },

  // নোটিশ/পোল সংরক্ষণ
  async saveNoticeOffline(noticeData) {
    await DB.addToSyncQueue({
      collection: 'notices',
      operation: 'add',
      payload: noticeData,
      teacherId: AppState.user?.uid,
      timestamp: Date.now()
    });
  },

  // গ্রুপ/কোর্সের পরিবর্তন
  async saveGroupOffline(groupData) {
    const operation = groupData.id ? 'update' : 'add';
    await DB.addToSyncQueue({
      collection: 'groups',
      operation,
      payload: groupData,
      docId: groupData.id || null,
      teacherId: AppState.user?.uid,
      timestamp: Date.now()
    });
  },

  async syncPending() {
    if (!this.isOnline) return;
    
    // DB গ্লোবাল আছে কিনা চেক (db.js থেকে)
    if (typeof DB === 'undefined') {
      console.warn('DB module not loaded yet, retry later');
      return;
    }

    const pending = await DB.getPendingSyncItems();
    if (!pending || pending.length === 0) return;

    console.log(`🔄 Syncing ${pending.length} teacher items...`);
    for (let item of pending) {
      try {
        if (item.collection === 'exams') {
          if (item.operation === 'add') {
            const examRef = await addDoc(collection(db, 'exams'), {
              ...item.payload,
              offlineSync: true,
              syncedAt: new Date().toISOString()
            });
            // যদি ফোল্ডার স্ট্রাকচার আপডেটের প্রয়োজন হয়, তাহলে এখানে realtime-sync এর ফাংশন কল করতে পারেন
          } else if (item.operation === 'update' && item.docId) {
            const examDoc = doc(db, 'exams', item.docId);
            await setDoc(examDoc, {
              ...item.payload,
              offlineSync: true,
              syncedAt: new Date().toISOString()
            }, { merge: true });
          }
        } else if (item.collection === 'notices') {
          await addDoc(collection(db, 'notices'), {
            ...item.payload,
            offlineSync: true
          });
        } else if (item.collection === 'groups') {
          if (item.operation === 'add') {
            await addDoc(collection(db, 'groups'), {
              ...item.payload,
              offlineSync: true
            });
          } else if (item.operation === 'update' && item.docId) {
            const groupDoc = doc(db, 'groups', item.docId);
            await setDoc(groupDoc, { ...item.payload, offlineSync: true }, { merge: true });
          }
        }
        // সফল হলে কিউ থেকে মুছে ফেলুন
        await DB.markSyncItemDone(item.id);
      } catch (e) {
        console.error('Sync error for item', item.id, e);
        // রিট্রাই কাউন্ট বাড়ানো (db.js ইতিমধ্যে retryCount রাখে)
      }
    }
    // সব শেষে আবার চেক করে দেখুন আর কিছু বাকি আছে কিনা
    const remaining = await DB.getPendingSyncItems();
    if (remaining.length === 0) {
      this.showToast('সব ডাটা সফলভাবে সিঙ্ক হয়েছে।', 'success');
    }
  }
};

window.TeacherOffline = TeacherOffline;
