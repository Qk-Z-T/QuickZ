// js/teacher/exam-create.js
// পরীক্ষা তৈরি সংক্রান্ত সমস্ত ফিচার

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { autoResizeTextarea } from '../core/utils.js';
import { 
    collection, addDoc, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { saveFolderStructureToFirebase } from '../features/realtime-sync.js';

let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

// ------------- ক্রিয়েট ভিউ -------------
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
                <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">শিক্ষক ড্যাশবোর্ড</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text mt-1">পরীক্ষা তৈরি এবং পরিচালনা করুন</p>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <button onclick="Teacher.renderForm('live')" class="h-44 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-6 relative overflow-hidden shadow-lg transition hover:shadow-xl hover:-translate-y-1 text-left group">
                <div class="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4"><i class="fas fa-broadcast-tower text-2xl"></i></div>
                <h3 class="text-xl font-bold bengali-text">লাইভ পরীক্ষা তৈরি</h3>
                <p class="text-indigo-100 text-sm mt-1 bengali-text">নির্দিষ্ট সময়ের জন্য পরীক্ষা নির্ধারণ করুন।</p>
                <i class="fas fa-arrow-right absolute right-6 bottom-6 opacity-40 group-hover:opacity-80 transition"></i>
            </button>
            <button onclick="Teacher.renderForm('mock')" class="h-44 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 relative overflow-hidden shadow-lg transition hover:shadow-xl hover:-translate-y-1 text-left group">
                <div class="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4"><i class="fas fa-book-reader text-2xl"></i></div>
                <h3 class="text-xl font-bold bengali-text">প্র্যাকটিস তৈরি</h3>
                <p class="text-emerald-100 text-xs mt-1 bengali-text">বিষয় ও অধ্যায় ভিত্তিক মক টেস্ট।</p>
                <i class="fas fa-pencil-alt absolute right-6 top-1/2 -translate-y-1/2 text-6xl opacity-20 group-hover:scale-110 transition"></i>
            </button>
        </div>
    </div>`;
    
    document.getElementById('floating-math-btn').classList.add('hidden');
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
    <div class="p-0 max-w-4xl">
        <div class="flex justify-between items-center mb-4">
            <button onclick="Teacher.createView()" class="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bengali-text">
                <i class="fas fa-arrow-left"></i> ড্যাশবোর্ডে ফিরুন
            </button>
        </div>
        <h2 class="text-xl font-bold mb-4 font-en text-slate-800 dark:text-white bengali-text">${isLive ? 'লাইভ পরীক্ষা' : 'প্র্যাকটিস টেস্ট'} তৈরি করুন</h2>
        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary space-y-4">
            <input id="nt" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="পরীক্ষার শিরোনাম">
            <input type="hidden" id="nty" value="${type}"> 
            
            <div class="grid grid-cols-2 gap-3">
                <div class="select-container">
                    <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">বিষয়</label>
                    <select id="nsub" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" ${type === 'mock' ? 'required' : ''}>
                        <option value="">বিষয় নির্বাচন (ঐচ্ছিক)</option>
                        ${subjects.map(s => `<option value="${s}" class="bengali-text">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="select-container">
                    <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">অধ্যায়</label>
                    <select id="nchap" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" ${type === 'mock' ? 'required' : ''}>
                        <option value="">অধ্যায় নির্বাচন (ঐচ্ছিক)</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">সময় (মিনিট)</label>
                    <input id="nd" type="number" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="যেমনঃ ৬০" required>
                </div>
                <div>
                    <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">মোট নম্বর</label>
                    <input id="nm" type="number" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="যেমনঃ ১০০" required>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">নেগেটিভ মার্ক</label>
                    <select id="nneg" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text">
                        <option value="0" selected>০ (কোনো নেগেটিভ নয়)</option>
                        <option value="0.25">০.২৫ (¼ নম্বর)</option>
                        <option value="0.50">০.৫০ (½ নম্বর)</option>
                    </select>
                </div>
                <div class="flex items-center text-xs text-slate-500 bg-slate-50 dark:bg-dark-tertiary dark:text-slate-400 p-2 rounded border dark:border-dark-tertiary bengali-text">ধরণ: ${type.toUpperCase()}</div>
            </div>
            
            ${isLive ? `
            <div class="p-3 bg-indigo-50 dark:bg-indigo-900 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-3">
                <div>
                    <label class="text-sm font-bold text-indigo-800 dark:text-indigo-300 bengali-text">শুরুর সময়</label>
                    <input id="nst" type="datetime-local" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-lg text-sm">
                </div>
                <div>
                    <label class="text-sm font-bold text-indigo-800 dark:text-indigo-300 bengali-text">শেষ সময়</label>
                    <input id="net" type="datetime-local" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-lg text-sm">
                </div>
                <div class="auto-publish-container">
                    <input type="checkbox" id="nautopub" checked>
                    <label for="nautopub" class="text-sm font-bold text-slate-700 dark:text-slate-300 bengali-text">
                        পরীক্ষা শেষে স্বয়ংক্রিয়ভাবে ফলাফল প্রকাশ করুন
                    </label>
                </div>
            </div>` : ''}
            
            <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-bold text-slate-700 dark:text-white bengali-text">প্রশ্ন মোড:</label>
                <div class="flex items-center gap-2">
                    <button id="mode-manual" onclick="Teacher.switchQuestionMode('manual')" class="px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg bengali-text">ম্যানুয়াল</button>
                    <button id="mode-json" onclick="Teacher.switchQuestionMode('json')" class="px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg bengali-text">JSON</button>
                </div>
            </div>
            
            <div id="questions-list" class="space-y-3 mb-6">
                <h3 class="font-bold text-lg mb-2 dark:text-white bengali-text">প্রশ্ন তালিকা (${Teacher.questions.length})</h3>
                <div class="text-center p-4 text-slate-400 bengali-text">এখনো কোনো প্রশ্ন যোগ করা হয়নি</div>
            </div>
            
            <div id="manual-questions-container" class="space-y-4">
                <div class="question-box dark:bg-black dark:border-dark-tertiary">
                    <h3 class="font-bold text-lg mb-3 dark:text-white bengali-text" id="question-form-title">নতুন প্রশ্ন যোগ করুন</h3>
                    
                    <div class="question-field-container mb-3">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">প্রশ্ন</label>
                        <textarea id="textarea-question" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl question-textarea auto-resize bengali-text" rows="3" placeholder="প্রশ্ন লিখুন..." oninput="autoResizeTextarea(this)"></textarea>
                        <button type="button" class="math-preview-btn" data-target="textarea-question">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    
                    <div class="mb-3">
                        <label class="block text-sm font-bold mb-2 dark:text-white bengali-text">অপশন:</label>
                        <div class="space-y-2">
                            ${['A', 'B', 'C', 'D'].map((letter, index) => `
                                <div class="flex items-center gap-2">
                                    <span class="font-bold w-6 dark:text-white">${letter}.</span>
                                    <div class="question-field-container flex-1">
                                        <textarea id="option-${letter.toLowerCase()}" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded option-textarea auto-resize bengali-text" rows="2" placeholder="অপশন ${letter}" oninput="autoResizeTextarea(this)"></textarea>
                                        <button type="button" class="math-preview-btn" data-target="option-${letter.toLowerCase()}">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">সঠিক উত্তর</label>
                        <select id="correct-answer" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded bengali-text">
                            <option value="">সঠিক উত্তর নির্বাচন করুন</option>
                            <option value="0">A</option>
                            <option value="1">B</option>
                            <option value="2">C</option>
                            <option value="3">D</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">ব্যাখ্যা (ঐচ্ছিক)</label>
                        <div class="question-field-container">
                            <textarea id="explanation" class="w-full p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded explanation-textarea auto-resize bengali-text" rows="2" placeholder="এই প্রশ্নের ব্যাখ্যা লিখুন..." oninput="autoResizeTextarea(this)"></textarea>
                            <button type="button" class="math-preview-btn" data-target="explanation">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="block text-sm font-bold mb-1 dark:text-white bengali-text">পূর্ববর্তী বছর (ঐচ্ছিক)</label>
                        <div class="flex items-center gap-2">
                            <input type="text" id="previous-year" class="flex-1 p-2 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded bengali-text" placeholder="যেমনঃ ২০২০ এইচএসসি">
                            <div class="flex items-center gap-2">
                                <input type="checkbox" id="show-previous-year" class="rounded">
                                <label for="show-previous-year" class="text-sm font-medium text-slate-700 dark:text-slate-300 bengali-text">
                                    প্রশ্নে দেখান
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="Teacher.addQuestionToList()" id="add-question-btn" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition bengali-text">
                        <i class="fas fa-plus mr-2"></i> তালিকায় যোগ করুন
                    </button>
                </div>
            </div>
            
            <div id="json-container" class="hidden">
                <div class="json-actions">
                    <button onclick="Teacher.copyJson()" class="bg-indigo-600 text-white px-3 py-2 rounded text-sm font-bold bengali-text">
                        <i class="fas fa-copy mr-1"></i> JSON কপি
                    </button>
                    <button onclick="Teacher.clearJson()" class="bg-red-600 text-white px-3 py-2 rounded text-sm font-bold bengali-text">
                        <i class="fas fa-trash mr-1"></i> JSON ক্লিয়ার
                    </button>
                </div>
                <textarea id="nq" class="w-full h-40 p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl font-mono text-xs auto-resize" placeholder='JSON প্রশ্ন অ্যারে এখানে পেস্ট করুন...' oninput="autoResizeTextarea(this)"></textarea>
            </div>
            
            ${isLive ? `
            <div class="flex gap-2 mt-4">
                <button onclick="Teacher.createExam(false)" class="flex-1 bg-slate-800 dark:bg-dark-tertiary text-white py-4 rounded-xl font-bold shadow hover:bg-slate-900 dark:hover:bg-black transition bengali-text">এখনই প্রকাশ করুন</button>
                <button onclick="Teacher.createExam(true)" class="flex-1 bg-amber-500 text-white py-4 rounded-xl font-bold shadow hover:bg-amber-600 transition bengali-text">লাইব্রেরিতে সংরক্ষণ (ড্রাফট)</button>
            </div>` : `
            <button onclick="Teacher.createExam(false)" class="bg-slate-800 dark:bg-dark-tertiary text-white w-full py-4 rounded-xl font-bold shadow hover:bg-slate-900 dark:hover:bg-black transition bengali-text">প্রকাশ করুন</button>`}
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
        
        chapterSelect.innerHTML = '<option value="">অধ্যায় নির্বাচন (ঐচ্ছিক)</option>';
        
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
                option.className = 'bengali-text';
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

Teacher.switchQuestionMode = function(mode) {
    window.questionMode = mode;
    if(mode === 'manual') {
        document.getElementById('manual-questions-container').classList.remove('hidden');
        document.getElementById('json-container').classList.add('hidden');
        document.getElementById('mode-manual').className = "px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg bengali-text";
        document.getElementById('mode-json').className = "px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg bengali-text";
        
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
        document.getElementById('mode-manual').className = "px-3 py-1.5 text-sm font-bold bg-slate-200 dark:bg-dark-tertiary text-slate-600 dark:text-slate-300 rounded-lg bengali-text";
        document.getElementById('mode-json').className = "px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg bengali-text";
        
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
    Swal.fire('কপি হয়েছে!', 'JSON ক্লিপবোর্ডে কপি হয়েছে', 'success');
};

Teacher.clearJson = function() {
    document.getElementById('nq').value = '';
    autoResizeTextarea(document.getElementById('nq'));
};

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
        Swal.fire('ত্রুটি', 'সব প্রয়োজনীয় ঘর পূরণ করুন', 'error');
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
        
        document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-plus mr-2"></i> তালিকায় যোগ করুন';
        document.getElementById('add-question-btn').onclick = () => Teacher.addQuestionToList();
        document.getElementById('question-form-title').innerText = 'নতুন প্রশ্ন যোগ করুন';
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
            <h3 class="font-bold text-lg mb-2 dark:text-white bengali-text">প্রশ্ন তালিকা (${Teacher.questions.length})</h3>
            <div class="text-center p-4 text-slate-400 bengali-text">এখনো কোনো প্রশ্ন যোগ করা হয়নি</div>
        `;
        return;
    }
    
    questionsList.innerHTML = `
        <h3 class="font-bold text-lg mb-2 dark:text-white bengali-text">প্রশ্ন তালিকা (${Teacher.questions.length})</h3>
        ${Teacher.questions.map((q, index) => `
            <div class="question-list-item dark:bg-black dark:border-dark-tertiary">
                <div class="flex justify-between items-start mb-2">
                    <div class="question-text truncate dark:text-white bengali-text">${index + 1}. ${q.q.substring(0, 100)}${q.q.length > 100 ? '...' : ''}</div>
                    <div class="flex gap-2">
                        <button onclick="Teacher.editQuestion(${index})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="Teacher.deleteQuestion(${index})" class="text-red-600 hover:text-red-800 dark:text-red-400">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="options dark:text-slate-300 bengali-text">
                    A. ${q.options[0].substring(0, 50)}${q.options[0].length > 50 ? '...' : ''}<br>
                    B. ${q.options[1].substring(0, 50)}${q.options[1].length > 50 ? '...' : ''}<br>
                    C. ${q.options[2].substring(0, 50)}${q.options[2].length > 50 ? '...' : ''}<br>
                    D. ${q.options[3].substring(0, 50)}${q.options[3].length > 50 ? '...' : ''}
                </div>
                <div class="correct-answer dark:text-emerald-400 bengali-text">
                    সঠিক: ${String.fromCharCode(65 + q.correct)}
                </div>
            </div>
        `).join('')}
    `;
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
    
    document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-save mr-2"></i> প্রশ্ন আপডেট';
    document.getElementById('add-question-btn').onclick = () => Teacher.addQuestionToList();
    document.getElementById('question-form-title').innerText = `প্রশ্ন সম্পাদনা ${index + 1}`;
    
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
        title: 'প্রশ্ন মুছে ফেলবেন?',
        text: "এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'মুছে ফেলুন'
    }).then((result) => {
        if (result.isConfirmed) {
            Teacher.questions.splice(index, 1);
            Teacher.updateQuestionsList();
            
            if (Teacher.currentQuestion === index) {
                Teacher.currentQuestion = null;
                document.getElementById('add-question-btn').innerHTML = '<i class="fas fa-plus mr-2"></i> তালিকায় যোগ করুন';
                document.getElementById('question-form-title').innerText = 'নতুন প্রশ্ন যোগ করুন';
            }
        }
    });
};

Teacher.createExam = async (isDraft = false) => {
    const confirmText = isDraft ? 'লাইব্রেরিতে ড্রাফট হিসেবে সংরক্ষণ' : 'পরীক্ষা প্রকাশ';
    const confirmMessage = isDraft ? 
        'আপনি কি এই পরীক্ষাটি ড্রাফট হিসেবে লাইব্রেরিতে সংরক্ষণ করতে চান?' : 
        'আপনি কি এই পরীক্ষাটি প্রকাশ করতে চান?';
    
    const confirm = await Swal.fire({
        title: confirmText,
        text: confirmMessage,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `হ্যাঁ, ${confirmText}`
    });

    if(!confirm.isConfirmed) return;
    
    const loadingSwal = Swal.fire({
        title: isDraft ? 'ড্রাফট সংরক্ষণ হচ্ছে...' : 'পরীক্ষা প্রকাশ হচ্ছে...',
        text: 'অনুগ্রহ করে অপেক্ষা করুন...',
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
        
        if(!t || !d || !m) throw new Error("শিরোনাম, সময় এবং নম্বর আবশ্যক");
        
        let questions = '';
        
        if(window.questionMode === 'manual') {
            if(Teacher.questions.length === 0) {
                Swal.close();
                throw new Error("অনুগ্রহ করে অন্তত একটি প্রশ্ন যোগ করুন");
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
                throw new Error("লাইভ পরীক্ষার জন্য শুরু ও শেষ সময় আবশ্যক");
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
        
        Swal.fire('সফল', isDraft ? 'পরীক্ষা লাইব্রেরিতে ড্রাফট হিসেবে সংরক্ষিত হয়েছে' : 'পরীক্ষা সফলভাবে প্রকাশিত হয়েছে', 'success').then(() => {
            if (isDraft) {
                Teacher.foldersView();
            } else {
                Teacher.createView();
            }
        });
    } catch(e) {
        Swal.close();
        Swal.fire('ত্রুটি', e.message, 'error');
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
                throw new Error("অনুগ্রহ করে অন্তত একটি প্রশ্ন যোগ করুন");
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
        
        await updateDoc(doc(db, "exams", examId), updateData);
        
        await Teacher.syncFolderExamData(examId, updateData);
        
        Teacher.questions = [];
        Teacher.currentQuestion = null;
        document.getElementById('floating-math-btn').classList.add('hidden');
        document.getElementById('math-symbols-panel').classList.remove('show');
        
        Swal.fire('সফল', 'পরীক্ষা সফলভাবে আপডেট হয়েছে', 'success').then(() => {
            Teacher.foldersView();
        });
    } catch(e) {
        Swal.fire('ত্রুটি', e.message, 'error');
    }
};
