// Safe parsing for LocalStorage
let storedGroup = null;
try {
    const rawGroup = localStorage.getItem('selectedGroup');
    if (rawGroup && rawGroup !== 'undefined') {
        storedGroup = JSON.parse(rawGroup);
    }
} catch(e) {
    console.warn("Error parsing selectedGroup", e);
}

export const AppState = { 
    role: null,
    darkMode: false,
    currentUser: null,
    teacherProfile: null,
    selectedGroup: storedGroup,
    currentPage: 'home' 
};

// Global caches and folder structure (will be extended later)
window.ExamCache = {}; 
window.unsubscribes = [];
window.folderStructure = { live: [], mock: [], uncategorized: [] };
window.folders = [];
window.currentFocusedTextarea = null;
window.questionMode = 'manual';

// Initialize dark mode from localStorage
if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.classList.add('dark');
    AppState.darkMode = true;
}
