// js/teacher/exam-create.js
// Exam creation features (with current course info card)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { autoResizeTextarea } from '../core/utils.js';
import { 
    collection, addDoc, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { saveFolderStructureToFirebase } from '../features/realtime-sync.js';
import { TeacherOffline } from '../offline.js';

let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

// ------------- Create View (with course card) -------------
Teacher.createView = () => {
    if (!AppState.selectedGroup) {
        Teacher.selectGroupView('create');
        return;
    }
    
    Teacher.questions = [];
    Teacher.currentQuestion = null;
    
    document.getElementById('app-container').innerHTML = `
    <div class="pb-6 max-w-5xl">
        <div class="flex justify-between items-center mb-6">
            <div>
                <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white">Teacher Dashboard</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Create and manage exams</p>
            </div>
        </div>
        <!-- Current Course Info Card -->
        <div id="create-course-info-card" class="bg-white dark:bg-dark-secondary rounded-2xl shadow-sm border dark:border-dark-tertiary overflow-hidden mb-6">
            <div class="p-5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600">
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-bold dark:text-white">${AppState.selectedGroup.name}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400">সক্রিয় কোর্স</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <button onclick="Teacher.renderForm('live')" class="h-44 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-6 relative overflow-hidden shadow-lg transition hover:shadow-xl hover:-translate-y-1 text-left group">
                <div class="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4"><i class="fas fa-broadcast-tower text-2xl"></i></div>
                <h3 class="text-xl font-bold">Create Live Exam</h3>
                <p class="text-indigo-100 text-sm mt-1">Schedule an exam for a specific time.</p>
                <i class="fas fa-arrow-right absolute right-6 bottom-6 opacity-40 group-hover:opacity-80 transition"></i>
            </button>
            <button onclick="Teacher.renderForm('mock')" class="h-44 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 relative overflow-hidden shadow-lg transition hover:shadow-xl hover:-translate-y-1 text-left group">
                <div class="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4"><i class="fas fa-book-reader text-2xl"></i></div>
                <h3 class="text-xl font-bold">Create Practice</h3>
                <p class="text-emerald-100 text-xs mt-1">Mock tests with subjects and chapters.</p>
                <i class="fas fa-pencil-alt absolute right-6 top-1/2 -translate-y-1/2 text-6xl opacity-20 group-hover:scale-110 transition"></i>
            </button>
        </div>
    </div>`;
    
    document.getElementById('floating-math-btn').classList.add('hidden');
    
    // কোর্সের বিস্তারিত তথ্য এনে কার্ড আপডেট করি
    Teacher.updateCreateCourseCard();
};

// কোর্স কার্ড আপডেট করার ফাংশন
Teacher.updateCreateCourseCard = async () => {
    try {
        const groupDoc = await getDoc(doc(db, "groups", AppState.selectedGroup.id));
        if (!groupDoc.exists()) return;
        const group = groupDoc.data();
        
        const cardContainer = document.getElementById('create-course-info-card');
        if (!cardContainer) return;
        
        const classBadge = group.classLevel ? 
            `<span class="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">${group.classLevel === 'Admission' ? 'এডমিশন' : group.classLevel}</span>` : '';
        const streamBadge = group.admissionStream ? 
            `<span class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full ml-1">${group.admissionStream}</span>` : '';
        const joinMethodText = {
            'public': 'পাবলিক',
            'code': 'কোর্স কোড',
            'permission': 'পারমিশন কী'
        }[group.joinMethod] || 'কোর্স কোড';
        
        const imageHtml = group.imageUrl ? 
            `<img src="${group.imageUrl}" alt="${group.name}" class="w-full h-32 object-cover rounded-t-2xl">` : 
            `<div class="w-full h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-2xl"><i class="fas fa-pencil-alt"></i></div>`;
        
        cardContainer.innerHTML = `
            ${imageHtml}
            <div class="p-5">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-xl font-bold dark:text-white bengali-text">${group.name}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            ${classBadge} ${streamBadge}
                            <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">${joinMethodText}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${group.studentIds?.length || 0}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400">শিক্ষার্থী</div>
                    </div>
                </div>
                ${group.description ? `<p class="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">${group.description}</p>` : ''}
                <p class="text-xs text-slate-400 mt-2"><i class="fas fa-info-circle mr-1"></i> এই কোর্সের জন্যই পরীক্ষা তৈরি হবে</p>
            </div>
        `;
    } catch (e) {
        console.error('Error updating create course card:', e);
    }
};

Teacher.renderForm = function(type) {
    if (!AppState.selectedGroup) {
        Teacher.selectGroupView('create');
        return;
    }
    
    document.getElementById('floating-math-btn').classList.remove('hidden');
    
    Teacher.questions = [];
    Teacher.currentQuestion = null;
    
    const isLive = type === 'live';
    
    const getSubjectsForType = (type) => {
        return [...new Set(folderStructure[type].map(s => s.name))];
    };
    
    const subjects = getSubjectsForType(type);
    
    document.getElementById('app-container').innerHTML = `
    <div class="w-full px-4 md:px-6">
        <div class="flex justify-between items-center mb-4">
            <button onclick="Teacher.createView()" class="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <i class="fas fa-arrow-left"></i> Back to Dashboard
            </button>
        </div>
        <h2 class="text-xl font-bold mb-4 font-en text-slate-800 dark:text-white">Create ${isLive ? 'Live Exam' : 'Practice Test'}</h2>
        
        <!-- Current Course Mini Info -->
        <div id="form-course-mini-card" class="bg-white dark:bg-dark-secondary p-3 rounded-xl shadow-sm border dark:border-dark-tertiary mb-4 flex items-center gap-3">
            <div class="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 text-sm">
                <i class="fas fa-book"></i>
            </div>
            <div>
                <span class="font-bold dark:text-white text-sm">${AppState.selectedGroup.name}</span>
                <span class="text-xs text-slate-500 dark:text-slate-400 ml-2">পরীক্ষা তৈরি হচ্ছে</span>
            </div>
        </div>
        
        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary w-full">
            <input id="nt" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="Exam Title">
            <input type="hidden" id="nty" value="${type}"> 
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div class="select-container">
                    <label class="block text-sm font-bold mb-1 dark:text-white">Subject</label>
                    <select id="nsub" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" ${type === 'mock' ? 'required' : ''}>
                        <option value="">Select Subject (Optional)</option>
                        ${subjects.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="select-container">
                    <label class="block text-sm font-bold mb-1 dark:text-white">Chapter</label>
                    <select id="nchap" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" ${type === 'mock' ? 'required' : ''}>
                        <option value="">Select Chapter (Optional)</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div>
                    <label class="block text-sm font-bold mb-1 dark:text-white">Duration (Minutes)</label>
                    <input id="nd" type="number" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="e.g., 60" required>
                </div>
                <div>
                    <label class="block text-sm font-bold mb-1 dark:text-white">Total Marks</label>
                    <input id="nm" type="number" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="e.g., 100" required>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div>
                    <label class="block text-sm font-bold mb-1 dark:text-white">Negative Mark</label>
                    <select id="nneg" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl">
                        <option value="0" selected>0 (No Negative)</option>
                        <option value="0.25">0.25 (¼ Mark)</option>
                        <option value="0.50">0.50 (½ Mark)</option>
                    </select>
                </div>
                <div class="flex items-center text-xs text-slate-500 bg-slate-50 dark:bg-dark-tertiary dark:text-slate-400 p-2 rounded border dark:border-dark-tertiary">Type: ${type.toUpperCase()}</div>
            </div>
            
            ${isLive ? `
            <div class="p-3 bg-indigo-50 dark:bg-indigo-900 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-3 mt-4">
                <div>
                    <label class="text-sm font-bold text-indigo-800 dark:text-indigo-300">Start Time</label>
                    <input id="nst" type="datetime-local" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-lg text-sm">
                </div>
                <div>
                    <label class="text-sm font-bold text-indigo-800 dark:text-indigo-300">End Time</label>
                    <input id="net" type="datetime-local" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-lg text-sm">
                </div>
                <div class="auto-publish-container">
                    <input type="checkbox" id="nautopub" checked>
                    <label for="nautopub" class="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Auto Publish Result when exam ends
                    </label>
                </div>
            </div>` : ''}
            
            <div class="flex items-center justify-between mb-3 mt-6">
                <label class="text-sm font-bold text-slate-700 dark:text-white">Question Mode:</label>
                <div class="flex items-center gap-2">
                    <button id="mode-manual" onclick="Teacher.switchQuestionMode('manual')" class="px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg">Manual</button>
                    <button id="mode-json" onclick="Teacher.switchQuestionMode('json')" class="px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg">JSON</button>
                </div>
            </div>
            
            <div id="questions-list" class="space-y-3 mb-6">
                <h3 class="font-bold text-lg mb-2 dark:text-white">Questions List (${Teacher.questions.length})</h3>
                <div class="text-center p-4 text-slate-400">No questions added yet</div>
            </div>
            
            <div id="manual-questions-container" class="space-y-4 w-full">
                <div class="question-box dark:bg-black dark:border-dark-tertiary w-full">
                    <h3 class="font-bold text-lg mb-3 dark:text-white" id="question-form-title">Add New Question</h3>
                    
                    <div class="question-field-container mb-3 w-full">
                        <label class="block text-sm font-bold mb-1 dark:text-white">Question Text</label>
                        <textarea id="textarea-question" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl question-textarea auto-resize box-border" rows="3" placeholder="Enter question text..." oninput="autoResizeTextarea(this)"></textarea>
                        <button type="button" class="math-preview-btn" data-target="textarea-question">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    
                    <div class="mb-3 w-full">
                        <label class="block text-sm font-bold mb-2 dark:text-white">Options:</label>
                        <div class="space-y-2 w-full">
                            ${['A', 'B', 'C', 'D'].map((letter, index) => `
                                <div class="flex items-center gap-2 w-full">
                                    <span class="font-bold w-6 dark:text-white">${letter}.</span>
                                    <div class="question-field-container flex-1 w-full">
                                        <textarea id="option-${letter.toLowerCase()}" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded option-textarea auto-resize box-border" rows="2" placeholder="Option ${letter}" oninput="autoResizeTextarea(this)"></textarea>
                                        <button type="button" class="math-preview-btn" data-target="option-${letter.toLowerCase()}">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="mb-3 w-full">
                        <label class="block text-sm font-bold mb-1 dark:text-white">Correct Answer</label>
                        <select id="correct-answer" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded">
                            <option value="">Select Correct Answer</option>
                            <option value="0">A</option>
                            <option value="1">B</option>
                            <option value="2">C</option>
                            <option value="3">D</option>
                        </select>
                    </div>
                    
                    <div class="mb-3 w-full">
                        <label class="block text-sm font-bold mb-1 dark:text-white">Explanation (Optional)</label>
                        <div class="question-field-container w-full">
                            <textarea id="explanation" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded explanation-textarea auto-resize box-border" rows="2" placeholder="Add explanation for this question (optional)..." oninput="autoResizeTextarea(this)"></textarea>
                            <button type="button" class="math-preview-btn" data-target="explanation">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-3 w-full">
                        <label class="block text-sm font-bold mb-1 dark:text-white">Previous Year (Optional)</label>
                        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                            <input type="text" id="previous-year" class="flex-1 w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded" placeholder="e.g., 2020 HSC">
                            <div class="flex items-center gap-2 whitespace-nowrap">
                                <input type="checkbox" id="show-previous-year" class="rounded">
                                <label for="show-previous-year" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Show in question
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="Teacher.addQuestionToList()" id="add-question-btn" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition">
                        <i class="fas fa-plus mr-2"></i> Add Question to List
                    </button>
                </div>
            </div>
            
            <div id="json-container" class="hidden w-full mt-4">
                <div class="json-actions flex gap-2 mb-2">
                    <button onclick="Teacher.copyJson()" class="bg-indigo-600 text-white px-3 py-2 rounded text-sm font-bold">
                        <i class="fas fa-copy mr-1"></i> Copy JSON
                    </button>
                    <button onclick="Teacher.clearJson()" class="bg-red-600 text-white px-3 py-2 rounded text-sm font-bold">
                        <i class="fas fa-trash mr-1"></i> Clear JSON
                    </button>
                </div>
                <textarea id="nq" class="w-full h-40 p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl font-mono text-xs auto-resize box-border" placeholder='Paste JSON Question Array here...' oninput="autoResizeTextarea(this)"></textarea>
            </div>
            
            ${isLive ? `
            <div class="flex flex-col sm:flex-row gap-2 mt-6">
                <button onclick="Teacher.createExam(false)" class="flex-1 bg-slate-800 dark:bg-dark-tertiary text-white py-4 rounded-xl font-bold shadow hover:bg-slate-900 dark:hover:bg-black transition">Publish Now</button>
                <button onclick="Teacher.createExam(true)" class="flex-1 bg-amber-500 text-white py-4 rounded-xl font-bold shadow hover:bg-amber-600 transition">Save to Library (Draft)</button>
            </div>` : `
            <button onclick="Teacher.createExam(false)" class="w-full bg-slate-800 dark:bg-dark-tertiary text-white py-4 rounded-xl font-bold shadow hover:bg-slate-900 dark:hover:bg-black transition mt-6">Publish Practice</button>`}
        </div>
    </div>`;
    
    Teacher.switchQuestionMode('manual');
    
    setTimeout(() => {
        document.querySelectorAll('.auto-resize').forEach(textarea => {
            autoResizeTextarea(textarea);
        });
    }, 100);
    
    const subjectSelect = document.getElementById('nsub');
    const chapterSelect = document.getElementById('nchap');
    
    subjectSelect.addEventListener('change', function() {
        const subject = this.value;
        
        chapterSelect.innerHTML = '<option value="">Select Chapter (Optional)</option>';
        
        if (subject) {
            const subjectFolder = folderStructure[type].find(s => s.name === subject);
            const chaptersFromFolders = subjectFolder ? subjectFolder.children.map(c => c.name) : [];
            
            const chaptersFromExams = [...new Set(Object.values(ExamCache)
                .filter(e => e.type === type && e.subject === subject && e.chapter)
                .map(e => e.chapter))];
            
            const allChapters = [...new Set([...chaptersFromFolders, ...chaptersFromExams])];
            
            allChapters.forEach(chapter => {
                const option = document.createElement('option');
                option.value = chapter;
                option.textContent = chapter;
                chapterSelect.appendChild(option);
            });
        }
    });
    
    const savedSubject = localStorage.getItem(`lastSubject_${type}`);
    if (savedSubject && subjects.includes(savedSubject)) {
        subjectSelect.value = savedSubject;
        subjectSelect.dispatchEvent(new Event('change'));
    }
};

// ------------- Question Mode Switching & JSON Helpers -------------
Teacher.switchQuestionMode = function(mode) {
    window.questionMode = mode;
    if(mode === 'manual') {
        document.getElementById('manual-questions-container').classList.remove('hidden');
        document.getElementById('json-container').classList.add('hidden');
        document.getElementById('mode-manual').className = "px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg";
        document.getElementById('mode-json').className = "px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg";
        
        try {
            const jsonText = document.getElementById('nq').value;
            if(jsonText.trim()) {
                Teacher.questions = JSON.parse(jsonText);
                Teacher.updateQuestionsList();
            }
        } catch(e) {
            console.error("JSON parse error:", e);
        }
    } else {
        document.getElementById('manual-questions-container').classList.add('hidden');
        document.getElementById('json-container').classList.remove('hidden');
        document.getElementById('mode-manual').className = "px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg";
        document.getElementById('mode-json').className = "px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg";
        
        if(Teacher.questions.length > 0) {
            document.getElementById('nq').value = JSON.stringify(Teacher.questions, null, 2);
            autoResizeTextarea(document.getElementById('nq'));
        }
    }
};

Teacher.copyJson = function() {
    const jsonTextarea = document.getElementById('nq');
    jsonTextarea.select();
    document.execCommand('copy');
    Swal.fire('Copied!', 'JSON copied to clipboard', 'success');
};

Teacher.clearJson = function() {
    document.getElementById('nq').value = '';
    autoResizeTextarea(document.getElementById('nq'));
};

// ------------- Question Management -------------
Teacher.addQuestionToList = () => {
    const questionText = document.getElementById('textarea-question').value;
    const optionA = document.getElementById('option-a').value;
    const optionB = document.getElementById('option-b').value;
    const optionC = document.getElementById('option-c').value;
    const optionD = document.getElementById('option-d').value;
    const correctAnswer = document.getElementById('correct-answer').value;
    const explanation = document.getElementById('explanation').value;
    const previousYear = document.getElementById('previous-year').value;
    const showPreviousYear = document.getElementById('show-previous-year').checked;
    
    if(!questionText || !optionA || !optionB || !optionC || !optionD || correctAnswer === '') {
        Swal.fire('Error', 'Please fill all required fields', 'error');
        return;
    }
    
    const question = {
        q: questionText,
        options: [optionA, optionB, optionC, optionD],
        correct: parseInt(correctAnswer),
        expl: explanation || "",
        previousYear: previousYear || "",
        showPreviousYearInQuestion: showPreviousYear
    };
    
    if (Teacher.currentQuestion !== null) {
        Teacher.questions[Teacher.currentQuestion] = question;
        Teacher.currentQuestion = null;
        
        document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-plus mr-2"></i> Add Question to List';
        document.getElementById('add-question-btn').onclick = () => Teacher.addQuestionToList();
        document.getElementById('question-form-title').innerText = 'Add New Question';
    } else {
        Teacher.questions.push(question);
    }
    
    document.getElementById('textarea-question').value = '';
    document.getElementById('option-a').value = '';
    document.getElementById('option-b').value = '';
    document.getElementById('option-c').value = '';
    document.getElementById('option-d').value = '';
    document.getElementById('correct-answer').value = '';
    document.getElementById('explanation').value = '';
    document.getElementById('previous-year').value = '';
    document.getElementById('show-previous-year').checked = false;
    
    document.querySelectorAll('.auto-resize').forEach(textarea => {
        textarea.style.height = 'auto';
    });
    
    Teacher.updateQuestionsList();
    
    document.querySelectorAll('.math-render-overlay').forEach(overlay => {
        overlay.style.display = 'none';
    });
    document.querySelectorAll('.question-textarea, .option-textarea, .explanation-textarea').forEach(textarea => {
        textarea.classList.remove('math-mode');
    });
    document.querySelectorAll('.math-preview-btn').forEach(btn => {
        btn.innerHTML = '<i class="fas fa-eye"></i>';
    });
    
    document.getElementById('textarea-question').focus();
};

Teacher.updateQuestionsList = () => {
    const questionsList = document.getElementById('questions-list');
    if (!questionsList) return;
    
    if (Teacher.questions.length === 0) {
        questionsList.innerHTML = `
            <h3 class="font-bold text-lg mb-2 dark:text-white">Questions List (${Teacher.questions.length})</h3>
            <div class="text-center p-4 text-slate-400">No questions added yet</div>
        `;
        return;
    }
    
    questionsList.innerHTML = `
        <h3 class="font-bold text-lg mb-2 dark:text-white">Questions List (${Teacher.questions.length})</h3>
        ${Teacher.questions.map((q, index) => {
            const questionPreview = window.MathHelper.renderExamContent(q.q.substring(0, 100) + (q.q.length > 100 ? '...' : ''));
            return `
            <div class="question-list-item dark:bg-black dark:border-dark-tertiary">
                <div class="flex justify-between items-start mb-2">
                    <div class="question-text truncate dark:text-white">${index + 1}. ${questionPreview}</div>
                    <div class="flex gap-2">
                        <button onclick="Teacher.editQuestion(${index})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="Teacher.deleteQuestion(${index})" class="text-red-600 hover:text-red-800 dark:text-red-400">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="options dark:text-slate-300">
                    A. ${window.MathHelper.renderExamContent(q.options[0].substring(0, 50) + (q.options[0].length > 50 ? '...' : ''))}<br>
                    B. ${window.MathHelper.renderExamContent(q.options[1].substring(0, 50) + (q.options[1].length > 50 ? '...' : ''))}<br>
                    C. ${window.MathHelper.renderExamContent(q.options[2].substring(0, 50) + (q.options[2].length > 50 ? '...' : ''))}<br>
                    D. ${window.MathHelper.renderExamContent(q.options[3].substring(0, 50) + (q.options[3].length > 50 ? '...' : ''))}
                </div>
                <div class="correct-answer dark:text-emerald-400">
                    Correct: ${String.fromCharCode(65 + q.correct)}
                </div>
            </div>
        `}).join('')}
    `;
    window.loadMathJax(null, questionsList);
};

Teacher.editQuestion = (index) => {
    const q = Teacher.questions[index];
    
    document.getElementById('textarea-question').value = q.q;
    document.getElementById('option-a').value = q.options[0];
    document.getElementById('option-b').value = q.options[1];
    document.getElementById('option-c').value = q.options[2];
    document.getElementById('option-d').value = q.options[3];
    document.getElementById('correct-answer').value = q.correct;
    document.getElementById('explanation').value = q.expl || '';
    document.getElementById('previous-year').value = q.previousYear || '';
    document.getElementById('show-previous-year').checked = q.showPreviousYearInQuestion || false;
    
    Teacher.currentQuestion = index;
    
    document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-save mr-2"></i> Update Question';
    document.getElementById('add-question-btn').onclick = () => Teacher.addQuestionToList();
    document.getElementById('question-form-title').innerText = `Edit Question ${index + 1}`;
    
    document.getElementById('textarea-question').focus();
    window.scrollTo({
        top: document.querySelector('.question-box').offsetTop - 20,
        behavior: 'smooth'
    });
    
    setTimeout(() => {
        document.querySelectorAll('.auto-resize').forEach(textarea => {
            autoResizeTextarea(textarea);
        });
    }, 50);
};

Teacher.deleteQuestion = (index) => {
    Swal.fire({
        title: 'Delete Question?',
        text: "This action cannot be undone!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Delete'
    }).then((result) => {
        if (result.isConfirmed) {
            Teacher.questions.splice(index, 1);
            Teacher.updateQuestionsList();
            
            if (Teacher.currentQuestion === index) {
                Teacher.currentQuestion = null;
                document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-plus mr-2"></i> Add Question to List';
                document.getElementById('question-form-title').innerText = 'Add New Question';
            }
        }
    });
};

// ------------- Exam Creation & Update -------------
Teacher.createExam = async (isDraft = false) => {
    const confirmText = isDraft ? 'Save to Library as Draft' : 'Publish Exam';
    const confirmMessage = isDraft ? 
        'Are you sure you want to save this exam as draft?' : 
        'Are you sure you want to publish this exam?';
    
    const confirm = await Swal.fire({
        title: confirmText,
        text: confirmMessage,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Yes, ${confirmText}`
    });

    if(!confirm.isConfirmed) return;
    
    const loadingSwal = Swal.fire({
        title: isDraft ? 'Saving Draft...' : 'Publishing Exam...',
        text: 'Please wait...',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        const t = document.getElementById('nt').value;
        const type = document.getElementById('nty').value;
        const d = document.getElementById('nd').value;
        const m = document.getElementById('nm').value;
        const neg = document.getElementById('nneg').value;
        const sub = document.getElementById('nsub').value;
        const chap = document.getElementById('nchap').value;
        const autoPublish = document.getElementById('nautopub') ? document.getElementById('nautopub').checked : false;
        
        if(!t || !d || !m) throw new Error("Title, Duration, and Marks are required");
        
        let questions = '';
        
        if(window.questionMode === 'manual') {
            if(Teacher.questions.length === 0) {
                Swal.close();
                throw new Error("Please add at least one question");
            }
            questions = JSON.stringify(Teacher.questions);
        } else {
            questions = document.getElementById('nq').value;
            JSON.parse(questions);
        }
        
        let st = null, et = null;
        if(type === 'live') {
            st = document.getElementById('nst').value;
            et = document.getElementById('net').value;
            if(!st || !et) {
                Swal.close();
                throw new Error("Start and End time required for Live exams");
            }
        }
        
        const examData = {
            title: t,
            type: type,
            subject: sub || '',
            chapter: chap || '',
            duration: parseInt(d),
            totalMarks: parseInt(m),
            negativeMark: parseFloat(neg),
            questions: questions,
            startTime: st,
            endTime: et,
            autoPublish: autoPublish,
            isDraft: isDraft,
            createdBy: AppState.currentUser.id,
            teacherCode: AppState.currentUser.teacherCode,
            resultPublished: isDraft ? false : (type === 'mock'),
            groupId: AppState.selectedGroup.id,
            groupName: AppState.selectedGroup.name,
            createdAt: new Date(),
            cancelled: false
        };
        
        if (!navigator.onLine) {
            Swal.close();
            const tempId = 'local_' + Date.now();
            examData.localId = tempId;
            
            await TeacherOffline.saveExamOffline(examData);
            
            if (sub && chap) {
                const folderType = type === 'live' ? 'live' : 'mock';
                
                let subject = folderStructure[folderType].find(s => s.name === sub);
                if (!subject) {
                    subject = {
                        id: `subject-${sub}-${folderType}-${Date.now()}`,
                        name: sub,
                        type: 'subject',
                        examType: folderType,
                        children: [],
                        exams: []
                    };
                    folderStructure[folderType].push(subject);
                }
                
                let chapter = subject.children.find(c => c.name === chap);
                if (!chapter) {
                    chapter = {
                        id: `chapter-${chap}-${subject.id}-${Date.now()}`,
                        name: chap,
                        type: 'chapter',
                        parent: subject.id,
                        children: [],
                        exams: []
                    };
                    subject.children.push(chapter);
                }
                
                chapter.exams.push({
                    id: tempId,
                    name: t,
                    type: 'exam',
                    examType: type,
                    parent: chapter.id,
                    examData: examData
                });
            } else {
                if(!folderStructure.uncategorized) folderStructure.uncategorized = [];
                folderStructure.uncategorized.push({
                    id: tempId,
                    name: t,
                    examType: type,
                    examData: examData
                });
            }
            localStorage.setItem('offlineFolderStructure_' + AppState.selectedGroup.id, JSON.stringify(folderStructure));
            
            Teacher.questions = [];
            Teacher.currentQuestion = null;
            document.getElementById('floating-math-btn').classList.add('hidden');
            document.getElementById('math-symbols-panel').classList.remove('show');
            
            Swal.fire({
                title: 'অফলাইন মোড',
                text: 'পরীক্ষাটি ড্রাফট হিসেবে আপনার ডিভাইসে সংরক্ষিত হয়েছে। ইন্টারনেট সংযোগ পেলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।',
                icon: 'info',
                confirmButtonText: 'ঠিক আছে'
            }).then(() => {
                if (isDraft) {
                    Teacher.foldersView();
                } else {
                    Teacher.createView();
                }
            });
            return;
        }
        
        const docRef = await addDoc(collection(db, "exams"), examData);
        
        if (sub) {
            localStorage.setItem(`lastSubject_${type}`, sub);
        }
        
        if (sub && chap) {
            const folderType = type === 'live' ? 'live' : 'mock';
            
            let subject = folderStructure[folderType].find(s => s.name === sub);
            if (!subject) {
                subject = {
                    id: `subject-${sub}-${folderType}-${Date.now()}`,
                    name: sub,
                    type: 'subject',
                    examType: folderType,
                    children: [],
                    exams: []
                };
                folderStructure[folderType].push(subject);
            }
            
            let chapter = subject.children.find(c => c.name === chap);
            if (!chapter) {
                chapter = {
                    id: `chapter-${chap}-${subject.id}-${Date.now()}`,
                    name: chap,
                    type: 'chapter',
                    parent: subject.id,
                    children: [],
                    exams: []
                };
                subject.children.push(chapter);
            }
            
            chapter.exams.push({
                id: docRef.id,
                name: t,
                type: 'exam',
                examType: type,
                parent: chapter.id,
                examData: examData
            });
        } else {
            if(!folderStructure.uncategorized) folderStructure.uncategorized = [];
            folderStructure.uncategorized.push({
                id: docRef.id,
                name: t,
                examType: type,
                examData: examData
            });
        }
        
        await saveFolderStructureToFirebase();
        
        Teacher.questions = [];
        Teacher.currentQuestion = null;
        
        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
        Swal.close();
        
        Swal.fire('Success', isDraft ? 'Exam saved to Library as draft' : 'Exam published successfully', 'success').then(() => {
            if (isDraft) {
                Teacher.foldersView();
            } else {
                Teacher.createView();
            }
        });
    } catch(e) {
        Swal.close();
        Swal.fire('Error', e.message, 'error');
    }
};

Teacher.updateExistingExam = async function(examId) {
    try {
        const t = document.getElementById('nt').value;
        const d = document.getElementById('nd').value;
        const m = document.getElementById('nm').value;
        const neg = document.getElementById('nneg').value;
        const sub = document.getElementById('nsub').value;
        const chap = document.getElementById('nchap').value;
        const autoPublish = document.getElementById('nautopub') ? document.getElementById('nautopub').checked : false;
        
        let questions = '';
        
        if(window.questionMode === 'manual') {
            if(Teacher.questions.length === 0) {
                throw new Error("Please add at least one question");
            }
            questions = JSON.stringify(Teacher.questions);
        } else {
            questions = document.getElementById('nq').value;
            JSON.parse(questions);
        }
        
        const exam = ExamCache[examId];
        const updateData = {
            title: t,
            subject: sub || '',
            chapter: chap || '',
            duration: parseInt(d),
            totalMarks: parseInt(m),
            negativeMark: parseFloat(neg),
            questions: questions,
            updatedAt: new Date()
        };
        
        if (exam.type === 'live') {
            updateData.startTime = document.getElementById('nst').value;
            updateData.endTime = document.getElementById('net').value;
            updateData.autoPublish = autoPublish;
            updateData.resultPublished = exam.resultPublished || autoPublish;
        }
        
        if (!navigator.onLine) {
            await TeacherOffline.saveExamOffline({ ...updateData, id: examId });
            if (ExamCache[examId]) {
                Object.assign(ExamCache[examId], updateData);
            }
            Teacher.questions = [];
            Teacher.currentQuestion = null;
            document.getElementById('floating-math-btn').classList.add('hidden');
            document.getElementById('math-symbols-panel').classList.remove('show');
            
            Swal.fire({
                title: 'অফলাইন মোড',
                text: 'পরীক্ষার পরিবর্তনগুলো স্থানীয়ভাবে সংরক্ষিত হয়েছে। অনলাইনে এলে স্বয়ংক্রিয়ভাবে আপডেট হবে।',
                icon: 'info',
                confirmButtonText: 'ঠিক আছে'
            }).then(() => {
                Teacher.foldersView();
            });
            return;
        }
        
        await updateDoc(doc(db, "exams", examId), updateData);
        
        await Teacher.syncFolderExamData(examId, updateData);
        
        Teacher.questions = [];
        Teacher.currentQuestion = null;
        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
        Swal.fire('Success', 'Exam updated successfully', 'success').then(() => {
            Teacher.foldersView();
        });
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
};
