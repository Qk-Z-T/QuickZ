// js/teacher/library.js
// Library Management (Folder Tree, Subjects, Chapters, View/Edit/Delete Exams)
// English version with MathHelper support

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

// ------------- Folders View -------------
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
            <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white">Library Management</h2>
        </div>
        
        <div class="text-center p-10">
            <div class="loader mx-auto"></div>
            <p class="mt-2 text-sm text-slate-500">Loading...</p>
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
                    <h2 class="text-xl font-bold font-en text-slate-800 dark:text-white">Library Management</h2>
                </div>
                
                <div class="flex flex-wrap gap-3 mb-6">
                    <button onclick="Teacher.createSubject('live')" class="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                        <i class="fas fa-plus"></i> Live Subject
                    </button>
                    <button onclick="Teacher.createSubject('mock')" class="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                        <i class="fas fa-plus"></i> Mock Subject
                    </button>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white">
                                <i class="fas fa-broadcast-tower live-icon"></i>
                                Live Exams
                            </h3>
                            <span class="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-1 rounded font-bold">
                                ${folderStructure.live.reduce((acc, s) => acc + s.exams.length, 0)} Exams
                            </span>
                        </div>
                        <div id="live-folder-tree" class="folder-tree space-y-1"></div>
                    </div>
                    
                    <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white">
                                <i class="fas fa-book-reader mock-icon"></i>
                                Mock Exams
                            </h3>
                            <span class="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 px-2 py-1 rounded font-bold">
                                ${folderStructure.mock.reduce((acc, s) => acc + s.exams.length, 0)} Exams
                            </span>
                        </div>
                        <div id="mock-folder-tree" class="folder-tree space-y-1"></div>
                    </div>
                </div>
                
                <div class="mt-6 bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-bold text-lg flex items-center gap-2 dark:text-white">
                            <i class="fas fa-question-circle text-slate-400"></i>
                            Uncategorized Exams
                        </h3>
                        <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded font-bold">
                            ${folderStructure.uncategorized.length} Exams
                        </span>
                    </div>
                    <div id="uncategorized-exams" class="space-y-2"></div>
                </div>
            </div>`;
            
            Teacher.renderFolderTree();
            Teacher.renderUncategorizedExams();
        } catch (error) {
            console.error('Error refreshing folder data:', error);
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
        return `<div class="text-center p-4 text-slate-400">
            <i class="fas fa-folder-open text-2xl mb-2 opacity-30"></i>
            <p>No ${type} subjects yet</p>
        </div>`;
    }
    
    return subjects.map(subject => {
        const subjectId = `subject-${subject.id}`;
        
        return `
        <div class="folder-item p-3 rounded-lg border border-slate-100 dark:border-dark-tertiary mb-2 dark:bg-black">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2 flex-1">
                    <i class="fas fa-folder folder-icon"></i>
                    <span class="font-bold dark:text-white">${subject.name}</span>
                    <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                        ${subject.children.length} Chapters
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
                            <div class="menu-item add-chapter dark:text-emerald-400" onclick="Teacher.addChapterToSubject('${subject.id}', '${type}')">
                                <i class="fas fa-plus-circle"></i>
                                Add Chapter
                            </div>
                            <div class="menu-item rename dark:text-purple-400" onclick="Teacher.renameItem('subject', '${subject.id}', '${subject.name}')">
                                <i class="fas fa-pencil-alt"></i>
                                Rename
                            </div>
                            <div class="menu-item delete dark:text-red-400" onclick="Teacher.deleteSubject('${subject.id}', '${type}')">
                                <i class="fas fa-trash"></i>
                                Delete
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
                                <span class="font-medium dark:text-white">${chapter.name}</span>
                                <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                                    ${chapter.exams.length} Exams
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
                                        <div class="menu-item add-exam dark:text-amber-400" onclick="Teacher.addExamToChapter('${subject.id}', '${chapter.id}', '${type}')">
                                            <i class="fas fa-plus"></i>
                                            Add Exam
                                        </div>
                                        <div class="menu-item rename dark:text-purple-400" onclick="Teacher.renameItem('chapter', '${chapter.id}', '${chapter.name}')">
                                            <i class="fas fa-pencil-alt"></i>
                                            Rename
                                        </div>
                                        <div class="menu-item delete dark:text-red-400" onclick="Teacher.deleteChapter('${chapter.id}', '${type}')">
                                            <i class="fas fa-trash"></i>
                                            Delete
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
                                let statusText = 'Draft';
                                
                                if (isCancelled) {
                                    statusClass = 'status-cancelled';
                                    statusText = 'Cancelled';
                                } else if (isPublished) {
                                    statusClass = 'status-ended';
                                    statusText = 'Ended';
                                } else if (startTime && endTime) {
                                    if (now < startTime) {
                                        statusClass = 'status-upcoming';
                                        statusText = 'Upcoming';
                                    } else if (now >= startTime && now <= endTime) {
                                        statusClass = 'status-ongoing';
                                        statusText = 'Ongoing';
                                    } else {
                                        statusClass = 'status-ended';
                                        statusText = 'Ended';
                                    }
                                } else if (isDraft) {
                                    statusClass = 'status-draft';
                                    statusText = 'Draft';
                                }
                                
                                return `
                                <div class="p-2 mt-2 bg-slate-50 dark:bg-black rounded border border-slate-100 dark:border-dark-tertiary">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2 flex-1">
                                            <i class="fas fa-file-alt ${type === 'live' ? 'live-icon' : 'exam-icon'}"></i>
                                            <div>
                                                <div class="font-medium text-sm dark:text-white">${exam.name}</div>
                                                <div class="flex items-center gap-2 mt-1">
                                                    <span class="text-xs ${statusClass} px-2 py-0.5 rounded">${statusText}</span>
                                                    <div class="text-xs text-slate-500 dark:text-slate-400">
                                                        ${moment(examData.createdAt?.toDate()).format('DD MMM, YYYY') || 'Unknown date'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="three-dot-menu relative">
                                            <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('exam-${exam.id}')">
                                                <i class="fas fa-ellipsis-v text-slate-400"></i>
                                            </button>
                                            <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-exam-${exam.id}">
                                                <div class="menu-item view dark:text-blue-400" onclick="Teacher.viewPaper('${exam.id}')">
                                                    <i class="fas fa-eye"></i>
                                                    View
                                                </div>
                                                <div class="menu-item edit dark:text-blue-400" onclick="Teacher.editExam('${exam.id}')">
                                                    <i class="fas fa-edit"></i>
                                                    Edit
                                                </div>
                                                ${type === 'live' && isDraft ? `
                                                <div class="menu-item take-exam dark:text-emerald-400" onclick="Teacher.takeExamNow('${exam.id}')">
                                                    <i class="fas fa-play"></i>
                                                    Take Exam
                                                </div>
                                                ` : ''}
                                                <div class="menu-item delete dark:text-red-400" onclick="Teacher.deleteExam('${exam.id}')">
                                                    <i class="fas fa-trash"></i>
                                                    Delete
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
        container.innerHTML = `<div class="text-center p-4 text-slate-400">All exams are organized in folders</div>`;
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
        let statusText = 'Draft';
        
        if (isCancelled) {
            statusClass = 'status-cancelled';
            statusText = 'Cancelled';
        } else if (isPublished) {
            statusClass = 'status-ended';
            statusText = 'Ended';
        } else if (startTime && endTime) {
            if (now < startTime) {
                statusClass = 'status-upcoming';
                statusText = 'Upcoming';
            } else if (now >= startTime && now <= endTime) {
                statusClass = 'status-ongoing';
                statusText = 'Ongoing';
            } else {
                statusClass = 'status-ended';
                statusText = 'Ended';
            }
        } else if (isDraft) {
            statusClass = 'status-draft';
            statusText = 'Draft';
        }
        
        return `
        <div class="p-3 bg-slate-50 dark:bg-black rounded-lg border border-slate-200 dark:border-dark-tertiary flex justify-between items-center">
            <div class="flex items-center gap-3">
                <i class="fas fa-file-alt ${exam.examType === 'live' ? 'live-icon' : 'exam-icon'}"></i>
                <div>
                    <div class="font-bold text-sm dark:text-white">${exam.name}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                        ${exam.examData.type} • ${moment(exam.examData.createdAt.toDate()).format('DD MMM, YYYY')}
                        • <span class="${statusClass}">${statusText}</span>
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <div class="three-dot-menu relative">
                    <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleThreeDotMenu('uncategorized-${exam.id}')">
                        <i class="fas fa-ellipsis-v text-slate-400"></i>
                    </button>
                    <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="menu-uncategorized-${exam.id}">
                        <div class="menu-item view dark:text-blue-400" onclick="Teacher.viewPaper('${exam.id}')">
                            <i class="fas fa-eye"></i>
                            View
                        </div>
                        <div class="menu-item edit dark:text-blue-400" onclick="Teacher.editExam('${exam.id}')">
                            <i class="fas fa-edit"></i>
                            Edit
                        </div>
                        ${exam.examType === 'live' && exam.examData.isDraft ? `
                        <div class="menu-item take-exam dark:text-emerald-400" onclick="Teacher.takeExamNow('${exam.id}')">
                            <i class="fas fa-play"></i>
                            Take Exam
                        </div>
                        ` : ''}
                        <div class="menu-item delete dark:text-red-400" onclick="Teacher.deleteExam('${exam.id}')">
                            <i class="fas fa-trash"></i>
                            Delete
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
};

Teacher.createSubject = async (type) => {
    const { value: subjectName } = await Swal.fire({
        title: `Create New ${type === 'live' ? 'Live' : 'Mock'} Subject`,
        input: 'text',
        inputLabel: 'Subject Name',
        inputPlaceholder: 'Enter subject name',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'You need to enter a subject name!';
            if (folderStructure[type].some(s => s.name === value)) {
                return 'Subject already exists!';
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
        
        Swal.fire('Success', 'Subject created successfully', 'success');
    }
};

Teacher.addChapterToSubject = async function(subjectId, type) {
    const subject = folderStructure[type].find(s => s.id === subjectId);
    if (!subject) return;
    
    const { value: chapterName } = await Swal.fire({
        title: `Add Chapter to ${subject.name}`,
        input: 'text',
        inputLabel: 'Chapter Name',
        inputPlaceholder: 'Enter chapter name',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'You need to enter a chapter name!';
            if (subject.children.some(c => c.name === value)) {
                return 'Chapter already exists!';
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
        
        Swal.fire('Success', 'Chapter added successfully', 'success');
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
        title: `Rename ${itemType}`,
        input: 'text',
        inputLabel: 'New Name',
        inputValue: currentName,
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'You need to enter a new name!';
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
            
            Swal.fire('Success', `${itemType} renamed to ${newName}`, 'success');
            Teacher.foldersView();
        }
    }
};

Teacher.deleteSubject = async function(subjectId, type) {
    const result = await Swal.fire({
        title: 'Delete Subject?',
        text: "This will delete all chapters and exams under this subject!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Delete Everything'
    });
    
    if (result.isConfirmed) {
        const subjectIndex = folderStructure[type].findIndex(s => s.id === subjectId);
        if (subjectIndex !== -1) {
            folderStructure[type].splice(subjectIndex, 1);
            
            await saveFolderStructureToFirebase();
            
            Teacher.renderFolderTree();
            Swal.fire('Deleted!', 'Subject and all contents deleted.', 'success');
        }
    }
};

Teacher.deleteChapter = async function(chapterId, type) {
    const result = await Swal.fire({
        title: 'Delete Chapter?',
        text: "This will delete all exams under this chapter!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Delete Everything'
    });
    
    if (result.isConfirmed) {
        for (const subject of folderStructure[type]) {
            const chapterIndex = subject.children.findIndex(c => c.id === chapterId);
            if (chapterIndex !== -1) {
                subject.children.splice(chapterIndex, 1);
                
                await saveFolderStructureToFirebase();
                
                Teacher.renderFolderTree();
                Swal.fire('Deleted!', 'Chapter and all exams deleted.', 'success');
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
            actionContainer.outerHTML = `<button onclick="Teacher.updateExistingExam('${examId}')" class="bg-indigo-600 text-white w-full py-4 rounded-xl font-bold shadow hover:bg-indigo-700 transition">Update Exam Details</button>`;
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
        title: 'Delete Exam?',
        text: "This will delete the exam and all associated attempts!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Delete Everything'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Deleting...',
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

            Swal.fire('Deleted!', 'Exam deleted from everywhere.', 'success');
            Teacher.foldersView();
        } catch (error) {
            Swal.fire('Error', 'Failed to delete: ' + error.message, 'error');
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
        title: 'Schedule Exam',
        html: `
        <div class="text-left">
            <label class="text-xs font-bold">Start Time</label>
            <input id="sw-st" type="datetime-local" class="swal2-input">
            <label class="text-xs font-bold">End Time</label>
            <input id="sw-et" type="datetime-local" class="swal2-input">
            ${hasRank ? `
            <div class="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p class="text-xs font-bold mb-2">Rank List Option:</p>
                <label class="flex items-center gap-2 text-xs mb-2">
                    <input type="radio" name="rank-opt" value="merge" checked>
                    Merge with existing ranking
                </label>
                <label class="flex items-center gap-2 text-xs">
                    <input type="radio" name="rank-opt" value="new">
                    Clear previous ranks and start new
                </label>
            </div>` : ''}
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'Confirm & Go Live',
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
            Swal.fire('Error', 'Time required', 'error');
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
            
            Swal.fire('Success', 'Exam is now LIVE', 'success').then(() => {
                Teacher.foldersView();
            });
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
};

Teacher.viewPaper = async (examId) => {
    const exam = ExamCache[examId];
    if (!exam) return;
    
    const questions = JSON.parse(exam.questions);
    
    let html = `
        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary max-w-3xl mx-auto">
            <h3 class="text-xl font-bold mb-4 text-center dark:text-white">${exam.title}</h3>
            <div class="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">
                ${exam.subject ? exam.subject : ''} ${exam.chapter ? '• ' + exam.chapter : ''}
                ${exam.isDraft ? '<span class="text-amber-600 ml-2">• Draft</span>' : ''}
                ${exam.cancelled ? '<span class="text-red-600 ml-2">• Cancelled</span>' : ''}
            </div>
    `;
    
    questions.forEach((q, index) => {
        const questionHTML = window.MathHelper.renderExamContent(q.q);
        
        html += `
            <div class="mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-black dark:border-dark-tertiary">
                <div class="flex justify-between items-start mb-3">
                    <span class="font-bold text-indigo-600 dark:text-indigo-400">Q${index + 1}</span>
                    ${q.previousYear && q.showPreviousYearInQuestion ? `<span class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-1 rounded">${q.previousYear}</span>` : ''}
                </div>
                <p class="font-medium mb-3 dark:text-white">${questionHTML}</p>
                <div class="space-y-2 mb-3">
                    ${q.options.map((option, optIndex) => {
                        const isCorrect = optIndex === q.correct;
                        const optionText = window.MathHelper.renderExamContent(option);
                        
                        return `
                            <div class="p-2 rounded border ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-700' : 'bg-white dark:bg-dark-secondary border-slate-200 dark:border-dark-tertiary'}">
                                <span class="font-bold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">${String.fromCharCode(65 + optIndex)}.</span>
                                <span class="${isCorrect ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'dark:text-slate-300'}">${optionText}</span>
                                ${isCorrect ? '<i class="fas fa-check float-right text-emerald-600 dark:text-emerald-400"></i>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                ${q.previousYear && !q.showPreviousYearInQuestion ? `
                    <div class="mt-3 p-3 bg-amber-50 dark:bg-amber-900 rounded border border-amber-200 dark:border-amber-800">
                        <span class="font-bold text-amber-700 dark:text-amber-300 text-sm">Previous Year:</span>
                        <p class="text-sm mt-1 dark:text-amber-200">${q.previousYear}</p>
                    </div>
                ` : ''}
                ${q.expl && q.expl.trim() !== "" ? `
                    <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-800">
                        <span class="font-bold text-blue-700 dark:text-blue-300 text-sm">Explanation:</span>
                        <p class="text-sm mt-1 dark:text-blue-200">${window.MathHelper.renderExamContent(q.expl)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += `</div>`;
    
    document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <button onclick="Teacher.foldersView()" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <i class="fas fa-arrow-left"></i> Back to Library
            </button>
            ${html}
        </div>
    `;
    
    window.loadMathJax(null, document.getElementById('app-container'));
};
