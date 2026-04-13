// js/features/realtime-sync.js
// রিয়েল-টাইম সিঙ্ক এবং ফোল্ডার স্ট্রাকচার ম্যানেজমেন্ট
// আপডেট: হোম পেজ সহ সব পেজ সরাসরি UI রি-রেন্ডার হবে (ক্যাশ স্কিপ নেই)

import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, onSnapshot, doc, setDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let unsubscribes = window.unsubscribes;
let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

// UI আপডেট হেল্পার (সব পেজ সরাসরি রি-রেন্ডার)
function updateUIRendering() {
    const page = AppState.currentPage;
    const Teacher = window.Teacher;
    
    if (!Teacher) {
        console.warn('Teacher object not available yet');
        return;
    }
    
    console.log('UI update triggered for page:', page);
    
    // পেজ অনুযায়ী UI রেন্ডার
    if (page === 'home') {
        if (typeof Teacher.homeView === 'function') Teacher.homeView();
    } else if (page === 'folders') {
        if (typeof Teacher.renderFolderTree === 'function') Teacher.renderFolderTree();
        if (typeof Teacher.renderUncategorizedExams === 'function') Teacher.renderUncategorizedExams();
    } else if (page === 'rank') {
        if (typeof Teacher.rankView === 'function') Teacher.rankView();
    } else if (page === 'management') {
        if (typeof Teacher.liveExamManagementView === 'function') Teacher.liveExamManagementView();
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
