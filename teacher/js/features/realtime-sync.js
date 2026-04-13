// js/features/realtime-sync.js
// রিয়েল-টাইম সিঙ্ক এবং ফোল্ডার স্ট্রাকচার ম্যানেজমেন্ট

import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, onSnapshot, doc, setDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

let unsubscribes = window.unsubscribes;
let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

// UI আপডেট হেল্পার
function updateUIRendering() {
    const container = document.getElementById('app-container');
    if (!container) return;
    
    if (container.innerHTML.includes('লাইব্রেরি ব্যবস্থাপনা')) {
        if (typeof Teacher.renderFolderTree === 'function') Teacher.renderFolderTree();
        if (typeof Teacher.renderUncategorizedExams === 'function') Teacher.renderUncategorizedExams();
    }
    if (container.innerHTML.includes('লাইভ পরীক্ষার র‍্যাংকিং')) {
        if (typeof Teacher.rankView === 'function') Teacher.rankView();
    }
    if (container.innerHTML.includes('লাইভ পরীক্ষা ব্যবস্থাপনা')) {
        if (typeof Teacher.liveExamManagementView === 'function') Teacher.liveExamManagementView();
    }
    if (container.innerHTML.includes('ড্যাশবোর্ড হোম')) {
        if (typeof Teacher.homeView === 'function') Teacher.homeView();
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
    } catch (error) {
        console.error("Folder Sync Error:", error);
    }
}

export function initRealTimeSync() {
    if (!AppState.selectedGroup || !AppState.currentUser) return;
    
    clearListeners();
    
    const folderDocRef = doc(db, "folderStructures", `${AppState.currentUser.id}_${AppState.selectedGroup.id}`);
    const unsubFolders = onSnapshot(folderDocRef, (docSnap) => {
        if (docSnap.exists()) {
            folderStructure = docSnap.data();
        } else {
            folderStructure = { live: [], mock: [], uncategorized: [] };
        }
        window.folderStructure = folderStructure;
        updateUIRendering();
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
        updateUIRendering();
    });
    unsubscribes.push(unsubExams);
}

export function clearListeners() {
    unsubscribes.forEach(u => u());
    unsubscribes = [];
    window.unsubscribes = unsubscribes;
}

// গ্লোবাল এক্সপোজ (যাতে অন্য ফাইল পায়)
window.saveFolderStructureToFirebase = saveFolderStructureToFirebase;
window.initRealTimeSync = initRealTimeSync;
window.clearListeners = clearListeners;
