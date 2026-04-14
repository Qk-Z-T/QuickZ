// js/db.js
const DB_NAME = 'QuickZOfflineDB';
const DB_VERSION = 1;

// স্টোর নামসমূহ (প্রয়োজন অনুযায়ী বাড়াতে পারেন)
const STORES = {
  EXAMS: 'exams',
  RESULTS: 'results',
  QUESTIONS: 'questions',
  SYNC_QUEUE: 'syncQueue'  // পরবর্তী সিঙ্কের জন্য মিউটেশন রাখবে
};

let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      // প্রয়োজনীয় স্টোর তৈরি
      if (!db.objectStoreNames.contains(STORES.EXAMS)) {
        db.createObjectStore(STORES.EXAMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.RESULTS)) {
        db.createObjectStore(STORES.RESULTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
        db.createObjectStore(STORES.QUESTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_status', 'status');
      }
    };
  });
  return dbPromise;
}

// সাধারণ CRUD
async function saveData(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = Array.isArray(data) 
      ? data.forEach(item => store.put(item)) 
      : store.put(data);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    if (!Array.isArray(data)) request.onsuccess = () => resolve(true);
  });
}

async function getData(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = key ? store.get(key) : store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteData(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// সিঙ্ক কিউ ম্যানেজমেন্ট
async function addToSyncQueue(operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const item = {
      ...operation,
      status: 'pending',
      timestamp: Date.now()
    };
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingSyncItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('by_status');
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function markSyncItemDone(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.status = 'done';
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// গ্লোবাল এক্সপোজ (ঐচ্ছিক)
window.DB = { saveData, getData, deleteData, addToSyncQueue, getPendingSyncItems, markSyncItemDone, STORES };
