// ========== কোর্সসমূহ পেজ ==========
Student.loadCourses = async () => {
    const c = document.getElementById('app-container');
    c.innerHTML = renderHeader('courses') + `
        <div class="p-5 pb-20">
            <h2 class="text-2xl font-bold mb-4 text-center">কোর্সসমূহ</h2>
            <div class="text-center p-10"><div class="loader mx-auto"></div></div>
        </div>
    `;

    try {
        // সব গ্রুপ যেখানে archived: false এবং joinEnabled: true
        const q = query(
            collection(db, "groups"),
            where("archived", "==", false),
            where("joinEnabled", "==", true)
        );
        const snap = await getDocs(q);
        const allGroups = [];
        snap.forEach(doc => allGroups.push({ id: doc.id, ...doc.data() }));

        // শিক্ষার্থীর প্রোফাইল থেকে classLevel ও admissionStream নেওয়া
        const studentClass = AppState.classLevel || '';
        const studentStream = AppState.admissionStream || '';

        // ইতিমধ্যে জয়েন করা গ্রুপের আইডি
        const joinedGroupIds = (AppState.joinedGroups || []).map(g => g.groupId);

        // UI রেন্ডার
        window.allCoursesList = allGroups;
        Student.renderCourseList();
    } catch (error) {
        console.error(error);
        c.innerHTML = renderHeader('courses') + `<div class="p-5 text-center text-red-500">কোর্স লোড করতে ত্রুটি</div>`;
    }
};

Student.renderCourseList = () => {
    const c = document.getElementById('app-container');
    const allGroups = window.allCoursesList || [];
    const studentClass = AppState.classLevel || '';
    const studentStream = AppState.admissionStream || '';
    const joinedGroupIds = (AppState.joinedGroups || []).map(g => g.groupId);

    // ফিল্টার অপশন
    const filterClass = document.getElementById('course-filter-class')?.value || 'all';
    const searchTerm = document.getElementById('course-search-input')?.value.toLowerCase().trim() || '';

    let filtered = allGroups.filter(g => {
        // আর্কাইভ ও জয়েন এনাবল্ড চেক (query তেই করা আছে)
        // ক্লাস ফিল্টার
        if (filterClass !== 'all') {
            if (filterClass === 'Admission') {
                if (g.classLevel !== 'Admission') return false;
                // Admission স্ট্রিম ফিল্টার (যদি থাকে)
                const streamFilter = document.getElementById('course-filter-stream')?.value;
                if (streamFilter && streamFilter !== 'all' && g.admissionStream !== streamFilter) return false;
            } else {
                if (g.classLevel !== filterClass) return false;
            }
        }
        // সার্চ (নাম, শিক্ষক, বিবরণ)
        if (searchTerm) {
            const name = (g.name || '').toLowerCase();
            const teacher = (g.teacherName || '').toLowerCase();
            const desc = (g.description || '').toLowerCase();
            if (!name.includes(searchTerm) && !teacher.includes(searchTerm) && !desc.includes(searchTerm)) return false;
        }
        return true;
    });

    // শিক্ষার্থীর ক্লাস অনুযায়ী সাজানো (নিজের ক্লাস আগে)
    filtered.sort((a, b) => {
        if (a.classLevel === studentClass && b.classLevel !== studentClass) return -1;
        if (a.classLevel !== studentClass && b.classLevel === studentClass) return 1;
        return 0;
    });

    // ক্লাস লেভেলের ইউনিক তালিকা (ফিল্টার ড্রপডাউনের জন্য)
    const classLevels = ['6', '7', '8', 'SSC', 'HSC', 'Admission'];
    const classOptions = classLevels.map(lvl => `<option value="${lvl}">${lvl === 'Admission' ? 'এডমিশন' : (lvl === 'SSC' ? 'এসএসসি' : (lvl === 'HSC' ? 'এইচএসসি' : lvl+'ম শ্রেণী'))}</option>`).join('');

    // Admission স্ট্রিম ড্রপডাউন
    const streamOptions = `
        <option value="all">সব শাখা</option>
        <option value="Science">সায়েন্স</option>
        <option value="Humanities">মানবিক</option>
        <option value="Commerce">কমার্স</option>
    `;

    let html = `
    <div class="p-5 pb-20">
        <h2 class="text-2xl font-bold mb-2 text-center">কোর্সসমূহ</h2>
        <p class="text-sm text-slate-500 mb-4 text-center">আপনার পছন্দের কোর্স খুঁজুন ও জয়েন করুন</p>
        
        <!-- ফিল্টার বার -->
        <div class="bg-white dark:bg-dark-secondary p-4 rounded-xl shadow-sm border mb-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label class="block text-xs font-bold mb-1">সার্চ</label>
                    <input type="text" id="course-search-input" class="w-full p-2 border rounded-lg text-sm" placeholder="কোর্সের নাম, শিক্ষক...">
                </div>
                <div>
                    <label class="block text-xs font-bold mb-1">ক্লাস/লেভেল</label>
                    <select id="course-filter-class" class="w-full p-2 border rounded-lg text-sm">
                        <option value="all">সব ক্লাস</option>
                        ${classOptions}
                    </select>
                </div>
                <div id="stream-filter-container" style="display:none;">
                    <label class="block text-xs font-bold mb-1">শাখা</label>
                    <select id="course-filter-stream" class="w-full p-2 border rounded-lg text-sm">
                        ${streamOptions}
                    </select>
                </div>
                <div class="flex items-end">
                    <button onclick="Student.applyCourseFilter()" class="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">ফিল্টার</button>
                </div>
            </div>
            ${studentClass ? `<p class="text-xs text-indigo-600 mt-3"><i class="fas fa-graduation-cap"></i> আপনার ক্লাস: ${studentClass} ${studentStream ? '('+studentStream+')' : ''}</p>` : ''}
        </div>
        
        <!-- কোর্স তালিকা -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="course-list-container">
            ${Student.renderCourseCards(filtered, joinedGroupIds)}
        </div>
    </div>
    `;

    c.innerHTML = renderHeader('courses') + html;

    // Admission সিলেক্ট করলে স্ট্রিম ড্রপডাউন দেখানোর লজিক
    const classSelect = document.getElementById('course-filter-class');
    const streamContainer = document.getElementById('stream-filter-container');
    if (classSelect) {
        classSelect.addEventListener('change', function() {
            if (this.value === 'Admission') {
                streamContainer.style.display = 'block';
            } else {
                streamContainer.style.display = 'none';
            }
        });
        // প্রাথমিক অবস্থা
        if (classSelect.value === 'Admission') streamContainer.style.display = 'block';
    }

    // সার্চ ইনপুটে এন্টার চাপলে ফিল্টার
    const searchInput = document.getElementById('course-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') Student.applyCourseFilter();
        });
    }
};

Student.renderCourseCards = (groups, joinedGroupIds) => {
    if (groups.length === 0) {
        return `<div class="col-span-2 text-center p-10 text-slate-400">কোনো কোর্স পাওয়া যায়নি</div>`;
    }

    return groups.map(group => {
        const isJoined = joinedGroupIds.includes(group.id);
        const joinMethodText = {
            'public': 'পাবলিক',
            'code': 'কোর্স কোড',
            'permission': 'পারমিশন কী'
        }[group.joinMethod] || 'কোর্স কোড';

        const classBadge = group.classLevel ? 
            `<span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${group.classLevel === 'Admission' ? 'এডমিশন' : group.classLevel}</span>` : '';
        
        const streamBadge = group.admissionStream ? 
            `<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">${group.admissionStream}</span>` : '';

        // ছবি পরবর্তীতে, এখন শুধু গ্রেডিয়েন্ট
        const imageHtml = group.imageUrl ? 
            `<img src="${group.imageUrl}" class="w-full h-36 object-cover rounded-t-xl">` : 
            `<div class="w-full h-36 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-3xl text-indigo-400 rounded-t-xl"><i class="fas fa-book-open"></i></div>`;

        const actionButton = isJoined ? 
            `<button class="w-full bg-green-100 text-green-700 py-2 rounded-lg text-sm font-bold" disabled><i class="fas fa-check-circle"></i> জয়েন করেছেন</button>` :
            `<button onclick="Student.joinCourse('${group.id}', '${group.joinMethod}', '${group.groupCode || ''}')" class="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">জয়েন করুন</button>`;

        return `
        <div class="bg-white dark:bg-dark-secondary rounded-xl shadow-sm border overflow-hidden">
            ${imageHtml}
            <div class="p-4">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg">${group.name}</h3>
                    <div class="flex gap-1">${classBadge} ${streamBadge}</div>
                </div>
                <p class="text-xs text-slate-500 mb-1"><i class="fas fa-user-tie"></i> ${group.teacherName || 'শিক্ষক'}</p>
                <p class="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">${group.description || 'কোনো বিবরণ নেই'}</p>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs bg-slate-100 dark:bg-dark-tertiary px-2 py-1 rounded-full">${joinMethodText}</span>
                    <span class="text-xs"><i class="fas fa-users"></i> ${group.studentIds?.length || 0} শিক্ষার্থী</span>
                </div>
                ${actionButton}
            </div>
        </div>`;
    }).join('');
};

Student.applyCourseFilter = () => {
    Student.renderCourseList();
};

Student.joinCourse = async (groupId, joinMethod, groupCode) => {
    if (!navigator.onLine) {
        Swal.fire('অফলাইন', 'ইন্টারনেট সংযোগ ছাড়া কোর্সে জয়েন করা যাবে না।', 'warning');
        return;
    }

    try {
        // পাবলিক হলে সরাসরি জয়েন
        if (joinMethod === 'public') {
            await Student.addToGroupDirectly(groupId);
            return;
        }

        // কোর্স কোড প্রয়োজন
        if (joinMethod === 'code') {
            const { value: code } = await Swal.fire({
                title: 'কোর্স কোড লিখুন',
                input: 'text',
                inputPlaceholder: 'কোর্স কোড',
                showCancelButton: true,
                inputValidator: (val) => !val ? 'কোর্স কোড আবশ্যক' : null
            });
            if (!code) return;
            if (code !== groupCode) {
                Swal.fire('ত্রুটি', 'ভুল কোর্স কোড', 'error');
                return;
            }
            await Student.addToGroupDirectly(groupId);
            return;
        }

        // পারমিশন কী প্রয়োজন
        if (joinMethod === 'permission') {
            const { value: key } = await Swal.fire({
                title: 'পারমিশন কী লিখুন',
                input: 'text',
                inputPlaceholder: 'যেমন: abcde-12345',
                showCancelButton: true,
                inputValidator: (val) => !val ? 'পারমিশন কী আবশ্যক' : null
            });
            if (!key) return;

            // গ্রুপের ডেটা আবার ফেচ করে চেক
            const groupDoc = await getDoc(doc(db, "groups", groupId));
            if (!groupDoc.exists()) throw new Error("কোর্স নেই");
            const group = groupDoc.data();

            if (group.permissionKey !== key || group.permissionKeyUsed) {
                Swal.fire('ত্রুটি', 'ভুল বা ব্যবহৃত পারমিশন কী', 'error');
                return;
            }

            // পারমিশন কী ব্যবহার করা হয়েছে মার্ক করা
            await updateDoc(doc(db, "groups", groupId), {
                permissionKeyUsed: true
            });

            await Student.addToGroupDirectly(groupId);
        }
    } catch (error) {
        Swal.fire('ত্রুটি', error.message, 'error');
    }
};

Student.addToGroupDirectly = async (groupId) => {
    const user = auth.currentUser;
    if (!user) return;

    // ইতিমধ্যে জয়েন করা কিনা চেক
    if ((AppState.joinedGroups || []).find(g => g.groupId === groupId)) {
        Swal.fire('তথ্য', 'আপনি ইতিমধ্যে এই কোর্সে জয়েন করেছেন', 'info');
        return;
    }

    // গ্রুপের তথ্য নেওয়া
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if (!groupSnap.exists()) throw new Error("কোর্স নেই");
    const groupData = groupSnap.data();

    // approvalRequired চেক
    if (groupData.approvalRequired) {
        // জয়েন রিকোয়েস্ট তৈরি
        await addDoc(collection(db, "join_requests"), {
            studentId: user.uid,
            studentName: AppState.userProfile?.name || user.displayName,
            studentEmail: user.email,
            groupId: groupId,
            teacherId: groupData.teacherId,
            status: 'pending',
            requestedAt: new Date()
        });
        Swal.fire('অনুরোধ পাঠানো হয়েছে', 'শিক্ষক অনুমোদন করলে আপনি কোর্সে যুক্ত হবেন।', 'success');
        return;
    }

    // সরাসরি যুক্ত হওয়া
    const studentIds = groupData.studentIds || [];
    if (!studentIds.includes(user.uid)) {
        studentIds.push(user.uid);
        await updateDoc(doc(db, "groups", groupId), { studentIds });
    }

    // শিক্ষার্থীর joinedGroups আপডেট
    const joined = AppState.joinedGroups || [];
    joined.push({ groupId, groupName: groupData.name, teacherCode: groupData.teacherCode });
    await updateDoc(doc(db, "students", user.uid), { joinedGroups: joined });

    AppState.joinedGroups = joined;
    AppState.activeGroupId = groupId;
    localStorage.setItem('activeGroupId', groupId);
    localStorage.setItem('userProfile', JSON.stringify(AppState.userProfile));

    Swal.fire('সফল', `"${groupData.name}" কোর্সে জয়েন করেছেন`, 'success').then(() => {
        refreshExamCache();
        Router.student('dashboard');
    });
};
