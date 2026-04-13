// js/teacher/library.js
// লাইব্রেরি ব্যবস্থাপনা (ফোল্ডার ট্রি, সাবজেক্ট, চ্যাপ্টার, পরীক্ষা দেখা/এডিট/ডিলিট)
// আপডেটেড: viewPaper ফাংশনে MathHelper ও loadMathJax ব্যবহার করা হয়েছে

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { autoResizeTextarea } from '../core/utils.js';
import { 
    collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { saveFolderStructureToFirebase, initRealTimeSync } from '../features/realtime-sync.js';

let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

// ------------- ফোল্ডার ভিউ -------------
Teacher.foldersView = () => {
    if (!AppState.selectedGroup) {
        Teacher.selectGroupView('folders');
        return;
    }
    
    document.getElementById('floating-math-btn').classList.add('hidden');
    document.getElementById('math-symbols-panel').classList.remove('show');
    
    document.getElementById('app-container').innerHTML = `
    <div class="pb-6">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">লাইব্রেরি ব্যবস্থাপনা</h2>
        </div>
        
        <div class="text-center p-10">
            <div class="loader mx-auto"></div>
            <p class="mt-2 text-sm text-slate-500 bengali-text">লোড হচ্ছে...</p>
        </div>
    </div>`;
    
    initRealTimeSync();
    
    const refreshFolderData = async () => {
        try {
            const folderDocRef = doc(db, "folderStructures", `${AppState.currentUser.id}_${AppState.selectedGroup.id}`);
            const docSnap = await getDoc(folderDocRef);
            if (docSnap.exists()) {
                folderStructure = docSnap.data();
            } else {
                folderStructure = { live: [], mock: [], uncategorized: [] };
            }
            
            document.getElementById('app-container').innerHTML = `
            <div class="pb-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl font-bold font-en text-slate-800 dark:text-white bengali-text">লাইব্রেরি ব্যবস্থাপনা</h2>
                </div>
                
                <div class="flex flex-wrap gap-3 mb-6">
                    <button onclick="Teacher.createSubject('live')" class="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bengali-text">
                        <i class="fas fa-plus"></i> লাইভ বিষয়
                    </button>
                    <button onclick="Teacher.createSubject('mock')" class="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 bengali-text">
                        <i class="fas fa-plus"></i> মক বিষয়
                    </button>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white bengali-text">
                                <i class="fas fa-broadcast-tower live-icon"></i>
                                লাইভ পরীক্ষা
                            </h3>
                            <span class="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-1 rounded font-bold">
                                ${folderStructure.live.reduce((acc, s) => acc + s.exams.length, 0)} পরীক্ষা
                            </span>
                        </div>
                        <div id="live-folder-tree" class="folder-tree space-y-1"></div>
                    </div>
                    
                    <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white bengali-text">
                                <i class="fas fa-book-reader mock-icon"></i>
                                মক পরীক্ষা
                            </h3>
                            <span class="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 px-2 py-1 rounded font-bold">
                                ${folderStructure.mock.reduce((acc, s) => acc + s.exams.length, 0)} পরীক্ষা
                            </span>
                        </div>
                        <div id="mock-folder-tree" class="folder-tree space-y-1"></div>
                    </div>
                </div>
                
                <div class="mt-6 bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white bengali-text">
                            <i class="fas fa-question-circle text-slate-400"></i>
                            অশ্রেণীবদ্ধ পরীক্ষা
                        </h3>
                        <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded font-bold">
                            ${folderStructure.uncategorized.length} পরীক্ষা
                        </span>
                    </div>
                    <div id="uncategorized-exams" class="space-y-2"></div>
                </div>
            </div>`;
            
            Teacher.renderFolderTree();
            Teacher.renderUncategorizedExams();
        } catch (error) {
            console.error('ফোল্ডার ডেটা রিফ্রেশ করতে ত্রুটি:', error);
        }
    };
    
    refreshFolderData();
};

Teacher.renderFolderTree = () => {
    const liveTree = document.getElementById('live-folder-tree');
    if (liveTree) {
        liveTree.innerHTML = Teacher.renderFolderSection(folderStructure.live, 'live');
    }
    
    const mockTree = document.getElementById('mock-folder-tree');
    if (mockTree) {
        mockTree.innerHTML = Teacher.renderFolderSection(folderStructure.mock, 'mock');
    }
    
    document.querySelectorAll('.folder-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.folderId;
            Teacher.toggleFolder(id);
        });
    });
};

Teacher.renderFolderSection = (subjects, type) => {
    if (subjects.length === 0) {
        return `<div class="text-center p-4 text-slate-400 bengali-text">
            <i class="fas fa-folder-open text-2xl mb-2 opacity-30"></i>
            <p>এখনো কোনো ${type} বিষয় নেই</p>
        </div>`;
    }
    
    return subjects.map(subject => {
        const subjectId = `subject-${subject.id}`;
        
        return `
        <div class="folder-item p-3 rounded-lg border border-slate-100 dark:border-dark-tertiary mb-2 dark:bg-black">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2 flex-1">
                    <i class="fas fa-folder folder-icon"></i>
                    <span class="font-bold dark:text-white bengali-text">${subject.name}</span>
                    <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded bengali-text">
                        ${subject.children.length} অধ্যায়
                    </span>
                </div>
                <div class="flex items-center gap-1">
                    ${subject.children.length > 0 ? `
                    <button data-folder-id="${subjectId}" class="folder-toggle-btn text-slate-400 hover:text-slate-600 p-1">
                        <i class="fas fa-chevron-down" id="icon-${subjectId}"></i>
                    </button>
                    ` : ''}
                    <div class="three-dot-menu relative">
                        <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('subject-${subject.id}')">
                            <i class="fas fa-ellipsis-v text-slate-400"></i>
                        </button>
                        <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-subject-${subject.id}">
                            <div class="menu-item add-chapter dark:text-emerald-400 bengali-text" onclick="Teacher.addChapterToSubject('${subject.id}', '${type}')">
                                <i class="fas fa-plus-circle"></i>
                                অধ্যায় যোগ
                            </div>
                            <div class="menu-item rename dark:text-purple-400 bengali-text" onclick="Teacher.renameItem('subject', '${subject.id}', '${subject.name}')">
                                <i class="fas fa-pencil-alt"></i>
                                পুনঃনামকরণ
                            </div>
                            <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteSubject('${subject.id}', '${type}')">
                                <i class="fas fa-trash"></i>
                                মুছে ফেলুন
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ${subject.children.length > 0 ? `
            <div class="folder-children mt-2 hidden" id="children-${subjectId}">
                ${subject.children.map(chapter => {
                    const chapterId = `chapter-${chapter.id}`;
                    const hasExams = chapter.exams.length > 0;
                    
                    return `
                    <div class="ml-4 p-3 border-l-2 border-slate-200 dark:border-dark-tertiary">
                        <div class="flex justify-between items-center mb-2">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-folder-open text-slate-400"></i>
                                <span class="font-medium dark:text-white bengali-text">${chapter.name}</span>
                                <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded bengali-text">
                                    ${chapter.exams.length} পরীক্ষা
                                </span>
                            </div>
                            <div class="flex items-center gap-1">
                                ${hasExams ? `
                                <button data-folder-id="${chapterId}" class="folder-toggle-btn text-slate-400 hover:text-slate-600 p-1">
                                    <i class="fas fa-chevron-down" id="icon-${chapterId}"></i>
                                </button>
                                ` : ''}
                                <div class="three-dot-menu relative">
                                    <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('chapter-${chapter.id}')">
                                        <i class="fas fa-ellipsis-v text-slate-400"></i>
                                    </button>
                                    <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-chapter-${chapter.id}">
                                        <div class="menu-item add-exam dark:text-amber-400 bengali-text" onclick="Teacher.addExamToChapter('${subject.id}', '${chapter.id}', '${type}')">
                                            <i class="fas fa-plus"></i>
                                            পরীক্ষা যোগ
                                        </div>
                                        <div class="menu-item rename dark:text-purple-400 bengali-text" onclick="Teacher.renameItem('chapter', '${chapter.id}', '${chapter.name}')">
                                            <i class="fas fa-pencil-alt"></i>
                                            পুনঃনামকরণ
                                        </div>
                                        <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteChapter('${chapter.id}', '${type}')">
                                            <i class="fas fa-trash"></i>
                                            মুছে ফেলুন
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ${hasExams ? `
                        <div class="chapter-children ml-6 hidden" id="children-${chapterId}">
                            ${chapter.exams.map(exam => {
                                const examData = exam.examData || {};
                                const isDraft = examData.isDraft;
                                const isCancelled = examData.cancelled;
                                const isPublished = examData.resultPublished;
                                const now = new Date();
                                const startTime = examData.startTime ? new Date(examData.startTime) : null;
                                const endTime = examData.endTime ? new Date(examData.endTime) : null;
                                
                                let statusClass = 'status-draft';
                                let statusText = 'ড্রাফট';
                                
                                if (isCancelled) {
                                    statusClass = 'status-cancelled';
                                    statusText = 'বাতিল';
                                } else if (isPublished) {
                                    statusClass = 'status-ended';
                                    statusText = 'সমাপ্ত';
                                } else if (startTime && endTime) {
                                    if (now < startTime) {
                                        statusClass = 'status-upcoming';
                                        statusText = 'আসন্ন';
                                    } else if (now >= startTime && now <= endTime) {
                                        statusClass = 'status-ongoing';
                                        statusText = 'চলমান';
                                    } else {
                                        statusClass = 'status-ended';
                                        statusText = 'সমাপ্ত';
                                    }
                                } else if (isDraft) {
                                    statusClass = 'status-draft';
                                    statusText = 'ড্রাফট';
                                }
                                
                                return `
                                <div class="p-2 mt-2 bg-slate-50 dark:bg-black rounded border border-slate-100 dark:border-dark-tertiary">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2 flex-1">
                                            <i class="fas fa-file-alt ${type === 'live' ? 'live-icon' : 'exam-icon'}"></i>
                                            <div>
                                                <div class="font-medium text-sm dark:text-white bengali-text">${exam.name}</div>
                                                <div class="flex items-center gap-2 mt-1">
                                                    <span class="text-xs ${statusClass} px-2 py-0.5 rounded bengali-text">${statusText}</span>
                                                    <div class="text-xs text-slate-500 dark:text-slate-400">
                                                        ${moment(examData.createdAt?.toDate()).format('DD MMM, YYYY') || 'অজানা তারিখ'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="three-dot-menu relative">
                                            <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('exam-${exam.id}')">
                                                <i class="fas fa-ellipsis-v text-slate-400"></i>
                                            </button>
                                            <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-exam-${exam.id}">
                                                <div class="menu-item view dark:text-blue-400 bengali-text" onclick="Teacher.viewPaper('${exam.id}')">
                                                    <i class="fas fa-eye"></i>
                                                    দেখুন
                                                </div>
                                                <div class="menu-item edit dark:text-blue-400 bengali-text" onclick="Teacher.editExam('${exam.id}')">
                                                    <i class="fas fa-edit"></i>
                                                    সম্পাদনা
                                                </div>
                                                ${type === 'live' && isDraft ? `
                                                <div class="menu-item take-exam dark:text-emerald-400 bengali-text" onclick="Teacher.takeExamNow('${exam.id}')">
                                                    <i class="fas fa-play"></i>
                                                    এখনই নিন
                                                </div>
                                                ` : ''}
                                                <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteExam('${exam.id}')">
                                                    <i class="fas fa-trash"></i>
                                                    মুছে ফেলুন
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                        ` : ''}
                    </div>`;
                }).join('')}
            </div>
            ` : ''}
        </div>`;
    }).join('');
};

Teacher.toggleFolder = (id) => {
    const children = document.getElementById(`children-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    
    if (!children || !icon) return;
    
    if (children.classList.contains('hidden')) {
        children.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        children.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
};

Teacher.renderUncategorizedExams = () => {
    const container = document.getElementById('uncategorized-exams');
    if (!container) return;
    
    let uncategorizedList = folderStructure.uncategorized || [];
    
    if (uncategorizedList.length === 0) {
        container.innerHTML = `<div class="text-center p-4 text-slate-400 bengali-text">সব পরীক্ষা ফোল্ডারে সংগঠিত</div>`;
        return;
    }
    
    uncategorizedList.sort((a, b) => {
        const dateA = a.examData.createdAt?.seconds || 0;
        const dateB = b.examData.createdAt?.seconds || 0;
        return dateB - dateA;
    });
    
    container.innerHTML = uncategorizedList.map(exam => {
        const examData = exam.examData || {};
        const isDraft = examData.isDraft;
        const isCancelled = examData.cancelled;
        const isPublished = examData.resultPublished;
        const now = new Date();
        const startTime = examData.startTime ? new Date(examData.startTime) : null;
        const endTime = examData.endTime ? new Date(examData.endTime) : null;
        
        let statusClass = 'status-draft';
        let statusText = 'ড্রাফট';
        
        if (isCancelled) {
            statusClass = 'status-cancelled';
            statusText = 'বাতিল';
        } else if (isPublished) {
            statusClass = 'status-ended';
            statusText = 'সমাপ্ত';
        } else if (startTime && endTime) {
            if (now < startTime) {
                statusClass = 'status-upcoming';
                statusText = 'আসন্ন';
            } else if (now >= startTime && now <= endTime) {
                statusClass = 'status-ongoing';
                statusText = 'চলমান';
            } else {
                statusClass = 'status-ended';
                statusText = 'সমাপ্ত';
            }
        } else if (isDraft) {
            statusClass = 'status-draft';
            statusText = 'ড্রাফট';
        }
        
        return `
        <div class="p-3 bg-slate-50 dark:bg-black rounded-lg border border-slate-200 dark:border-dark-tertiary flex justify-between items-center">
            <div class="flex items-center gap-3">
                <i class="fas fa-file-alt ${exam.examType === 'live' ? 'live-icon' : 'exam-icon'}"></i>
                <div>
                    <div class="font-bold text-sm dark:text-white bengali-text">${exam.name}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 bengali-text">
                        ${exam.examData.type} • ${moment(exam.examData.createdAt.toDate()).format('DD MMM, YYYY')}
                        • <span class="${statusClass} bengali-text">${statusText}</span>
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <div class="three-dot-menu relative">
                    <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('uncategorized-${exam.id}')">
                        <i class="fas fa-ellipsis-v text-slate-400"></i>
                    </button>
                    <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-uncategorized-${exam.id}">
                        <div class="menu-item view dark:text-blue-400 bengali-text" onclick="Teacher.viewPaper('${exam.id}')">
                            <i class="fas fa-eye"></i>
                            দেখুন
                        </div>
                        <div class="menu-item edit dark:text-blue-400 bengali-text" onclick="Teacher.editExam('${exam.id}')">
                            <i class="fas fa-edit"></i>
                            সম্পাদনা
                        </div>
                        ${exam.examType === 'live' && exam.examData.isDraft ? `
                        <div class="menu-item take-exam dark:text-emerald-400 bengali-text" onclick="Teacher.takeExamNow('${exam.id}')">
                            <i class="fas fa-play"></i>
                            এখনই নিন
                        </div>
                        ` : ''}
                        <div class="menu-item delete dark:text-red-400 bengali-text" onclick="Teacher.deleteExam('${exam.id}')">
                            <i class="fas fa-trash"></i>
                            মুছে ফেলুন
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
};

Teacher.createSubject = async (type) => {
    const { value: subjectName } = await Swal.fire({
        title: `নতুন ${type === 'live' ? 'লাইভ' : 'মক'} বিষয় তৈরি`,
        input: 'text',
        inputLabel: 'বিষয়ের নাম',
        inputPlaceholder: 'বিষয়ের নাম লিখুন',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'বিষয়ের নাম দিতে হবে!';
            if (folderStructure[type].some(s => s.name === value)) {
                return 'এই বিষয়টি ইতিমধ্যে বিদ্যমান!';
            }
        }
    });
    
    if (subjectName) {
        const newSubject = {
            id: `subject-${Date.now()}`,
            name: subjectName,
            type: 'subject',
            examType: type,
            children: [],
            exams: []
        };
        
        folderStructure[type].push(newSubject);
        
        await saveFolderStructureToFirebase();
        
        Teacher.renderFolderTree();
        
        Swal.fire('সফল', 'বিষয় সফলভাবে তৈরি হয়েছে', 'success');
    }
};

Teacher.addChapterToSubject = async function(subjectId, type) {
    const subject = folderStructure[type].find(s => s.id === subjectId);
    if (!subject) return;
    
    const { value: chapterName } = await Swal.fire({
        title: `${subject.name} এ অধ্যায় যোগ করুন`,
        input: 'text',
        inputLabel: 'অধ্যায়ের নাম',
        inputPlaceholder: 'অধ্যায়ের নাম লিখুন',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'অধ্যায়ের নাম দিতে হবে!';
            if (subject.children.some(c => c.name === value)) {
                return 'এই অধ্যায়টি ইতিমধ্যে বিদ্যমান!';
            }
        }
    });
    
    if (chapterName) {
        const newChapter = {
            id: `chapter-${Date.now()}`,
            name: chapterName,
            type: 'chapter',
            parent: subject.id,
            children: [],
            exams: []
        };
        
        subject.children.push(newChapter);
        
        await saveFolderStructureToFirebase();
        
        Teacher.renderFolderTree();
        
        Swal.fire('সফল', 'অধ্যায় সফলভাবে যোগ করা হয়েছে', 'success');
    }
};

Teacher.addExamToChapter = function(subjectId, chapterId, type) {
    const subject = folderStructure[type].find(s => s.id === subjectId);
    if (!subject) return;
    
    const chapter = subject.children.find(c => c.id === chapterId);
    if (!chapter) return;
    
    Teacher.renderForm(type);
    
    setTimeout(() => {
        document.getElementById('nsub').value = subject.name;
        document.getElementById('nsub').dispatchEvent(new Event('change'));
        
        setTimeout(() => {
            document.getElementById('nchap').value = chapter.name;
        }, 100);
    }, 500);
};

Teacher.renameItem = async function(itemType, itemId, currentName) {
    const { value: newName } = await Swal.fire({
        title: `${itemType} পুনঃনামকরণ`,
        input: 'text',
        inputLabel: 'নতুন নাম',
        inputValue: currentName,
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'নতুন নাম দিতে হবে!';
        }
    });
    
    if (newName && newName !== currentName) {
        let found = false;
        
        for (const type of ['live', 'mock']) {
            if (itemType === 'subject') {
                const subject = folderStructure[type].find(s => s.id === itemId);
                if (subject) {
                    subject.name = newName;
                    found = true;
                    break;
                }
            } else if (itemType === 'chapter') {
                for (const subject of folderStructure[type]) {
                    const chapter = subject.children.find(c => c.id === itemId);
                    if (chapter) {
                        chapter.name = newName;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }
        
        if (found) {
            await saveFolderStructureToFirebase();
            
            Swal.fire('সফল', `${itemType} এর নাম পরিবর্তন করে ${newName} রাখা হয়েছে`, 'success');
            Teacher.foldersView();
        }
    }
};

Teacher.deleteSubject = async function(subjectId, type) {
    const result = await Swal.fire({
        title: 'বিষয় মুছে ফেলবেন?',
        text: "এটি এই বিষয়ের অধীনস্থ সকল অধ্যায় এবং পরীক্ষা মুছে ফেলবে!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'সবকিছু মুছে ফেলুন'
    });
    
    if (result.isConfirmed) {
        const subjectIndex = folderStructure[type].findIndex(s => s.id === subjectId);
        if (subjectIndex !== -1) {
            folderStructure[type].splice(subjectIndex, 1);
            
            await saveFolderStructureToFirebase();
            
            Teacher.renderFolderTree();
            Swal.fire('মুছে ফেলা হয়েছে!', 'বিষয় এবং এর সকল বিষয়বস্তু মুছে ফেলা হয়েছে।', 'success');
        }
    }
};

Teacher.deleteChapter = async function(chapterId, type) {
    const result = await Swal.fire({
        title: 'অধ্যায় মুছে ফেলবেন?',
        text: "এটি এই অধ্যায়ের অধীনস্থ সকল পরীক্ষা মুছে ফেলবে!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'সবকিছু মুছে ফেলুন'
    });
    
    if (result.isConfirmed) {
        for (const subject of folderStructure[type]) {
            const chapterIndex = subject.children.findIndex(c => c.id === chapterId);
            if (chapterIndex !== -1) {
                subject.children.splice(chapterIndex, 1);
                
                await saveFolderStructureToFirebase();
                
                Teacher.renderFolderTree();
                Swal.fire('মুছে ফেলা হয়েছে!', 'অধ্যায় এবং সকল পরীক্ষা মুছে ফেলা হয়েছে।', 'success');
                break;
            }
        }
    }
};

Teacher.editExam = async (examId) => {
    const exam = ExamCache[examId];
    if (!exam) return;
    
    Teacher.questions = [];
    Teacher.currentQuestion = null;
    Teacher.renderForm(exam.type);
    
    setTimeout(() => {
        document.getElementById('nt').value = exam.title;
        document.getElementById('nd').value = exam.duration;
        document.getElementById('nm').value = exam.totalMarks;
        document.getElementById('nneg').value = exam.negativeMark || 0;
        document.getElementById('nsub').value = exam.subject || '';
        document.getElementById('nsub').dispatchEvent(new Event('change'));
        
        setTimeout(() => {
            document.getElementById('nchap').value = exam.chapter || '';
        }, 100);
        
        if (exam.type === 'live') {
            document.getElementById('nst').value = exam.startTime || '';
            document.getElementById('net').value = exam.endTime || '';
            if (document.getElementById('nautopub')) {
                document.getElementById('nautopub').checked = exam.autoPublish || false;
            }
        }
        
        try {
            Teacher.questions = JSON.parse(exam.questions);
        } catch (e) {
            Teacher.questions = [];
        }
        
        Teacher.updateQuestionsList();
        
        const actionContainer = document.querySelector('.flex.gap-2.mt-4') || document.querySelector('button[onclick*="createExam"]');
        if(actionContainer) {
            actionContainer.outerHTML = `<button onclick="Teacher.updateExistingExam('${examId}')" class="bg-indigo-600 text-white w-full py-4 rounded-xl font-bold shadow hover:bg-indigo-700 transition bengali-text">পরীক্ষা আপডেট করুন</button>`;
        }
        
        setTimeout(() => {
            document.querySelectorAll('.auto-resize').forEach(textarea => {
                autoResizeTextarea(textarea);
            });
        }, 200);
    }, 500);
};

Teacher.deleteExam = async (examId) => {
    const result = await Swal.fire({
        title: 'পরীক্ষা মুছে ফেলবেন?',
        text: "এটি পরীক্ষা এবং সংশ্লিষ্ট সকল প্রচেষ্টা মুছে ফেলবে!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'সবকিছু মুছে ফেলুন'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'মুছে ফেলা হচ্ছে...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            await deleteDoc(doc(db, "exams", examId));

            const qAttempts = query(collection(db, "attempts"), where("examId", "==", examId));
            const snapAttempts = await getDocs(qAttempts);
            const batch = writeBatch(db);
            snapAttempts.forEach(d => batch.delete(d.ref));
            await batch.commit();

            for (const type of ['live', 'mock']) {
                folderStructure[type].forEach(sub => {
                    sub.children.forEach(chap => {
                        chap.exams = chap.exams.filter(e => e.id !== examId);
                    });
                });
            }

            folderStructure.uncategorized = (folderStructure.uncategorized || []).filter(e => e.id !== examId);

            await saveFolderStructureToFirebase();

            delete ExamCache[examId];

            Swal.fire('মুছে ফেলা হয়েছে!', 'পরীক্ষা সর্বত্র থেকে মুছে ফেলা হয়েছে।', 'success');
            Teacher.foldersView();
        } catch (error) {
            Swal.fire('ত্রুটি', 'মুছে ফেলতে ব্যর্থ: ' + error.message, 'error');
        }
    }
};

Teacher.takeExamNow = async (examId) => {
    const exam = ExamCache[examId];
    if (!exam) return;
    
    const rankQuery = query(collection(db, "attempts"), where("examId", "==", examId));
    const rankSnap = await getDocs(rankQuery);
    const hasRank = !rankSnap.empty;
    
    const { value: formValues } = await Swal.fire({
        title: 'পরীক্ষার সময়সূচী নির্ধারণ',
        html: `
        <div class="text-left">
            <label class="text-xs font-bold bengali-text">শুরুর সময়</label>
            <input id="sw-st" type="datetime-local" class="swal2-input">
            <label class="text-xs font-bold bengali-text">শেষ সময়</label>
            <input id="sw-et" type="datetime-local" class="swal2-input">
            ${hasRank ? `
            <div class="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p class="text-xs font-bold mb-2 bengali-text">র‍্যাংক তালিকা অপশন:</p>
                <label class="flex items-center gap-2 text-xs mb-2 bengali-text">
                    <input type="radio" name="rank-opt" value="merge" checked>
                    বিদ্যমান র‍্যাংকিংয়ে যুক্ত করুন
                </label>
                <label class="flex items-center gap-2 text-xs bengali-text">
                    <input type="radio" name="rank-opt" value="new">
                    আগের সব র‍্যাংক মুছে নতুন করুন
                </label>
            </div>` : ''}
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'নিশ্চিত করুন ও লাইভ করুন',
        preConfirm: () => {
            const rankOpt = document.querySelector('input[name="rank-opt"]:checked')?.value || 'new';
            return [
                document.getElementById('sw-st').value,
                document.getElementById('sw-et').value,
                rankOpt
            ];
        }
    });
    
    if (formValues) {
        const [startTime, endTime, rankOpt] = formValues;
        if (!startTime || !endTime) {
            Swal.fire('ত্রুটি', 'সময় আবশ্যক', 'error');
            return;
        }
        
        try {
            if (rankOpt === 'new' && hasRank) {
                const batch = writeBatch(db);
                rankSnap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            
            await updateDoc(doc(db, "exams", examId), {
                startTime: startTime,
                endTime: endTime,
                isDraft: false,
                cancelled: false,
                resultPublished: false,
                updatedAt: new Date()
            });
            
            await Teacher.syncFolderExamData(examId, { 
                isDraft: false, 
                resultPublished: false, 
                cancelled: false,
                startTime: startTime,
                endTime: endTime
            });
            
            Swal.fire('সফল', 'পরীক্ষা এখন লাইভ', 'success').then(() => {
                Teacher.foldersView();
            });
        } catch (e) {
            Swal.fire('ত্রুটি', e.message, 'error');
        }
    }
};

Teacher.viewPaper = async (examId) => {
    const exam = ExamCache[examId];
    if (!exam) return;
    
    const questions = JSON.parse(exam.questions);
    
    let html = `
        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary max-w-3xl mx-auto">
            <h3 class="text-xl font-bold mb-4 text-center dark:text-white bengali-text">${exam.title}</h3>
            <div class="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center bengali-text">
                ${exam.subject ? exam.subject : ''} ${exam.chapter ? '• ' + exam.chapter : ''}
                ${exam.isDraft ? '<span class="text-amber-600 ml-2 bengali-text">• ড্রাফট</span>' : ''}
                ${exam.cancelled ? '<span class="text-red-600 ml-2 bengali-text">• বাতিল</span>' : ''}
            </div>
    `;
    
    questions.forEach((q, index) => {
        const questionHTML = window.MathHelper.renderExamContent(q.q);
        
        html += `
            <div class="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-black dark:border-dark-tertiary">
                <div class="flex justify-between items-start mb-3">
                    <span class="font-bold text-indigo-600 dark:text-indigo-400 bengali-text">প্রশ্ন ${index + 1}</span>
                    ${q.previousYear && q.showPreviousYearInQuestion ? `<span class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-1 rounded bengali-text">${q.previousYear}</span>` : ''}
                </div>
                <p class="font-medium mb-3 dark:text-white">${questionHTML}</p>
                <div class="space-y-2 mb-3">
                    ${q.options.map((option, optIndex) => {
                        const isCorrect = optIndex === q.correct;
                        const optionText = window.MathHelper.renderExamContent(option);
                        
                        return `
                            <div class="p-2 rounded border ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-700' : 'bg-white dark:bg-dark-secondary border-slate-200 dark:border-dark-tertiary'}">
                                <span class="font-bold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'} bengali-text">${String.fromCharCode(65 + optIndex)}.</span>
                                <span class="${isCorrect ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'dark:text-slate-300'}">${optionText}</span>
                                ${isCorrect ? '<i class="fas fa-check float-right text-emerald-600 dark:text-emerald-400"></i>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                ${q.previousYear && !q.showPreviousYearInQuestion ? `
                    <div class="mt-3 p-3 bg-amber-50 dark:bg-amber-900 rounded border border-amber-200 dark:border-amber-800">
                        <span class="font-bold text-amber-700 dark:text-amber-300 text-sm bengali-text">পূর্ববর্তী বছর:</span>
                        <p class="text-sm mt-1 dark:text-amber-200 bengali-text">${q.previousYear}</p>
                    </div>
                ` : ''}
                ${q.expl && q.expl.trim() !== "" ? `
                    <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-800">
                        <span class="font-bold text-blue-700 dark:text-blue-300 text-sm bengali-text">ব্যাখ্যা:</span>
                        <p class="text-sm mt-1 dark:text-blue-200 bengali-text">${window.MathHelper.renderExamContent(q.expl)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += `</div>`;
    
    document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <button onclick="Teacher.foldersView()" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bengali-text">
                <i class="fas fa-arrow-left"></i> লাইব্রেরিতে ফিরুন
            </button>
            ${html}
        </div>
    `;
    
    window.loadMathJax(null, document.getElementById('app-container'));
};
