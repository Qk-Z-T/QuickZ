// js/config.js
// Firebase configuration and initialization

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB4A6r2JlK_P-29fmC8LSi8gz-HjzFA4CQ",
    authDomain: "exam-611e5.firebaseapp.com",
    projectId: "exam-611e5",
    storageBucket: "exam-611e5.firebasestorage.app",
    messagingSenderId: "887013693688",
    appId: "1:887013693688:web:35cedd5b463bf642fa030d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    console.warn('Persistence failed', err);
});

export { app, auth, db };
