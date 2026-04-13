// js/teacher/groups.js
// গ্রুপ ও শিক্ষার্থী ম্যানেজমেন্ট

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ------------- ম্যানেজ গ্রুপ ভিউ -------------
Teacher.manageGroupsView = async () => {
    document.getElementById('app-container').innerHTML = `
    <div class="pb-6">
        <div class="flex items-center gap-3 mb-6">
            <button onclick="Router.teacher(AppState.currentPage)" class="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text">
                <i class="fas fa-arrow-left"></i> ফিরে যান
            </button>
            <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">কোর্স ব্যবস্থাপনা</h2>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1">
                <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border dark:border-dark-tertiary sticky top-4">
                    <h3 class="font-bold text-base mb-4 dark:text-white bengali-text flex items-center gap-2"><i class="fas fa-plus-circle text-indigo-600"></i> নতুন কোর্স তৈরি</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">কোর্সের নাম</label>
                            <input type="text" id="group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm" placeholder="যেমনঃ ক্লাস ১০ ব্যাচ-১">
                        </div>
                        <button onclick="Teacher.createGroupFromInput()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg text-sm hover:opacity-90 transition bengali-text">
                            <i class="fas fa-plus mr-2"></i>কোর্স তৈরি
                        </button>
                    </div>
                </div>
            </div>
            <div class="lg:col-span-2">
                <div id="groups-container">
                    <div class="text-center p-8 text-slate-400 bengali-text">কোর্স লোড হচ্ছে...</div>
                </div>
            </div>
        </div>
    </div>`;
    
    await Teacher.loadTeacherGroups();
};

Teacher.loadTeacherGroups = async () => {
    try {
        const groupsQuery = query(collection(db, "groups"), 
            where("teacherId", "==", AppState.currentUser.id),
            where("archived", "==", false),
            orderBy("createdAt", "desc"));
        const groupsSnap = await getDocs(groupsQuery);
        
        const groups = [];
        groupsSnap.forEach(doc => {
            groups.push({ id: doc.id, ...doc.data() });
        });
        
        Teacher.teacherGroups = groups;
        
        if (groups.length === 0) {
            document.getElementById('groups-container').innerHTML = `
                <div class="text-center p-4 text-slate-400 bengali-text">
                    কোনো সক্রিয় কোর্স পাওয়া যায়নি
                </div>
            `;
            return;
        }
        
        let html = '<div class="group-grid">';
        
        for (let group of groups) {
            let pendingCount = 0;
            try {
                const reqQ = query(collection(db, "join_requests"), where("groupId", "==", group.id), where("status", "==", "pending"));
                const reqSnap = await getDocs(reqQ);
                pendingCount = reqSnap.size;
            } catch(e) {}
            
            let disabledCount = 0;
            let blockedCount = 0;
            let activeCount = 0;

            if (group.studentIds && group.studentIds.length > 0) {
                try {
                    const batches = [];
                    const chunk = 10;
                    for (let i = 0; i < group.studentIds.length; i += chunk) {
                        const slice = group.studentIds.slice(i, i + chunk);
                        if(slice.length > 0) {
                            const stQ = query(collection(db, "students"), where("__name__", "in", slice));
                            batches.push(getDocs(stQ));
                        }
                    }
                    const snaps = await Promise.all(batches);
                    snaps.forEach(snap => {
                        snap.forEach(d => {
                            const s = d.data();
                            if (s.disabled) disabledCount++;
                            else if (s.blocked) blockedCount++;
                            else activeCount++;
                        });
                    });
                } catch(e){
                    console.warn("বিস্তারিত শিক্ষার্থী পরিসংখ্যান আনতে ব্যর্থ", e);
                }
            }

            html += `
                <div class="group-card" onclick="Teacher.viewGroupStudents('${group.id}')">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-bold text-lg dark:text-white bengali-text group-hover:text-indigo-600 transition">${group.name}</h3>
                        </div>
                        <div class="three-dot-menu relative">
                            <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleGroupMenu('${group.id}')">
                                <i class="fas fa-ellipsis-v text-slate-400"></i>
                            </button>
                            <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="group-menu-${group.id}">
                                <div class="menu-item rename dark:text-purple-400 bengali-text" onclick="event.stopPropagation(); Teacher.renameGroup('${group.id}', '${group.name}')">
                                    <i class="fas fa-pencil-alt"></i>
                                    পুনঃনামকরণ
                                </div>
                                <div class="menu-item archive dark:text-amber-400 bengali-text" onclick="event.stopPropagation(); Teacher.archiveGroupConfirm('${group.id}', '${group.groupCode}')">
                                    <i class="fas fa-archive"></i>
                                    আর্কাইভে সরান
                                </div>
                                <div class="menu-item delete dark:text-red-400 bengali-text" onclick="event.stopPropagation(); Teacher.deleteGroupConfirm('${group.id}', '${group.groupCode}')">
                                    <i class="fas fa-trash"></i>
                                    মুছে ফেলুন
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="group-code-container" onclick="event.stopPropagation();">
                        <span class="group-code-text">${group.groupCode}</span>
                        <button onclick="Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>

                    <div class="grid grid-cols-4 gap-2 mt-4 text-center text-[10px] uppercase font-bold tracking-wider">
                        <div class="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded border border-indigo-100 dark:border-indigo-800">
                            <span class="font-black block text-indigo-700 dark:text-indigo-400 text-sm mb-0.5">${group.studentIds ? group.studentIds.length : 0}</span>
                            <span class="text-slate-500">মোট</span>
                        </div>
                        <div class="bg-amber-50 dark:bg-amber-900/30 p-2 rounded border border-amber-100 dark:border-amber-800">
                            <span class="font-black block text-amber-700 dark:text-amber-400 text-sm mb-0.5">${pendingCount}</span>
                            <span class="text-slate-500">অপেক্ষমান</span>
                        </div>
                        <div class="bg-slate-100 dark:bg-dark-tertiary p-2 rounded border border-slate-200 dark:border-slate-700">
                            <span class="font-black block text-slate-700 dark:text-slate-400 text-sm mb-0.5">${disabledCount}</span>
                            <span class="text-slate-500">নিষ্ক্রিয়</span>
                        </div>
                        <div class="bg-red-50 dark:bg-red-900/30 p-2 rounded border border-red-100 dark:border-red-800">
                            <span class="font-black block text-red-700 dark:text-red-400 text-sm mb-0.5">${blockedCount}</span>
                            <span class="text-slate-500">ব্লক</span>
                        </div>
                    </div>
                    
                    <div class="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-dark-tertiary text-center">
                        তৈরি: ${moment(group.createdAt?.toDate()).format('DD MMM YYYY')}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        document.getElementById('groups-container').innerHTML = html;
    } catch (error) {
        console.error('কোর্স লোড করতে ত্রুটি:', error);
        document.getElementById('groups-container').innerHTML = '<div class="text-center p-4 text-red-500 bengali-text">কোর্স লোড করতে ত্রুটি</div>';
    }
};

Teacher.toggleGroupMenu = (groupId) => {
    event.stopPropagation();
    document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
        if (dropdown.id !== `group-menu-${groupId}`) {
            dropdown.classList.remove('show');
        }
    });
    
    const menu = document.getElementById(`group-menu-${groupId}`);
    if (menu) {
        menu.classList.toggle('show');
    }
};

Teacher.toggleGroupSetting = async (groupId, setting, value) => {
    try {
        await updateDoc(doc(db, "groups", groupId), {
            [setting]: value,
            updatedAt: new Date()
        });
        
        const group = Teacher.teacherGroups.find(g => g.id === groupId);
        if (group) {
            group[setting] = value;
        }
    } catch (error) {
        Swal.fire('ত্রুটি', 'সেটিং আপডেট ব্যর্থ: ' + error.message, 'error');
    }
};

Teacher.viewGroupStudents = async (groupId, initialFilter = 'all') => {
    try {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (!groupDoc.exists()) return;
        
        const group = { id: groupDoc.id, ...groupDoc.data() };
        
        document.getElementById('app-container').innerHTML = '<div class="p-10 text-center"><div class="loader mx-auto"></div></div>';
        
        let students = [];
        if (group.studentIds && group.studentIds.length > 0) {
            const studentPromises = group.studentIds.map(async (studentId) => {
                try {
                    const studentDoc = await getDoc(doc(db, "students", studentId));
                    if (studentDoc.exists()) {
                        const studentData = studentDoc.data();
                        return { 
                            id: studentDoc.id, 
                            ...studentData, 
                            status: 'active',
                            fullName: studentData.fullName || studentData.name || '',
                            email: studentData.email || '',
                            phone: studentData.phone || '',
                            fatherPhone: studentData.fatherPhone || '',
                            motherPhone: studentData.motherPhone || '',
                            schoolName: studentData.schoolName || '',
                            collegeName: studentData.collegeName || '',
                            disabled: studentData.disabled || false,
                            blocked: studentData.blocked || false
                        };
                    }
                } catch (error) {
                    console.error('শিক্ষার্থী লোড করতে ত্রুটি:', error);
                }
                return null;
            });
            
            const studentResults = await Promise.all(studentPromises);
            students = studentResults.filter(s => s !== null);
        }
        
        const requestsQuery = query(collection(db, "join_requests"), 
            where("groupId", "==", groupId),
            where("status", "==", "pending"));
        const requestsSnap = await getDocs(requestsQuery);
        
        const pendingStudents = [];
        requestsSnap.forEach(doc => {
            const request = doc.data();
            pendingStudents.push({
                id: doc.id,
                studentId: request.studentId,
                studentName: request.studentName,
                studentEmail: request.studentEmail,
                requestedAt: request.requestedAt,
                status: 'pending'
            });
        });
        
        const allStudents = [
            ...students.map(s => ({ ...s, status: 'active' })),
            ...pendingStudents.map(p => ({ 
                id: p.id, 
                studentId: p.studentId,
                fullName: p.studentName,
                email: p.studentEmail,
                requestedAt: p.requestedAt,
                status: 'pending'
            }))
        ];
        
        window.currentGroupStudents = allStudents;
        window.currentGroupId = groupId;
        
        document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <button onclick="Router.teacher(AppState.currentPage)" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 bengali-text">
                <i class="fas fa-arrow-left"></i> ফিরে যান
            </button>
            
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-xl font-bold font-en text-slate-800 dark:text-white bengali-text">${group.name}</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text">${allStudents.length} জন ব্যবহারকারী</p>
                </div>
                <div class="group-code-container mt-0">
                    <span class="group-code-text">${group.groupCode}</span>
                    <button onclick="Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>

            <div class="bg-white dark:bg-dark-secondary rounded-xl p-4 mb-6 shadow-sm border dark:border-dark-tertiary">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium dark:text-white bengali-text">যোগদান সক্রিয়</span>
                        <label class="toggle-switch">
                            <input type="checkbox" ${group.joinEnabled ? 'checked' : ''} 
                                   onchange="Teacher.toggleGroupSetting('${group.id}', 'joinEnabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="flex items-center justify-between border-l border-slate-100 dark:border-dark-tertiary pl-4">
                        <span class="text-sm font-medium dark:text-white bengali-text">অনুমোদন প্রয়োজন</span>
                        <label class="toggle-switch">
                            <input type="checkbox" ${group.approvalRequired ? 'checked' : ''} 
                                   onchange="Teacher.toggleGroupSetting('${group.id}', 'approvalRequired', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="search-bar-container mb-6">
                <input type="text" id="student-search-input" class="search-bar-input w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="নাম, ফোন, ইমেইল, পিতা/মাতার নাম্বার বা প্রতিষ্ঠানের নাম লিখুন...">
                <i class="search-icon fas fa-search"></i>
                <button class="clear-search-btn" onclick="Teacher.clearStudentSearch()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="filter-tabs" id="student-filter-tabs">
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('all')">সব (${allStudents.length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('active')">সক্রিয় (${students.length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('pending')">অপেক্ষমান (${pendingStudents.length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('disabled')">নিষ্ক্রিয় (${students.filter(s => s.disabled).length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('blocked')">ব্লক (${students.filter(s => s.blocked).length})</div>
            </div>
            
            <div class="student-list-container" id="student-list">
            </div>
        </div>`;
        
        document.getElementById('student-search-input').addEventListener('input', Teacher.searchStudents);
        Teacher.filterStudents(initialFilter);
        
    } catch (error) {
        console.error('কোর্সের শিক্ষার্থী লোড করতে ত্রুটি:', error);
        document.getElementById('app-container').innerHTML = '<div class="text-center p-10 text-red-500 bengali-text">শিক্ষার্থী লোড করতে ত্রুটি</div>';
    }
};

Teacher.renderStudentList = function(students) {
    if (students.length === 0) {
        return `
            <div class="text-center p-10 text-slate-400">
                <i class="fas fa-users text-4xl mb-4 opacity-30"></i>
                <p class="bengali-text">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
            </div>
        `;
    }
    
    return students.map(student => {
        let statusClass = 'status-active';
        let statusText = 'সক্রিয়';
        
        if (student.status === 'pending') {
            statusClass = 'status-pending';
            statusText = 'অপেক্ষমান';
        } else if (student.disabled) {
            statusClass = 'status-disabled';
            statusText = 'নিষ্ক্রিয়';
        } else if (student.blocked) {
            statusClass = 'status-blocked';
            statusText = 'ব্লক';
        }
        
        return `
            <div class="student-item">
                <div onclick="Teacher.viewStudentProfile('${student.studentId || student.id}', '${window.currentGroupId}')" class="flex-1 cursor-pointer">
                    <div class="font-bold text-sm dark:text-white bengali-text">${student.fullName || student.name || student.studentName || 'নাম নেই'}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">${student.email || student.studentEmail}</div>
                    <div class="text-[10px] text-indigo-500 font-bold mt-1 bengali-text">
                        ${student.schoolName || student.collegeName || ''}
                        ${student.phone ? '• ' + student.phone : ''}
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="student-status ${statusClass} bengali-text">${statusText}</span>
                    ${student.status === 'pending' ? `
                        <div class="flex gap-2">
                            <button onclick="event.stopPropagation(); Teacher.approveStudentRequest('${student.id}', '${window.currentGroupId}')" class="text-xs bg-emerald-600 text-white px-2 py-1 rounded bengali-text">
                                অনুমোদন
                            </button>
                            <button onclick="event.stopPropagation(); Teacher.rejectStudentRequest('${student.id}', '${window.currentGroupId}')" class="text-xs bg-red-600 text-white px-2 py-1 rounded bengali-text">
                                প্রত্যাখ্যান
                            </button>
                        </div>
                    ` : student.status === 'active' ? `
                        <div class="student-three-dot-menu relative">
                            <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleStudentMenu('${student.studentId || student.id}')">
                                <i class="fas fa-ellipsis-v text-slate-400"></i>
                            </button>
                            <div class="dot-menu-dropdown student-dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="student-menu-${student.studentId || student.id}">
                                <div class="menu-item ${student.disabled ? 'enable' : 'disable'} bengali-text" onclick="event.stopPropagation(); Teacher.toggleStudentStatus('${student.studentId || student.id}', 'disabled', ${!student.disabled}, '${window.currentGroupId}')">
                                    <i class="fas ${student.disabled ? 'fa-check-circle' : 'fa-ban'}"></i>
                                    ${student.disabled ? 'সক্রিয় করুন' : 'নিষ্ক্রিয় করুন'}
                                </div>
                                <div class="menu-item ${student.blocked ? 'unblock' : 'block'} bengali-text" onclick="event.stopPropagation(); Teacher.toggleStudentStatus('${student.studentId || student.id}', 'blocked', ${!student.blocked}, '${window.currentGroupId}')">
                                    <i class="fas ${student.blocked ? 'fa-unlock' : 'fa-lock'}"></i>
                                    ${student.blocked ? 'আনব্লক করুন' : 'ব্লক করুন'}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
};

Teacher.searchStudents = function() {
    const searchInput = document.getElementById('student-search-input');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        Teacher.filterStudents(window.currentFilter || 'all');
        return;
    }
    
    const filteredStudents = window.currentGroupStudents.filter(student => {
        const name = (student.fullName || student.name || student.studentName || '').toLowerCase();
        const email = (student.email || student.studentEmail || '').toLowerCase();
        const phone = (student.phone || '').toLowerCase();
        const fatherPhone = (student.fatherPhone || '').toLowerCase();
        const motherPhone = (student.motherPhone || '').toLowerCase();
        const school = (student.schoolName || '').toLowerCase();
        const college = (student.collegeName || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               email.includes(searchTerm) || 
               phone.includes(searchTerm) ||
               fatherPhone.includes(searchTerm) ||
               motherPhone.includes(searchTerm) ||
               school.includes(searchTerm) ||
               college.includes(searchTerm);
    });
    
    document.getElementById('student-list').innerHTML = Teacher.renderStudentList(filteredStudents);
};

Teacher.clearStudentSearch = function() {
    document.getElementById('student-search-input').value = '';
    Teacher.filterStudents(window.currentFilter || 'all');
};

Teacher.toggleStudentMenu = function(studentId) {
    document.querySelectorAll('.student-dot-menu-dropdown').forEach(dropdown => {
        if (dropdown.id !== `student-menu-${studentId}`) {
            dropdown.classList.remove('show');
        }
    });
    
    const menu = document.getElementById(`student-menu-${studentId}`);
    if (menu) {
        menu.classList.toggle('show');
    }
};

Teacher.filterStudents = function(filter) {
    window.currentFilter = filter;
    const tabs = document.querySelectorAll('#student-filter-tabs .filter-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if(tab.textContent.toLowerCase().includes(filter.toLowerCase())) {
            tab.classList.add('active');
        }
    });
    
    let filteredStudents = [];
    
    if (filter === 'all') {
        filteredStudents = window.currentGroupStudents;
    } else if (filter === 'active') {
        filteredStudents = window.currentGroupStudents.filter(s => s.status === 'active' && !s.disabled && !s.blocked);
    } else if (filter === 'pending') {
        filteredStudents = window.currentGroupStudents.filter(s => s.status === 'pending');
    } else if (filter === 'disabled') {
        filteredStudents = window.currentGroupStudents.filter(s => s.disabled);
    } else if (filter === 'blocked') {
        filteredStudents = window.currentGroupStudents.filter(s => s.blocked);
    }
    
    const searchInput = document.getElementById('student-search-input');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filteredStudents = filteredStudents.filter(student => {
            const name = (student.fullName || student.name || student.studentName || '').toLowerCase();
            const email = (student.email || student.studentEmail || '').toLowerCase();
            const phone = (student.phone || '').toLowerCase();
            const fatherPhone = (student.fatherPhone || '').toLowerCase();
            const motherPhone = (student.motherPhone || '').toLowerCase();
            const school = (student.schoolName || '').toLowerCase();
            const college = (student.collegeName || '').toLowerCase();
            
            return name.includes(searchTerm) || 
                   email.includes(searchTerm) || 
                   phone.includes(searchTerm) ||
                   fatherPhone.includes(searchTerm) ||
                   motherPhone.includes(searchTerm) ||
                   school.includes(searchTerm) ||
                   college.includes(searchTerm);
        });
    }
    
    document.getElementById('student-list').innerHTML = Teacher.renderStudentList(filteredStudents);
};

Teacher.toggleStudentStatus = async (studentId, status, value, groupId) => {
    try {
        await updateDoc(doc(db, "students", studentId), {
            [status]: value,
            updatedAt: new Date()
        });
        
        const menu = document.getElementById(`student-menu-${studentId}`);
        if (menu) {
            menu.classList.remove('show');
        }
        
        Swal.fire('সফল', `শিক্ষার্থী ${status} ${value ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`, 'success').then(() => {
            Teacher.viewGroupStudents(groupId);
        });
    } catch (error) {
        Swal.fire('ত্রুটি', 'শিক্ষার্থীর অবস্থা আপডেট করতে ব্যর্থ', 'error');
    }
};

Teacher.approveStudentRequest = async (requestId, groupId) => {
    try {
        const requestDoc = await getDoc(doc(db, "join_requests", requestId));
        if (!requestDoc.exists()) return;
        
        const request = requestDoc.data();
        
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
            await updateDoc(doc(db, "groups", groupId), {
                studentIds: arrayUnion(request.studentId),
                updatedAt: new Date()
            });
        }
        
        await updateDoc(doc(db, "join_requests", requestId), {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: AppState.currentUser.id
        });
        
        Swal.fire('অনুমোদিত!', 'শিক্ষার্থী কোর্সে যোগ করা হয়েছে', 'success').then(() => {
            Teacher.viewGroupStudents(groupId);
        });
    } catch (error) {
        Swal.fire('ত্রুটি', 'অনুরোধ অনুমোদন করতে ব্যর্থ', 'error');
    }
};

Teacher.rejectStudentRequest = async (requestId, groupId) => {
    const result = await Swal.fire({
        title: 'অনুরোধ প্রত্যাখ্যান?',
        text: "এই অনুরোধ প্রত্যাখ্যান করা হবে",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'প্রত্যাখ্যান'
    });
    
    if (result.isConfirmed) {
        try {
            await updateDoc(doc(db, "join_requests", requestId), {
                status: 'rejected',
                rejectedAt: new Date(),
                rejectedBy: AppState.currentUser.id
            });
            
            Swal.fire('প্রত্যাখ্যাত!', 'অনুরোধ প্রত্যাখ্যান করা হয়েছে', 'success').then(() => {
                Teacher.viewGroupStudents(groupId);
            });
        } catch (error) {
            Swal.fire('ত্রুটি', 'অনুরোধ প্রত্যাখ্যান করতে ব্যর্থ', 'error');
        }
    }
};

Teacher.renameGroup = async (groupId, currentName) => {
    const { value: newName } = await Swal.fire({
        title: 'কোর্স পুনঃনামকরণ',
        input: 'text',
        inputLabel: 'নতুন কোর্সের নাম',
        inputValue: currentName,
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'নতুন নাম দিতে হবে!';
        }
    });
    
    if (newName && newName !== currentName) {
        try {
            await updateDoc(doc(db, "groups", groupId), {
                name: newName,
                updatedAt: new Date()
            });
            
            Swal.fire('সফল', 'কোর্স পুনঃনামকরণ করা হয়েছে', 'success');
            Teacher.loadTeacherGroups();
            Teacher.loadGroupsForSwitcher();
        } catch (error) {
            Swal.fire('ত্রুটি', 'কোর্স পুনঃনামকরণ ব্যর্থ: ' + error.message, 'error');
        }
    }
};

Teacher.archiveGroupConfirm = async (groupId, groupCode) => {
    const { value: enteredCode } = await Swal.fire({
        title: 'কোর্স আর্কাইভ করবেন?',
        text: "নিশ্চিত করতে কোর্স কোড লিখুন",
        input: 'text',
        inputPlaceholder: 'কোর্স কোড লিখুন',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        confirmButtonText: 'আর্কাইভ',
        inputValidator: (value) => {
            if (!value) return 'কোর্স কোড দিতে হবে!';
            if (value !== groupCode) return 'কোর্স কোড মিলছে না!';
        }
    });
    
    if (enteredCode === groupCode) {
        try {
            await updateDoc(doc(db, "groups", groupId), {
                archived: true,
                updatedAt: new Date()
            });
            
            if (AppState.selectedGroup && AppState.selectedGroup.id === groupId) {
                AppState.selectedGroup = null;
                localStorage.removeItem('selectedGroup');
            }
            
            Swal.fire('আর্কাইভড!', 'কোর্স আর্কাইভে সরানো হয়েছে।', 'success');
            Teacher.loadTeacherGroups();
            Teacher.loadGroupsForSwitcher();
        } catch (error) {
            Swal.fire('ত্রুটি', 'কোর্স আর্কাইভ করতে ব্যর্থ: ' + error.message, 'error');
        }
    }
};

Teacher.deleteGroupConfirm = async (groupId, groupCode) => {
    const { value: enteredCode } = await Swal.fire({
        title: 'কোর্স মুছে ফেলবেন?',
        text: "এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না। নিশ্চিত করতে কোর্স কোড লিখুন",
        input: 'text',
        inputPlaceholder: 'কোর্স কোড লিখুন',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'মুছে ফেলুন',
        inputValidator: (value) => {
            if (!value) return 'কোর্স কোড দিতে হবে!';
            if (value !== groupCode) return 'কোর্স কোড মিলছে না!';
        }
    });
    
    if (enteredCode === groupCode) {
        try {
            await deleteDoc(doc(db, "groups", groupId));
            
            if (AppState.selectedGroup && AppState.selectedGroup.id === groupId) {
                AppState.selectedGroup = null;
                localStorage.removeItem('selectedGroup');
            }
            
            Swal.fire('মুছে ফেলা হয়েছে!', 'কোর্স মুছে ফেলা হয়েছে।', 'success');
            Teacher.loadTeacherGroups();
            Teacher.loadGroupsForSwitcher();
        } catch (error) {
            Swal.fire('ত্রুটি', 'কোর্স মুছে ফেলতে ব্যর্থ: ' + error.message, 'error');
        }
    }
};

Teacher.archiveGroupsView = async () => {
    document.getElementById('app-container').innerHTML = `
    <div class="pb-6">
        <div class="flex items-center gap-3 mb-6">
            <button onclick="Teacher.managementView()" class="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text">
                <i class="fas fa-arrow-left"></i> ফিরে যান
            </button>
            <h2 class="text-2xl font-bold font-en text-slate-800 dark:text-white bengali-text">আর্কাইভ কোর্স</h2>
        </div>
        
        <div id="archive-groups-container">
            <div class="text-center p-4 text-slate-400 bengali-text">আর্কাইভকৃত কোর্স লোড হচ্ছে...</div>
        </div>
    </div>`;
    
    await Teacher.loadArchiveGroups();
};

Teacher.loadArchiveGroups = async () => {
    try {
        const groupsQuery = query(collection(db, "groups"), 
            where("teacherId", "==", AppState.currentUser.id),
            where("archived", "==", true),
            orderBy("createdAt", "desc"));
        const groupsSnap = await getDocs(groupsQuery);
        
        const groups = [];
        groupsSnap.forEach(doc => {
            groups.push({ id: doc.id, ...doc.data() });
        });
        
        if (groups.length === 0) {
            document.getElementById('archive-groups-container').innerHTML = `
                <div class="text-center p-10">
                    <div class="w-16 h-16 bg-slate-100 dark:bg-dark-tertiary rounded-full flex items-center justify-center text-slate-400 text-2xl mb-4 mx-auto">
                        <i class="fas fa-archive"></i>
                    </div>
                    <h3 class="font-bold text-lg dark:text-white mb-2 bengali-text">কোনো আর্কাইভকৃত কোর্স নেই</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text">আপনার এখনো কোনো আর্কাইভকৃত কোর্স নেই</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="group-grid">';
        
        groups.forEach(group => {
            html += `
                <div class="group-card">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-bold text-lg dark:text-white bengali-text">${group.name}</h3>
                            <p class="text-xs text-slate-500 dark:text-slate-400 bengali-text">${group.studentIds ? group.studentIds.length : 0} জন শিক্ষার্থী</p>
                        </div>
                        <div class="three-dot-menu relative">
                            <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleArchiveGroupMenu('${group.id}')">
                                <i class="fas fa-ellipsis-v text-slate-400"></i>
                            </button>
                            <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="archive-group-menu-${group.id}">
                                <div class="menu-item restore dark:text-emerald-400 bengali-text" onclick="event.stopPropagation(); Teacher.restoreGroupConfirm('${group.id}', '${group.groupCode}')">
                                    <i class="fas fa-undo"></i>
                                    পুনরুদ্ধার
                                </div>
                                <div class="menu-item delete dark:text-red-400 bengali-text" onclick="event.stopPropagation(); Teacher.deleteGroupConfirm('${group.id}', '${group.groupCode}')">
                                    <i class="fas fa-trash"></i>
                                    মুছে ফেলুন
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="group-code-container">
                        <span class="group-code-text">${group.groupCode}</span>
                        <button onclick="event.stopPropagation(); Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 mt-3">
                        তৈরি: ${moment(group.createdAt?.toDate()).format('DD MMM YYYY')}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        document.getElementById('archive-groups-container').innerHTML = html;
    } catch (error) {
        console.error('আর্কাইভ গ্রুপ লোড করতে ত্রুটি:', error);
        document.getElementById('archive-groups-container').innerHTML = '<div class="text-center p-4 text-red-500 bengali-text">আর্কাইভ কোর্স লোড করতে ত্রুটি</div>';
    }
};

Teacher.toggleArchiveGroupMenu = (groupId) => {
    event.stopPropagation();
    document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
        if (dropdown.id !== `archive-group-menu-${groupId}`) {
            dropdown.classList.remove('show');
        }
    });
    
    const menu = document.getElementById(`archive-group-menu-${groupId}`);
    if (menu) {
        menu.classList.toggle('show');
    }
};

Teacher.restoreGroupConfirm = async (groupId, groupCode) => {
    const { value: enteredCode } = await Swal.fire({
        title: 'কোর্স পুনরুদ্ধার করবেন?',
        text: "নিশ্চিত করতে কোর্স কোড লিখুন",
        input: 'text',
        inputPlaceholder: 'কোর্স কোড লিখুন',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'পুনরুদ্ধার',
        inputValidator: (value) => {
            if (!value) return 'কোর্স কোড দিতে হবে!';
            if (value !== groupCode) return 'কোর্স কোড মিলছে না!';
        }
    });
    
    if (enteredCode === groupCode) {
        try {
            await updateDoc(doc(db, "groups", groupId), {
                archived: false,
                updatedAt: new Date()
            });
            
            Swal.fire('পুনরুদ্ধার করা হয়েছে!', 'কোর্স পুনরুদ্ধার করা হয়েছে।', 'success');
            Teacher.loadArchiveGroups();
            Teacher.loadGroupsForSwitcher();
        } catch (error) {
            Swal.fire('ত্রুটি', 'কোর্স পুনরুদ্ধার করতে ব্যর্থ: ' + error.message, 'error');
        }
    }
};
