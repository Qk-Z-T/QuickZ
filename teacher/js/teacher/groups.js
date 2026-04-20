// js/teacher/groups.js
// গ্রুপ ও শিক্ষার্থী ম্যানেজমেন্ট (নতুন ফিচার: ক্লাস, বিবরণ, ছবি, জয়েন মেথড, পারমিশন কী)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, addDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// ক্লাস লেভেল অপশন
const CLASS_LEVELS = ['6', '7', '8', 'SSC', 'HSC', 'Admission'];
const ADMISSION_STREAMS = ['Science', 'Humanities', 'Commerce'];

// ------------- ম্যানেজ গ্রুপ ভিউ (কোর্স তালিকা ও তৈরির ফর্ম) -------------
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
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">কোর্সের নাম <span class="text-red-500">*</span></label>
                            <input type="text" id="new-group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm" placeholder="যেমনঃ ক্লাস ১০ ব্যাচ-১">
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">ক্লাস/লেভেল <span class="text-red-500">*</span></label>
                            <select id="new-group-class" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm">
                                <option value="">সিলেক্ট করুন</option>
                                ${CLASS_LEVELS.map(lvl => `<option value="${lvl}">${lvl === 'Admission' ? 'এডমিশন' : (lvl === 'SSC' ? 'এসএসসি' : (lvl === 'HSC' ? 'এইচএসসি' : lvl + 'ম শ্রেণী'))}</option>`).join('')}
                            </select>
                        </div>
                        <div id="admission-stream-container" class="hidden">
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">শাখা (Admission)</label>
                            <select id="new-group-admission-stream" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm">
                                <option value="">সিলেক্ট করুন</option>
                                <option value="Science">সায়েন্স</option>
                                <option value="Humanities">মানবিক</option>
                                <option value="Commerce">কমার্স</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">বিবরণ</label>
                            <textarea id="new-group-description" rows="3" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm" placeholder="কোর্স সম্পর্কে বিস্তারিত লিখুন..."></textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">কভার ইমেজ</label>
                            <input type="file" id="new-group-image" accept="image/*" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl text-sm">
                            <p class="text-[10px] text-slate-500 mt-1">সর্বোচ্চ ২ এমবি, আড়াআড়ি (landscape) সাইজ ভালো</p>
                            <div id="image-preview" class="mt-2 hidden">
                                <img id="preview-img" src="" alt="Preview" class="w-full h-32 object-cover rounded-lg border">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">জয়েন মেথড <span class="text-red-500">*</span></label>
                            <select id="new-group-join-method" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm">
                                <option value="public">পাবলিক (যে কেউ জয়েন করতে পারবে)</option>
                                <option value="code">কোর্স কোড প্রয়োজন</option>
                                <option value="permission">পারমিশন কী প্রয়োজন</option>
                            </select>
                        </div>
                        <button onclick="Teacher.createFullGroup()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg text-sm hover:opacity-90 transition bengali-text">
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
    
    // ক্লাস সিলেক্টে Admission সিলেক্ট করলে স্ট্রিম অপশন দেখাবে
    const classSelect = document.getElementById('new-group-class');
    const streamContainer = document.getElementById('admission-stream-container');
    classSelect.addEventListener('change', () => {
        if (classSelect.value === 'Admission') {
            streamContainer.classList.remove('hidden');
        } else {
            streamContainer.classList.add('hidden');
        }
    });

    // ইমেজ প্রিভিউ
    const imageInput = document.getElementById('new-group-image');
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                Swal.fire('ত্রুটি', 'ছবির সাইজ ২ এমবির বেশি হতে পারবে না', 'error');
                imageInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('preview-img').src = event.target.result;
                document.getElementById('image-preview').classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
    
    await Teacher.loadTeacherGroups();
};

// নতুন পূর্ণাঙ্গ গ্রুপ তৈরি (ছবি সহ)
Teacher.createFullGroup = async () => {
    const name = document.getElementById('new-group-name').value.trim();
    const classLevel = document.getElementById('new-group-class').value;
    const description = document.getElementById('new-group-description').value.trim();
    const joinMethod = document.getElementById('new-group-join-method').value;
    const imageFile = document.getElementById('new-group-image').files[0];
    
    // ভ্যালিডেশন
    if (!name) return Swal.fire('ত্রুটি', 'কোর্সের নাম আবশ্যক', 'error');
    if (!classLevel) return Swal.fire('ত্রুটি', 'ক্লাস/লেভেল সিলেক্ট করুন', 'error');
    
    let admissionStream = null;
    if (classLevel === 'Admission') {
        admissionStream = document.getElementById('new-group-admission-stream').value;
        if (!admissionStream) return Swal.fire('ত্রুটি', 'অনুগ্রহ করে শাখা সিলেক্ট করুন', 'error');
    }
    
    try {
        Swal.fire({ title: 'কোর্স তৈরি হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        // কোর্স কোড জেনারেট (আগের মতোই)
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        let groupCode = '';
        for (let i = 0; i < 5; i++) groupCode += letters.charAt(Math.floor(Math.random() * letters.length));
        for (let i = 0; i < 5; i++) groupCode += numbers.charAt(Math.floor(Math.random() * numbers.length));
        
        let imageUrl = null;
        if (imageFile) {
            imageUrl = await Teacher.uploadCourseImage(imageFile, groupCode);
        }
        
        const groupData = {
            name,
            groupCode,
            classLevel,
            admissionStream: admissionStream || null,
            description: description || '',
            imageUrl: imageUrl || null,
            joinMethod,
            permissionKey: null,
            permissionKeyUsed: false,
            teacherId: AppState.currentUser.id,
            teacherName: AppState.currentUser.fullName,
            archived: false,
            approvalRequired: false,
            joinEnabled: true,
            studentIds: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const docRef = await addDoc(collection(db, "groups"), groupData);
        
        Swal.fire({
            title: 'কোর্স তৈরি হয়েছে!',
            html: `<div class="text-left">
                <p><strong>কোর্সের নাম:</strong> ${name}</p>
                <p><strong>কোর্স কোড:</strong> <code>${groupCode}</code></p>
                ${imageUrl ? '<p class="text-green-600"><i class="fas fa-check-circle"></i> কভার ইমেজ আপলোড হয়েছে</p>' : ''}
            </div>`,
            icon: 'success'
        }).then(() => {
            Teacher.loadTeacherGroups();
            Teacher.loadGroupsForSwitcher();
        });
    } catch (error) {
        Swal.fire('ত্রুটি', 'কোর্স তৈরি ব্যর্থ: ' + error.message, 'error');
    }
};

// Firebase Storage-এ ইমেজ আপলোড
Teacher.uploadCourseImage = async (file, groupCode) => {
    const storage = getStorage();
    const fileExt = file.name.split('.').pop();
    const fileName = `course-images/${AppState.currentUser.id}/${groupCode}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

// পূর্বের createGroup এবং createGroupFromInput সরিয়ে বা আপডেট করা হয়েছে
Teacher.createGroupFromInput = async () => {
    Swal.fire('সতর্কতা', 'অনুগ্রহ করে নতুন ফর্ম ব্যবহার করুন', 'warning');
    Teacher.manageGroupsView();
};

// ------------- শিক্ষকের সব কোর্স লোড করে UI-তে দেখানো (আপডেটেড কার্ড) -------------
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

            const classBadge = group.classLevel ? 
                `<span class="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">${group.classLevel === 'Admission' ? 'এডমিশন' : group.classLevel}</span>` : '';
            const joinMethodText = {
                'public': 'পাবলিক',
                'code': 'কোর্স কোড',
                'permission': 'পারমিশন কী'
            }[group.joinMethod] || 'কোর্স কোড';
            
            const imageHtml = group.imageUrl ? 
                `<img src="${group.imageUrl}" alt="${group.name}" class="w-full h-32 object-cover rounded-t-lg">` : 
                `<div class="w-full h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-lg"><i class="fas fa-book-open"></i></div>`;

            html += `
                <div class="group-card overflow-hidden" onclick="Teacher.viewGroupStudents('${group.id}')">
                    ${imageHtml}
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-lg dark:text-white bengali-text group-hover:text-indigo-600 transition">${group.name}</h3>
                            <div class="three-dot-menu relative">
                                <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleGroupMenu('${group.id}')">
                                    <i class="fas fa-ellipsis-v text-slate-400"></i>
                                </button>
                                <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="group-menu-${group.id}">
                                    <div class="menu-item edit dark:text-blue-400 bengali-text" onclick="event.stopPropagation(); Teacher.editGroupDetails('${group.id}')">
                                        <i class="fas fa-edit"></i>
                                        সম্পাদনা
                                    </div>
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
                        <div class="flex flex-wrap gap-2 mb-2">
                            ${classBadge}
                            <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">${joinMethodText}</span>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">${group.description || 'কোনো বিবরণ নেই'}</p>
                        <div class="group-code-container mb-3" onclick="event.stopPropagation();">
                            <span class="group-code-text">${group.groupCode}</span>
                            <button onclick="Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>

                        <div class="grid grid-cols-4 gap-2 text-center text-[10px] uppercase font-bold tracking-wider">
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

// ------------- কোর্স সম্পাদনা -------------
Teacher.editGroupDetails = async (groupId) => {
    const group = Teacher.teacherGroups.find(g => g.id === groupId);
    if (!group) return;
    
    const classOptions = CLASS_LEVELS.map(lvl => 
        `<option value="${lvl}" ${group.classLevel === lvl ? 'selected' : ''}>${lvl === 'Admission' ? 'এডমিশন' : (lvl === 'SSC' ? 'এসএসসি' : (lvl === 'HSC' ? 'এইচএসসি' : lvl + 'ম শ্রেণী'))}</option>`
    ).join('');
    
    const streamOptions = ADMISSION_STREAMS.map(s => 
        `<option value="${s}" ${group.admissionStream === s ? 'selected' : ''}>${s === 'Science' ? 'সায়েন্স' : (s === 'Humanities' ? 'মানবিক' : 'কমার্স')}</option>`
    ).join('');
    
    const { value: formValues } = await Swal.fire({
        title: 'কোর্স সম্পাদনা',
        html: `
            <style>
                .swal2-html-container { text-align: left !important; }
                .swal2-input, .swal2-textarea, .swal2-select { width: 100% !important; margin-bottom: 10px !important; }
            </style>
            <div class="text-left space-y-3">
                <div>
                    <label class="block text-xs font-bold mb-1">কোর্সের নাম</label>
                    <input id="edit-name" class="swal2-input" value="${group.name}">
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">ক্লাস/লেভেল</label>
                    <select id="edit-class" class="swal2-select">
                        ${classOptions}
                    </select>
                </div>
                <div id="edit-admission-stream-container" style="${group.classLevel === 'Admission' ? '' : 'display:none;'}">
                    <label class="block text-xs font-bold mb-1">শাখা (Admission)</label>
                    <select id="edit-admission-stream" class="swal2-select">
                        <option value="">সিলেক্ট করুন</option>
                        ${streamOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">বিবরণ</label>
                    <textarea id="edit-description" class="swal2-textarea" rows="3">${group.description || ''}</textarea>
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">জয়েন মেথড</label>
                    <select id="edit-join-method" class="swal2-select">
                        <option value="public" ${group.joinMethod === 'public' ? 'selected' : ''}>পাবলিক</option>
                        <option value="code" ${group.joinMethod === 'code' ? 'selected' : ''}>কোর্স কোড</option>
                        <option value="permission" ${group.joinMethod === 'permission' ? 'selected' : ''}>পারমিশন কী</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">নতুন কভার ইমেজ (অপশনাল)</label>
                    <input type="file" id="edit-image" accept="image/*" class="swal2-file" style="width:100%">
                    ${group.imageUrl ? `<p class="text-xs text-slate-500 mt-1">বর্তমান ছবি: <a href="${group.imageUrl}" target="_blank">দেখুন</a></p>` : ''}
                </div>
                ${group.joinMethod === 'permission' ? `
                <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200">
                    <p class="text-sm font-bold mb-2">পারমিশন কী ব্যবস্থাপনা</p>
                    ${group.permissionKey && !group.permissionKeyUsed ? `
                        <p class="text-xs">বর্তমান কী: <code class="bg-white px-2 py-1 rounded">${group.permissionKey}</code></p>
                        <button type="button" onclick="Teacher.copyPermissionKey('${group.permissionKey}')" class="mt-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs">কপি করুন</button>
                    ` : group.permissionKeyUsed ? `
                        <p class="text-xs text-red-500">পারমিশন কী ব্যবহৃত হয়ে গেছে</p>
                    ` : `
                        <p class="text-xs">কোনো পারমিশন কী তৈরি হয়নি</p>
                    `}
                    <button type="button" onclick="Teacher.generatePermissionKey('${groupId}')" class="mt-2 bg-emerald-600 text-white px-3 py-1 rounded text-xs">নতুন পারমিশন কী জেনারেট</button>
                    ${group.permissionKey && !group.permissionKeyUsed ? `
                        <button type="button" onclick="Teacher.revokePermissionKey('${groupId}')" class="mt-2 bg-red-100 text-red-700 px-3 py-1 rounded text-xs ml-2">রিভোক করুন</button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'সংরক্ষণ',
        preConfirm: () => {
            const name = document.getElementById('edit-name').value.trim();
            const classLevel = document.getElementById('edit-class').value;
            const description = document.getElementById('edit-description').value.trim();
            const joinMethod = document.getElementById('edit-join-method').value;
            const imageFile = document.getElementById('edit-image').files[0];
            
            let admissionStream = null;
            if (classLevel === 'Admission') {
                admissionStream = document.getElementById('edit-admission-stream').value;
                if (!admissionStream) {
                    Swal.showValidationMessage('শাখা সিলেক্ট করুন');
                    return false;
                }
            }
            
            if (!name) {
                Swal.showValidationMessage('কোর্সের নাম আবশ্যক');
                return false;
            }
            
            return { name, classLevel, admissionStream, description, joinMethod, imageFile };
        }
    });
    
    if (formValues) {
        try {
            Swal.fire({ title: 'আপডেট হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            const updateData = {
                name: formValues.name,
                classLevel: formValues.classLevel,
                admissionStream: formValues.admissionStream,
                description: formValues.description,
                joinMethod: formValues.joinMethod,
                updatedAt: new Date()
            };
            
            if (group.joinMethod === 'permission' && formValues.joinMethod !== 'permission') {
                updateData.permissionKey = null;
                updateData.permissionKeyUsed = false;
            }
            
            if (formValues.imageFile) {
                if (formValues.imageFile.size > 2 * 1024 * 1024) {
                    Swal.fire('ত্রুটি', 'ছবির সাইজ ২ এমবির বেশি', 'error');
                    return;
                }
                updateData.imageUrl = await Teacher.uploadCourseImage(formValues.imageFile, group.groupCode);
            }
            
            await updateDoc(doc(db, "groups", groupId), updateData);
            Object.assign(group, updateData);
            
            Swal.fire('সফল', 'কোর্স আপডেট হয়েছে', 'success').then(() => {
                Teacher.loadTeacherGroups();
                Teacher.loadGroupsForSwitcher();
            });
        } catch (error) {
            Swal.fire('ত্রুটি', 'আপডেট ব্যর্থ: ' + error.message, 'error');
        }
    }
    
    setTimeout(() => {
        const classSelect = document.getElementById('edit-class');
        const streamContainer = document.getElementById('edit-admission-stream-container');
        if (classSelect) {
            classSelect.addEventListener('change', () => {
                streamContainer.style.display = classSelect.value === 'Admission' ? 'block' : 'none';
            });
        }
    }, 100);
};

// ------------- পারমিশন কী জেনারেটর -------------
Teacher.generatePermissionKey = async (groupId) => {
    try {
        const generateKey = () => {
            const letters = 'abcdefghijklmnopqrstuvwxyz';
            const numbers = '0123456789';
            let key = '';
            for (let i = 0; i < 5; i++) key += letters.charAt(Math.floor(Math.random() * letters.length));
            key += '-';
            for (let i = 0; i < 5; i++) key += numbers.charAt(Math.floor(Math.random() * numbers.length));
            return key;
        };
        
        let newKey;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 20) {
            newKey = generateKey();
            const q = query(collection(db, "groups"), 
                where("permissionKey", "==", newKey),
                where("permissionKeyUsed", "==", false));
            const snap = await getDocs(q);
            if (snap.empty) isUnique = true;
            attempts++;
        }
        
        if (!isUnique) throw new Error('ইউনিক কী জেনারেট করা যায়নি, আবার চেষ্টা করুন');
        
        await updateDoc(doc(db, "groups", groupId), {
            permissionKey: newKey,
            permissionKeyUsed: false
        });
        
        const group = Teacher.teacherGroups.find(g => g.id === groupId);
        if (group) {
            group.permissionKey = newKey;
            group.permissionKeyUsed = false;
        }
        
        Swal.fire({
            title: 'পারমিশন কী তৈরি হয়েছে',
            html: `<p>নতুন পারমিশন কী:</p><code style="font-size:1.5rem;background:#f0f0f0;padding:5px 15px;border-radius:8px;">${newKey}</code>`,
            icon: 'success',
            confirmButtonText: 'কপি করুন'
        }).then(() => {
            navigator.clipboard.writeText(newKey);
            Swal.fire('কপি হয়েছে', 'পারমিশন কী ক্লিপবোর্ডে কপি করা হয়েছে', 'success');
        });
    } catch (error) {
        Swal.fire('ত্রুটি', error.message, 'error');
    }
};

Teacher.revokePermissionKey = async (groupId) => {
    const result = await Swal.fire({
        title: 'পারমিশন কী রিভোক করবেন?',
        text: 'বর্তমান পারমিশন কী অকার্যকর হয়ে যাবে।',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'রিভোক করুন'
    });
    
    if (result.isConfirmed) {
        await updateDoc(doc(db, "groups", groupId), {
            permissionKey: null,
            permissionKeyUsed: false
        });
        const group = Teacher.teacherGroups.find(g => g.id === groupId);
        if (group) {
            group.permissionKey = null;
            group.permissionKeyUsed = false;
        }
        Swal.fire('রিভোক হয়েছে', 'পারমিশন কী অকার্যকর করা হয়েছে', 'success');
        Teacher.loadTeacherGroups();
    }
};

Teacher.copyPermissionKey = (key) => {
    navigator.clipboard.writeText(key).then(() => {
        Swal.fire('কপি হয়েছে', 'পারমিশন কী কপি করা হয়েছে', 'success');
    });
};

// ------------- গ্রুপ মেনু টগল -------------
Teacher.toggleGroupMenu = (groupId) => {
    event.stopPropagation();
    document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
        if (dropdown.id !== `group-menu-${groupId}`) dropdown.classList.remove('show');
    });
    document.getElementById(`group-menu-${groupId}`)?.classList.toggle('show');
};

Teacher.toggleGroupSetting = async (groupId, setting, value) => {
    try {
        await updateDoc(doc(db, "groups", groupId), { [setting]: value, updatedAt: new Date() });
        const group = Teacher.teacherGroups.find(g => g.id === groupId);
        if (group) group[setting] = value;
    } catch (error) {
        Swal.fire('ত্রুটি', 'সেটিং আপডেট ব্যর্থ: ' + error.message, 'error');
    }
};

// ------------- শিক্ষার্থী তালিকা দেখা -------------
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
                        const s = studentDoc.data();
                        return { id: studentDoc.id, ...s, status: 'active', fullName: s.fullName || s.name || '' };
                    }
                } catch (e) {}
                return null;
            });
            students = (await Promise.all(studentPromises)).filter(s => s);
        }
        
        const reqQ = query(collection(db, "join_requests"), where("groupId", "==", groupId), where("status", "==", "pending"));
        const reqSnap = await getDocs(reqQ);
        const pendingStudents = [];
        reqSnap.forEach(doc => {
            const r = doc.data();
            pendingStudents.push({ id: doc.id, studentId: r.studentId, fullName: r.studentName, email: r.studentEmail, status: 'pending' });
        });
        
        const allStudents = [...students.map(s => ({ ...s, status: s.disabled ? 'disabled' : (s.blocked ? 'blocked' : 'active') })), ...pendingStudents];
        window.currentGroupStudents = allStudents;
        window.currentGroupId = groupId;
        
        document.getElementById('app-container').innerHTML = `
        <div class="pb-6">
            <button onclick="Router.teacher(AppState.currentPage)" class="mb-4 text-xs font-bold text-slate-500 dark:text-slate-400 bengali-text"><i class="fas fa-arrow-left"></i> ফিরে যান</button>
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-xl font-bold font-en text-slate-800 dark:text-white bengali-text">${group.name}</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text">${allStudents.length} জন ব্যবহারকারী</p>
                    ${group.description ? `<p class="text-xs text-slate-500 mt-1">${group.description}</p>` : ''}
                </div>
                <div class="group-code-container mt-0">
                    <span class="group-code-text">${group.groupCode}</span>
                    <button onclick="Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn"><i class="fas fa-copy"></i></button>
                </div>
            </div>
            <div class="bg-white dark:bg-dark-secondary rounded-xl p-4 mb-6 shadow-sm border dark:border-dark-tertiary">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium dark:text-white bengali-text">যোগদান সক্রিয়</span>
                        <label class="toggle-switch"><input type="checkbox" ${group.joinEnabled ? 'checked' : ''} onchange="Teacher.toggleGroupSetting('${group.id}', 'joinEnabled', this.checked)"><span class="toggle-slider"></span></label>
                    </div>
                    <div class="flex items-center justify-between border-l border-slate-100 dark:border-dark-tertiary pl-4">
                        <span class="text-sm font-medium dark:text-white bengali-text">অনুমোদন প্রয়োজন</span>
                        <label class="toggle-switch"><input type="checkbox" ${group.approvalRequired ? 'checked' : ''} onchange="Teacher.toggleGroupSetting('${group.id}', 'approvalRequired', this.checked)"><span class="toggle-slider"></span></label>
                    </div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 dark:border-dark-tertiary">
                    <p class="text-sm"><span class="font-bold">জয়েন মেথড:</span> ${{ 'public':'পাবলিক', 'code':'কোর্স কোড', 'permission':'পারমিশন কী' }[group.joinMethod] || 'কোর্স কোড'}</p>
                    ${group.joinMethod === 'permission' && group.permissionKey && !group.permissionKeyUsed ? `<p class="text-sm mt-1">পারমিশন কী: <code class="bg-slate-100 dark:bg-dark-tertiary px-2 py-1 rounded">${group.permissionKey}</code> <button onclick="Teacher.copyPermissionKey('${group.permissionKey}')" class="text-xs text-indigo-600 ml-2"><i class="fas fa-copy"></i></button></p>` : ''}
                </div>
            </div>
            <div class="search-bar-container mb-6">
                <input type="text" id="student-search-input" class="search-bar-input w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text" placeholder="নাম, ফোন, ইমেইল...">
                <i class="search-icon fas fa-search"></i>
                <button class="clear-search-btn" onclick="Teacher.clearStudentSearch()"><i class="fas fa-times"></i></button>
            </div>
            <div class="filter-tabs" id="student-filter-tabs">
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('all')">সব (${allStudents.length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('active')">সক্রিয় (${students.filter(s => !s.disabled && !s.blocked).length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('pending')">অপেক্ষমান (${pendingStudents.length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('disabled')">নিষ্ক্রিয় (${students.filter(s => s.disabled).length})</div>
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('blocked')">ব্লক (${students.filter(s => s.blocked).length})</div>
            </div>
            <div class="student-list-container" id="student-list"></div>
        </div>`;
        
        document.getElementById('student-search-input').addEventListener('input', Teacher.searchStudents);
        Teacher.filterStudents(initialFilter);
    } catch (error) {
        console.error(error);
        document.getElementById('app-container').innerHTML = '<div class="text-center p-10 text-red-500 bengali-text">শিক্ষার্থী লোড করতে ত্রুটি</div>';
    }
};

// js/teacher/groups.js
// গ্রুপ ও শিক্ষার্থী ম্যানেজমেন্ট (নতুন ফিচার: ক্লাস, বিবরণ, ছবি, জয়েন মেথড, পারমিশন কী)

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, addDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// ক্লাস লেভেল অপশন
const CLASS_LEVELS = ['6', '7', '8', 'SSC', 'HSC', 'Admission'];
const ADMISSION_STREAMS = ['Science', 'Humanities', 'Commerce'];

// ------------- ম্যানেজ গ্রুপ ভিউ (কোর্স তালিকা ও তৈরির ফর্ম) -------------
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
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">কোর্সের নাম <span class="text-red-500">*</span></label>
                            <input type="text" id="new-group-name" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm" placeholder="যেমনঃ ক্লাস ১০ ব্যাচ-১">
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">ক্লাস/লেভেল <span class="text-red-500">*</span></label>
                            <select id="new-group-class" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm">
                                <option value="">সিলেক্ট করুন</option>
                                ${CLASS_LEVELS.map(lvl => `<option value="${lvl}">${lvl === 'Admission' ? 'এডমিশন' : (lvl === 'SSC' ? 'এসএসসি' : (lvl === 'HSC' ? 'এইচএসসি' : lvl + 'ম শ্রেণী'))}</option>`).join('')}
                            </select>
                        </div>
                        <div id="admission-stream-container" class="hidden">
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">শাখা (Admission)</label>
                            <select id="new-group-admission-stream" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm">
                                <option value="">সিলেক্ট করুন</option>
                                <option value="Science">সায়েন্স</option>
                                <option value="Humanities">মানবিক</option>
                                <option value="Commerce">কমার্স</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">বিবরণ</label>
                            <textarea id="new-group-description" rows="3" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm" placeholder="কোর্স সম্পর্কে বিস্তারিত লিখুন..."></textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">কভার ইমেজ</label>
                            <input type="file" id="new-group-image" accept="image/*" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl text-sm">
                            <p class="text-[10px] text-slate-500 mt-1">সর্বোচ্চ ২ এমবি, আড়াআড়ি (landscape) সাইজ ভালো</p>
                            <div id="image-preview" class="mt-2 hidden">
                                <img id="preview-img" src="" alt="Preview" class="w-full h-32 object-cover rounded-lg border">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold mb-1 dark:text-white bengali-text text-slate-600">জয়েন মেথড <span class="text-red-500">*</span></label>
                            <select id="new-group-join-method" class="w-full p-3 border dark:border-dark-tertiary dark:bg-black dark:text-white rounded-xl bengali-text text-sm">
                                <option value="public">পাবলিক (যে কেউ জয়েন করতে পারবে)</option>
                                <option value="code">কোর্স কোড প্রয়োজন</option>
                                <option value="permission">পারমিশন কী প্রয়োজন</option>
                            </select>
                        </div>
                        <button onclick="Teacher.createFullGroup()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg text-sm hover:opacity-90 transition bengali-text">
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
    
    // ক্লাস সিলেক্টে Admission সিলেক্ট করলে স্ট্রিম অপশন দেখাবে
    const classSelect = document.getElementById('new-group-class');
    const streamContainer = document.getElementById('admission-stream-container');
    classSelect.addEventListener('change', () => {
        if (classSelect.value === 'Admission') {
            streamContainer.classList.remove('hidden');
        } else {
            streamContainer.classList.add('hidden');
        }
    });

    // ইমেজ প্রিভিউ
    const imageInput = document.getElementById('new-group-image');
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                Swal.fire('ত্রুটি', 'ছবির সাইজ ২ এমবির বেশি হতে পারবে না', 'error');
                imageInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('preview-img').src = event.target.result;
                document.getElementById('image-preview').classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
    
    await Teacher.loadTeacherGroups();
};

// নতুন পূর্ণাঙ্গ গ্রুপ তৈরি (ছবি সহ)
Teacher.createFullGroup = async () => {
    const name = document.getElementById('new-group-name').value.trim();
    const classLevel = document.getElementById('new-group-class').value;
    const description = document.getElementById('new-group-description').value.trim();
    const joinMethod = document.getElementById('new-group-join-method').value;
    const imageFile = document.getElementById('new-group-image').files[0];
    
    // ভ্যালিডেশন
    if (!name) return Swal.fire('ত্রুটি', 'কোর্সের নাম আবশ্যক', 'error');
    if (!classLevel) return Swal.fire('ত্রুটি', 'ক্লাস/লেভেল সিলেক্ট করুন', 'error');
    
    let admissionStream = null;
    if (classLevel === 'Admission') {
        admissionStream = document.getElementById('new-group-admission-stream').value;
        if (!admissionStream) return Swal.fire('ত্রুটি', 'অনুগ্রহ করে শাখা সিলেক্ট করুন', 'error');
    }
    
    try {
        Swal.fire({ title: 'কোর্স তৈরি হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        // কোর্স কোড জেনারেট (আগের মতোই)
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        let groupCode = '';
        for (let i = 0; i < 5; i++) groupCode += letters.charAt(Math.floor(Math.random() * letters.length));
        for (let i = 0; i < 5; i++) groupCode += numbers.charAt(Math.floor(Math.random() * numbers.length));
        
        let imageUrl = null;
        if (imageFile) {
            imageUrl = await Teacher.uploadCourseImage(imageFile, groupCode);
        }
        
        const groupData = {
            name,
            groupCode,
            classLevel,
            admissionStream: admissionStream || null,
            description: description || '',
            imageUrl: imageUrl || null,
            joinMethod,
            permissionKey: null,
            permissionKeyUsed: false,
            teacherId: AppState.currentUser.id,
            teacherName: AppState.currentUser.fullName,
            archived: false,
            approvalRequired: false,
            joinEnabled: true,
            studentIds: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const docRef = await addDoc(collection(db, "groups"), groupData);
        
        Swal.fire({
            title: 'কোর্স তৈরি হয়েছে!',
            html: `<div class="text-left">
                <p><strong>কোর্সের নাম:</strong> ${name}</p>
                <p><strong>কোর্স কোড:</strong> <code>${groupCode}</code></p>
                ${imageUrl ? '<p class="text-green-600"><i class="fas fa-check-circle"></i> কভার ইমেজ আপলোড হয়েছে</p>' : ''}
            </div>`,
            icon: 'success'
        }).then(() => {
            Teacher.loadTeacherGroups();
            Teacher.loadGroupsForSwitcher();
        });
    } catch (error) {
        Swal.fire('ত্রুটি', 'কোর্স তৈরি ব্যর্থ: ' + error.message, 'error');
    }
};

// Firebase Storage-এ ইমেজ আপলোড
Teacher.uploadCourseImage = async (file, groupCode) => {
    const storage = getStorage();
    const fileExt = file.name.split('.').pop();
    const fileName = `course-images/${AppState.currentUser.id}/${groupCode}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

// পূর্বের createGroupFromInput এখন নতুন ফর্ম ওপেন করবে
Teacher.createGroupFromInput = async () => {
    Teacher.manageGroupsView();
};

// ------------- শিক্ষকের সব কোর্স লোড করে UI-তে দেখানো (আপডেটেড কার্ড) -------------
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

            const classBadge = group.classLevel ? 
                `<span class="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">${group.classLevel === 'Admission' ? 'এডমিশন' : group.classLevel}</span>` : '';
            const joinMethodText = {
                'public': 'পাবলিক',
                'code': 'কোর্স কোড',
                'permission': 'পারমিশন কী'
            }[group.joinMethod] || 'কোর্স কোড';
            
            const imageHtml = group.imageUrl ? 
                `<img src="${group.imageUrl}" alt="${group.name}" class="w-full h-32 object-cover rounded-t-lg">` : 
                `<div class="w-full h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-lg"><i class="fas fa-book-open"></i></div>`;

            html += `
                <div class="group-card overflow-hidden" onclick="Teacher.viewGroupStudents('${group.id}')">
                    ${imageHtml}
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-lg dark:text-white bengali-text group-hover:text-indigo-600 transition">${group.name}</h3>
                            <div class="three-dot-menu relative">
                                <button class="three-dot-btn" onclick="event.stopPropagation(); Teacher.toggleGroupMenu('${group.id}')">
                                    <i class="fas fa-ellipsis-v text-slate-400"></i>
                                </button>
                                <div class="dot-menu-dropdown dark:bg-dark-secondary dark:border-dark-tertiary" id="group-menu-${group.id}">
                                    <div class="menu-item edit dark:text-blue-400 bengali-text" onclick="event.stopPropagation(); Teacher.editGroupDetails('${group.id}')">
                                        <i class="fas fa-edit"></i>
                                        সম্পাদনা
                                    </div>
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
                        <div class="flex flex-wrap gap-2 mb-2">
                            ${classBadge}
                            <span class="text-xs bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">${joinMethodText}</span>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">${group.description || 'কোনো বিবরণ নেই'}</p>
                        <div class="group-code-container mb-3" onclick="event.stopPropagation();">
                            <span class="group-code-text">${group.groupCode}</span>
                            <button onclick="Teacher.copyGroupCode('${group.groupCode}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>

                        <div class="grid grid-cols-4 gap-2 text-center text-[10px] uppercase font-bold tracking-wider">
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

// ------------- কোর্স সম্পাদনা -------------
Teacher.editGroupDetails = async (groupId) => {
    const group = Teacher.teacherGroups.find(g => g.id === groupId);
    if (!group) return;
    
    const classOptions = CLASS_LEVELS.map(lvl => 
        `<option value="${lvl}" ${group.classLevel === lvl ? 'selected' : ''}>${lvl === 'Admission' ? 'এডমিশন' : (lvl === 'SSC' ? 'এসএসসি' : (lvl === 'HSC' ? 'এইচএসসি' : lvl + 'ম শ্রেণী'))}</option>`
    ).join('');
    
    const streamOptions = ADMISSION_STREAMS.map(s => 
        `<option value="${s}" ${group.admissionStream === s ? 'selected' : ''}>${s === 'Science' ? 'সায়েন্স' : (s === 'Humanities' ? 'মানবিক' : 'কমার্স')}</option>`
    ).join('');
    
    const { value: formValues } = await Swal.fire({
        title: 'কোর্স সম্পাদনা',
        html: `
            <style>
                .swal2-html-container { text-align: left !important; }
                .swal2-input, .swal2-textarea, .swal2-select { width: 100% !important; margin-bottom: 10px !important; }
            </style>
            <div class="text-left space-y-3">
                <div>
                    <label class="block text-xs font-bold mb-1">কোর্সের নাম</label>
                    <input id="edit-name" class="swal2-input" value="${group.name}">
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">ক্লাস/লেভেল</label>
                    <select id="edit-class" class="swal2-select">
                        ${classOptions}
                    </select>
                </div>
                <div id="edit-admission-stream-container" style="${group.classLevel === 'Admission' ? '' : 'display:none;'}">
                    <label class="block text-xs font-bold mb-1">শাখা (Admission)</label>
                    <select id="edit-admission-stream" class="swal2-select">
                        <option value="">সিলেক্ট করুন</option>
                        ${streamOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">বিবরণ</label>
                    <textarea id="edit-description" class="swal2-textarea" rows="3">${group.description || ''}</textarea>
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">জয়েন মেথড</label>
                    <select id="edit-join-method" class="swal2-select">
                        <option value="public" ${group.joinMethod === 'public' ? 'selected' : ''}>পাবলিক</option>
                        <option value="code" ${group.joinMethod === 'code' ? 'selected' : ''}>কোর্স কোড</option>
                        <option value="permission" ${group.joinMethod === 'permission' ? 'selected' : ''}>পারমিশন কী</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">নতুন কভার ইমেজ (অপশনাল)</label>
                    <input type="file" id="edit-image" accept="image/*" class="swal2-file" style="width:100%">
                    ${group.imageUrl ? `<p class="text-xs text-slate-500 mt-1">বর্তমান ছবি: <a href="${group.imageUrl}" target="_blank">দেখুন</a></p>` : ''}
                </div>
                ${group.joinMethod === 'permission' ? `
                <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200">
                    <p class="text-sm font-bold mb-2">পারমিশন কী ব্যবস্থাপনা</p>
                    ${group.permissionKey && !group.permissionKeyUsed ? `
                        <p class="text-xs">বর্তমান কী: <code class="bg-white px-2 py-1 rounded">${group.permissionKey}</code></p>
                        <button type="button" onclick="Teacher.copyPermissionKey('${group.permissionKey}')" class="mt-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs">কপি করুন</button>
                    ` : group.permissionKeyUsed ? `
                        <p class="text-xs text-red-500">পারমিশন কী ব্যবহৃত হয়ে গেছে</p>
                    ` : `
                        <p class="text-xs">কোনো পারমিশন কী তৈরি হয়নি</p>
                    `}
                    <button type="button" onclick="Teacher.generatePermissionKey('${groupId}')" class="mt-2 bg-emerald-600 text-white px-3 py-1 rounded text-xs">নতুন পারমিশন কী জেনারেট</button>
                    ${group.permissionKey && !group.permissionKeyUsed ? `
                        <button type="button" onclick="Teacher.revokePermissionKey('${groupId}')" class="mt-2 bg-red-100 text-red-700 px-3 py-1 rounded text-xs ml-2">রিভোক করুন</button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'সংরক্ষণ',
        preConfirm: () => {
            const name = document.getElementById('edit-name').value.trim();
            const classLevel = document.getElementById('edit-class').value;
            const description = document.getElementById('edit-description').value.trim();
            const joinMethod = document.getElementById('edit-join-method').value;
            const imageFile = document.getElementById('edit-image').files[0];
            
            let admissionStream = null;
            if (classLevel === 'Admission') {
                admissionStream = document.getElementById('edit-admission-stream').value;
                if (!admissionStream) {
                    Swal.showValidationMessage('শাখা সিলেক্ট করুন');
                    return false;
                }
            }
            
            if (!name) {
                Swal.showValidationMessage('কোর্সের নাম আবশ্যক');
                return false;
            }
            
            return { name, classLevel, admissionStream, description, joinMethod, imageFile };
        }
    });
    
    if (formValues) {
        try {
            Swal.fire({ title: 'আপডেট হচ্ছে...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            const updateData = {
                name: formValues.name,
                classLevel: formValues.classLevel,
                admissionStream: formValues.admissionStream,
                description: formValues.description,
                joinMethod: formValues.joinMethod,
                updatedAt: new Date()
            };
            
            if (group.joinMethod === 'permission' && formValues.joinMethod !== 'permission') {
                updateData.permissionKey = null;
                updateData.permissionKeyUsed = false;
            }
            
            if (formValues.imageFile) {
                if (formValues.imageFile.size > 2 * 1024 * 1024) {
                    Swal.fire('ত্রুটি', 'ছবির সাইজ ২ এমবির বেশি', 'error');
                    return;
                }
                updateData.imageUrl = await Teacher.uploadCourseImage(formValues.imageFile, group.groupCode);
            }
            
            await updateDoc(doc(db, "groups", groupId), updateData);
            Object.assign(group, updateData);
            
            Swal.fire('সফল', 'কোর্স আপডেট হয়েছে', 'success').then(() => {
                Teacher.loadTeacherGroups();
                Teacher.loadGroupsForSwitcher();
            });
        } catch (error) {
            Swal.fire('ত্রুটি', 'আপডেট ব্যর্থ: ' + error.message, 'error');
        }
    }
    
    setTimeout(() => {
        const classSelect = document.getElementById('edit-class');
        const streamContainer = document.getElementById('edit-admission-stream-container');
        if (classSelect) {
            classSelect.addEventListener('change', () => {
                streamContainer.style.display = classSelect.value === 'Admission' ? 'block' : 'none';
            });
        }
    }, 100);
};

// ------------- পারমিশন কী জেনারেটর -------------
Teacher.generatePermissionKey = async (groupId) => {
    try {
        const generateKey = () => {
            const letters = 'abcdefghijklmnopqrstuvwxyz';
            const numbers = '0123456789';
            let key = '';
            for (let i = 0; i < 5; i++) key += letters.charAt(Math.floor(Math.random() * letters.length));
            key += '-';
            for (let i = 0; i < 5; i++) key += numbers.charAt(Math.floor(Math.random() * numbers.length));
            return key;
        };
        
        let newKey;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 20) {
            newKey = generateKey();
            const q = query(collection(db, "groups"), 
                where("permissionKey", "==", newKey),
                where("permissionKeyUsed", "==", false));
            const snap = await getDocs(q);
            if (snap.empty) isUnique = true;
            attempts++;
        }
        
        if (!isUnique) throw new Error('ইউনিক কী জেনারেট করা যায়নি, আবার চেষ্টা করুন');
        
        await updateDoc(doc(db, "groups", groupId), {
            permissionKey: newKey,
            permissionKeyUsed: false
        });
        
        const group = Teacher.teacherGroups.find(g => g.id === groupId);
        if (group) {
            group.permissionKey = newKey;
            group.permissionKeyUsed = false;
        }
        
        Swal.fire({
            title: 'পারমিশন কী তৈরি হয়েছে',
            html: `<p>নতুন পারমিশন কী:</p><code style="font-size:1.5rem;background:#f0f0f0;padding:5px 15px;border-radius:8px;">${newKey}</code>`,
            icon: 'success',
            confirmButtonText: 'কপি করুন'
        }).then(() => {
            navigator.clipboard.writeText(newKey);
            Swal.fire('কপি হয়েছে', 'পারমিশন কী ক্লিপবোর্ডে কপি করা হয়েছে', 'success');
        });
    } catch (error) {
        Swal.fire('ত্রুটি', error.message, 'error');
    }
};

Teacher.revokePermissionKey = async (groupId) => {
    const result = await Swal.fire({
        title: 'পারমিশন কী রিভোক করবেন?',
        text: 'বর্তমান পারমিশন কী অকার্যকর হয়ে যাবে।',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'রিভোক করুন'
    });
    
    if (result.isConfirmed) {
        await updateDoc(doc(db, "groups", groupId), {
            permissionKey: null,
            permissionKeyUsed: false
        });
        const group = Teacher.teacherGroups.find(g => g.id === groupId);
        if (group) {
            group.permissionKey = null;
            group.permissionKeyUsed = false;
        }
        Swal.fire('রিভোক হয়েছে', 'পারমিশন কী অকার্যকর করা হয়েছে', 'success');
        Teacher.loadTeacherGroups();
    }
};

Teacher.copyPermissionKey = (key) => {
    navigator.clipboard.writeText(key).then(() => {
        Swal.fire('কপি হয়েছে', 'পারমিশন কী কপি করা হয়েছে', 'success');
    });
};

// ------------- গ্রুপ মেনু টগল -------------
Teacher.toggleGroupMenu = (groupId) => {
    event.stopPropagation();
    document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
        if (dropdown.id !== `group-menu-${groupId}`) dropdown.classList.remove('show');
    });
    document.getElementById(`group-menu-${groupId}`)?.classList.toggle('show');
};

Teacher.toggleGroupSetting = async (groupId, setting, value) => {
    try {
        await updateDoc(doc(db, "groups", groupId), { [setting]: value, updatedAt: new Date() });
        const group = Teacher.teacherGroups.find(g => g.id === groupId);
        if (group) group[setting] = value;
    } catch (error) {
        Swal.fire('ত্রুটি', 'সেটিং আপডেট ব্যর্থ: ' + error.message, 'error');
    }
};

// ------------- শিক্ষার্থী তালিকা দেখা -------------
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
                        const s = studentDoc.data();
                        return { 
                            id: studentDoc.id, 
                            ...s, 
                            status: 'active',
                            fullName: s.fullName || s.name || '',
                            email: s.email || '',
                            phone: s.phone || '',
                            fatherPhone: s.fatherPhone || '',
                            motherPhone: s.motherPhone || '',
                            schoolName: s.schoolName || '',
                            collegeName: s.collegeName || '',
                            disabled: s.disabled || false,
                            blocked: s.blocked || false
                        };
                    }
                } catch (e) {}
                return null;
            });
            students = (await Promise.all(studentPromises)).filter(s => s);
        }
        
        const reqQ = query(collection(db, "join_requests"), where("groupId", "==", groupId), where("status", "==", "pending"));
        const reqSnap = await getDocs(reqQ);
        const pendingStudents = [];
        reqSnap.forEach(doc => {
            const r = doc.data();
            pendingStudents.push({ 
                id: doc.id, 
                studentId: r.studentId, 
                fullName: r.studentName, 
                email: r.studentEmail, 
                requestedAt: r.requestedAt,
                status: 'pending' 
            });
        });
        
        const allStudents = [
            ...students.map(s => ({ ...s, status: s.disabled ? 'disabled' : (s.blocked ? 'blocked' : 'active') })), 
            ...pendingStudents
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
                    ${group.description ? `<p class="text-xs text-slate-500 mt-1">${group.description}</p>` : ''}
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
                <div class="mt-4 pt-3 border-t border-slate-100 dark:border-dark-tertiary">
                    <p class="text-sm"><span class="font-bold">জয়েন মেথড:</span> ${{
                        'public': 'পাবলিক (যে কেউ জয়েন করতে পারবে)',
                        'code': 'কোর্স কোড প্রয়োজন',
                        'permission': 'পারমিশন কী প্রয়োজন'
                    }[group.joinMethod] || 'কোর্স কোড'}</p>
                    ${group.joinMethod === 'permission' && group.permissionKey && !group.permissionKeyUsed ? `
                        <p class="text-sm mt-1">পারমিশন কী: <code class="bg-slate-100 dark:bg-dark-tertiary px-2 py-1 rounded">${group.permissionKey}</code> 
                        <button onclick="Teacher.copyPermissionKey('${group.permissionKey}')" class="text-xs text-indigo-600 ml-2"><i class="fas fa-copy"></i></button></p>
                    ` : ''}
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
                <div class="filter-tab bengali-text" onclick="Teacher.filterStudents('active')">সক্রিয় (${students.filter(s => !s.disabled && !s.blocked).length})</div>
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

// ------------- শিক্ষার্থী তালিকা রেন্ডারিং ও ফিল্টারিং -------------
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
