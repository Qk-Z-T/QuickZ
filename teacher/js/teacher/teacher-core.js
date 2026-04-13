// js/teacher/teacher-core.js
// Teacher object base structure, properties and common helper methods

import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, doc, getDoc, updateDoc, deleteDoc, 
    query, where, getDocs, writeBatch, addDoc, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { saveFolderStructureToFirebase, initRealTimeSync } from '../features/realtime-sync.js';

let folderStructure = window.folderStructure;
let ExamCache = window.ExamCache;

export const Teacher = {
    questions: [],
    currentQuestion: null,
    selectedFolder: null,
    teacherGroups: [],
    topScorerId: null,
    topAccuracyId: null,
    
    toggleMobileSidebar: function() {
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if (sidebar) sidebar.classList.toggle('mobile-open');
        if (overlay) overlay.classList.toggle('show');
    },
    
    closeMobileSidebar: function() {
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('show');
    },
    
    toggleGroupSwitcher: function() {
        const dropdown = document.getElementById('group-switcher-dropdown');
        if (dropdown) dropdown.classList.toggle('show');
    },
    
    copyGroupCode: function(groupCode) {
        navigator.clipboard.writeText(groupCode).then(() => {
            Swal.fire('Copied!', 'Course code copied to clipboard', 'success');
        }).catch(() => {
            Swal.fire('Error', 'Failed to copy code', 'error');
        });
    },
    
    loadGroupsForSwitcher: async function() {
        try {
            const groupsQuery = query(collection(db, "groups"), 
                where("teacherId", "==", AppState.currentUser.id),
                where("archived", "==", false),
                orderBy("createdAt", "desc"));
            const groupsSnap = await getDocs(groupsQuery);
            
            const groups = [];
            groupsSnap.forEach(doc => groups.push({ id: doc.id, ...doc.data() }));
            Teacher.teacherGroups = groups;
            
            if (!AppState.selectedGroup && groups.length > 0) {
                AppState.selectedGroup = { id: groups[0].id, name: groups[0].name };
                localStorage.setItem('selectedGroup', JSON.stringify(AppState.selectedGroup));
                initRealTimeSync();
            }

            if (AppState.selectedGroup) {
                const truncatedName = AppState.selectedGroup.name.length > 12 ? AppState.selectedGroup.name.substring(0, 12) + '...' : AppState.selectedGroup.name;
                document.getElementById('current-group-name').textContent = truncatedName;
            } else if (groups.length > 0) {
                document.getElementById('current-group-name').textContent = 'Select Course';
            }
            
            const dropdown = document.getElementById('group-switcher-dropdown');
            if (dropdown) {
                if (groups.length === 0) {
                    dropdown.innerHTML = '<div class="p-3 text-sm text-slate-500">No courses found</div>';
                    return;
                }
                
                let html = '';
                groups.forEach(group => {
                    const isActive = AppState.selectedGroup && AppState.selectedGroup.id === group.id;
                    html += `
                        <div class="group-switcher-item ${isActive ? 'active' : ''}" 
                             onclick="Teacher.switchGroup('${group.id}', '${group.name.replace(/'/g, "\\'")}')">
                            <div class="font-medium">${group.name}</div>
                            <div class="text-xs ${isActive ? 'text-indigo-100' : 'text-slate-500'} mt-1">
                                <div class="flex items-center justify-between">
                                    <span>${group.groupCode}</span>
                                    <button onclick="event.stopPropagation(); Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                        <i class="fas fa-copy text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                dropdown.innerHTML = html;
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    },
    
    switchGroup: async function(groupId, groupName) {
        AppState.selectedGroup = { id: groupId, name: groupName };
        localStorage.setItem('selectedGroup', JSON.stringify(AppState.selectedGroup));
        
        try {
            await updateDoc(doc(db, "teachers", AppState.currentUser.id), {
                lastGroupId: groupId,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('Error saving last group:', error);
        }
        
        const truncatedName = groupName.length > 12 ? groupName.substring(0, 12) + '...' : groupName;
        document.getElementById('current-group-name').textContent = truncatedName;
        document.getElementById('group-switcher-dropdown').classList.remove('show');
        
        Swal.fire({
            icon: 'success',
            title: 'Course Switched',
            text: `Now viewing: ${groupName}`,
            timer: 1500,
            showConfirmButton: false
        });
        
        initRealTimeSync();
        Router.teacher('home');
    },

    selectGroupView: async (page = 'home') => {
        try {
            const groupsQuery = query(collection(db, "groups"), 
                where("teacherId", "==", AppState.currentUser.id),
                where("archived", "==", false),
                orderBy("createdAt", "desc"));
            const groupsSnap = await getDocs(groupsQuery);
            
            const groups = [];
            groupsSnap.forEach(doc => groups.push({ id: doc.id, ...doc.data() }));
            
            if (groups.length === 0) {
                document.getElementById('app-container').innerHTML = `
                    <div class="p-0 max-w-2xl">
                        <div class="text-center mb-6">
                            <div class="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl mb-3 mx-auto">
                                <i class="fas fa-book"></i>
                            </div>
                            <h2 class="text-xl font-bold dark:text-white">No Course Found</h2>
                            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">You need to create a course first to continue</p>
                        </div>
                        
                        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary space-y-4">
                            <div>
                                <label class="block text-sm font-bold mb-1 dark:text-white">Course Name</label>
                                <input type="text" id="group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="e.g., Class 10 Batch-1">
                            </div>
                            
                            <button onclick="Teacher.createGroupFromInput()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg">
                                Create Course
                            </button>
                        </div>
                    </div>
                `;
                return;
            }
            
            let html = `
                <div class="p-5">
                    <h2 class="text-xl font-bold mb-6 font-en text-slate-800 dark:text-white">Select a Course</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Please select a course to continue.</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            `;
            
            groups.forEach(group => {
                html += `
                    <div class="group-card cursor-pointer" onclick="Teacher.setSelectedGroup('${group.id}', '${group.name.replace(/'/g, "\\'")}', '${page}')">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-bold text-lg dark:text-white">${group.name}</h3>
                                <p class="text-xs text-slate-500 dark:text-slate-400">${group.studentIds ? group.studentIds.length : 0} students</p>
                            </div>
                        </div>
                        <div class="group-code-container">
                            <span class="group-code-text">${group.groupCode}</span>
                            <button onclick="event.stopPropagation(); Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-3">
                            Created: ${moment(group.createdAt?.toDate()).format('DD MMM YYYY')}
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    
                    <div class="mt-6 bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary">
                        <h3 class="font-bold text-lg mb-4 dark:text-white">Create New Course</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-bold mb-1 dark:text-white">Course Name</label>
                                <input type="text" id="group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl" placeholder="e.g., Class 10 Batch-1">
                            </div>
                            
                            <button onclick="Teacher.createGroupFromInput()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg">
                                Create Course
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('app-container').innerHTML = html;
        } catch (error) {
            console.error('Error loading groups:', error);
            document.getElementById('app-container').innerHTML = '<div class="text-center p-10 text-red-500">Error loading courses</div>';
        }
    },
    
    setSelectedGroup: (groupId, groupName, page) => {
        AppState.selectedGroup = { id: groupId, name: groupName };
        localStorage.setItem('selectedGroup', JSON.stringify(AppState.selectedGroup));
        Teacher.loadGroupsForSwitcher();
        initRealTimeSync();
        Router.teacher(page);
    },

    toggleThreeDotMenu: (menuId) => {
        document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
            if (dropdown.id !== `menu-${menuId}`) dropdown.classList.remove('show');
        });
        const menu = document.getElementById(`menu-${menuId}`);
        if (menu) menu.classList.toggle('show');
    },

    syncFolderExamData: async (examId, newData) => {
        for (const type of ['live', 'mock']) {
            folderStructure[type].forEach(sub => {
                sub.children.forEach(chap => {
                    const exam = chap.exams.find(e => e.id === examId);
                    if (exam) exam.examData = { ...exam.examData, ...newData };
                });
            });
        }
        const uncat = folderStructure.uncategorized.find(e => e.id === examId);
        if(uncat) uncat.examData = { ...uncat.examData, ...newData };
        await saveFolderStructureToFirebase();
    },
    
    publish: async (id) => {
        Swal.fire({ 
            title:'Publish Result?', 
            text: "Students will see their results now.", 
            icon:'question', 
            showCancelButton:true, 
            confirmButtonColor:'#4f46e5', 
            confirmButtonText:'Yes, Publish' 
        }).then(async(r) => {
            if(r.isConfirmed) { 
                await updateDoc(doc(db, "exams", id), { 
                    resultPublished: true,
                    updatedAt: new Date()
                }); 
                await Teacher.syncFolderExamData(id, { resultPublished: true });
                Swal.fire('Published', 'Result is now live', 'success').then(() => {
                    if (AppState.currentPage === 'home') {
                        const homeContainer = document.getElementById('home-active-live-section');
                        if (homeContainer) homeContainer.innerHTML = '';
                    }
                });
            }
        });
    },
    
    extendExamTime: async (examId) => {
        const ex = ExamCache[examId];
        if (!ex) return;

        const { value: newEndTime } = await Swal.fire({
            title: 'Extend Exam Time',
            html: `
                <p class="text-sm text-slate-500 mb-3">Current end time: ${moment(ex.endTime).format('DD MMM, hh:mm A')}</p>
                <input id="swal-ext-time" type="datetime-local" class="swal2-input" value="${ex.endTime}">
            `,
            showCancelButton: true,
            confirmButtonText: 'Update Time',
            preConfirm: () => document.getElementById('swal-ext-time').value
        });

        if (newEndTime) {
            try {
                Swal.fire({title: 'Updating...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
                await updateDoc(doc(db, "exams", examId), { endTime: newEndTime, updatedAt: new Date() });
                ExamCache[examId].endTime = newEndTime;
                await Teacher.syncFolderExamData(examId, { endTime: newEndTime });
                Swal.fire('Success', 'Exam time extended', 'success').then(() => {
                    if (AppState.currentPage === 'home') {
                        if (typeof Teacher.renderActiveLiveExamOnHome === 'function') Teacher.renderActiveLiveExamOnHome(examId);
                    } else if (AppState.currentPage === 'management') {
                        if (typeof Teacher.liveExamManagementView === 'function') Teacher.liveExamManagementView();
                    }
                });
            } catch (e) {
                Swal.fire('Error', 'Failed to extend time: ' + e.message, 'error');
            }
        }
    },
    
    stopLiveExam: async function(examId) {
        const exam = ExamCache[examId];
        if (!exam) return;
        
        const confirm = await Swal.fire({
            title: 'Cancel Exam?',
            text: "This will cancel the exam immediately!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, cancel it!'
        });

        if (confirm.isConfirmed) {
            try {
                await updateDoc(doc(db, "exams", examId), { cancelled: true, updatedAt: new Date() });
                await Teacher.syncFolderExamData(examId, { cancelled: true });
                Swal.fire('Cancelled!', 'The exam has been cancelled.', 'success');
                if (AppState.currentPage === 'home') {
                    const homeContainer = document.getElementById('home-active-live-section');
                    if (homeContainer) homeContainer.innerHTML = '';
                }
            } catch (error) {
                Swal.fire('Error', 'Failed to cancel exam: ' + error.message, 'error');
            }
        }
    },
    
    createGroup: async (name) => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        let groupCode = '';
        for (let i = 0; i < 5; i++) groupCode += letters.charAt(Math.floor(Math.random() * letters.length));
        for (let i = 0; i < 5; i++) groupCode += numbers.charAt(Math.floor(Math.random() * numbers.length));
        
        try {
            const groupData = {
                name, groupCode,
                teacherId: AppState.currentUser.id,
                teacherCode: AppState.currentUser.teacherCode,
                teacherName: AppState.currentUser.fullName,
                archived: false, approvalRequired: false, joinEnabled: true,
                studentIds: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await addDoc(collection(db, "groups"), groupData);
            Swal.fire({
                title: 'Course Created!',
                html: `<div class="text-left"><p><strong>Course Name:</strong> ${name}</p><p><strong>Course Code:</strong> <code>${groupCode}</code></p></div>`,
                icon: 'success'
            }).then(() => {
                Teacher.loadGroupsForSwitcher();
                if (typeof Teacher.manageGroupsView === 'function') Teacher.manageGroupsView();
            });
        } catch (error) {
            Swal.fire('Error', 'Failed to create course: ' + error.message, 'error');
        }
    },
    
    createGroupFromInput: async () => {
        const name = document.getElementById('group-name').value.trim();
        if (!name) { Swal.fire('Error', 'Course name is required', 'error'); return; }
        await Teacher.createGroup(name);
    }
};

window.Teacher = Teacher;
