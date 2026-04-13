// js/features/realtime-sync.js
// রিয়েল-টাইম সিঙ্ক এবং ফোল্ডার স্ট্রাকচার ম্যানেজমেন্ট
// আপডেট: হোম পেজের জন্য ব্যাকগ্রাউন্ড ক্যাশ আপডেট (UI রি-রেন্ডার হয় না)

import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, onSnapshot, doc, setDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let unsubscribes = window.unsubscribes;
let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

// UI আপডেট হেল্পার (AppState.currentPage ব্যবহার করে নির্ভুল চেক)
function updateUIRendering() {
    const page = AppState.currentPage;
    const Teacher = window.Teacher;
    
    if (!Teacher) {
        console.warn('Teacher object not available yet');
        return;
    }
    
    console.log('UI update triggered for page:', page);
    
    // হোম পেজের জন্য বিশেষ আচরণ: UI রি-রেন্ডার না করে শুধু ক্যাশ আপডেট করো
    if (page === 'home') {
        if (typeof Teacher.updateHomeCacheFromRealtime === 'function') {
            Teacher.updateHomeCacheFromRealtime();
        }
        return; // UI রেন্ডার স্কিপ করো
    }
    
    // অন্যান্য পেজের জন্য UI আপডেট
    if (page === 'folders') {
        if (typeof Teacher.renderFolderTree === 'function') Teacher.renderFolderTree();
        if (typeof Teacher.renderUncategorizedExams === 'function') Teacher.renderUncategorizedExams();
    } else if (page === 'rank') {
        if (typeof Teacher.rankView === 'function') Teacher.rankView();
    } else if (page === 'management') {
        // কিছু ক্ষেত্রে liveExamManagementView কল হতে পারে, তবে সেটি পেজের উপর নির্ভর করে
    }
}

export async function saveFolderStructureToFirebase() {
    if (!AppState.currentUser || !AppState.selectedGroup) return;
    try {
        const folderDocRef = doc(db, "folderStructures", `${AppState.currentUser.id}_${AppState.selectedGroup.id}`);
        await setDoc(folderDocRef, {
            ...folderStructure,
            updatedAt: new Date()
        }, { merge: true });
        console.log('Folder structure saved');
    } catch (error) {
        console.error("Folder Sync Error:", error);
    }
}

export function initRealTimeSync() {
    console.log('initRealTimeSync called, selectedGroup:', AppState.selectedGroup);
    if (!AppState.selectedGroup || !AppState.currentUser) {
        console.warn('No selected group or user, skipping realtime sync');
        return;
    }
    
    clearListeners();
    
    const folderDocRef = doc(db, "folderStructures", `${AppState.currentUser.id}_${AppState.selectedGroup.id}`);
    const unsubFolders = onSnapshot(folderDocRef, (docSnap) => {
        if (docSnap.exists()) {
            folderStructure = docSnap.data();
        } else {
            folderStructure = { live: [], mock: [], uncategorized: [] };
        }
        window.folderStructure = folderStructure;
        console.log('Folder structure updated:', folderStructure);
        updateUIRendering();
    }, (error) => {
        console.error('Folder snapshot error:', error);
    });
    unsubscribes.push(unsubFolders);
    
    const q = query(
        collection(db, "exams"),
        where("groupId", "==", AppState.selectedGroup.id)
    );
    const unsubExams = onSnapshot(q, (snap) => {
        ExamCache = {};
        snap.forEach(d => {
            ExamCache[d.id] = { id: d.id, ...d.data() };
        });
        window.ExamCache = ExamCache;
        console.log('Exams cache updated, count:', Object.keys(ExamCache).length);
        updateUIRendering();
    }, (error) => {
        console.error('Exams snapshot error:', error);
    });
    unsubscribes.push(unsubExams);
}

export function clearListeners() {
    unsubscribes.forEach(u => u());
    unsubscribes = [];
    window.unsubscribes = unsubscribes;
    console.log('All listeners cleared');
}

// গ্লোবাল এক্সপোজ
window.saveFolderStructureToFirebase = saveFolderStructureToFirebase;
window.initRealTimeSync = initRealTimeSync;
window.clearListeners = clearListeners;
