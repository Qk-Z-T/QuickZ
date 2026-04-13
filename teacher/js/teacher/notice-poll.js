// js/teacher/notice-poll.js
// নোটিশ ও পোল ম্যানেজমেন্ট

import { Teacher } from './teacher-core.js';
import { db } from '../config/firebase.js';
import { AppState } from '../core/state.js';
import { 
    collection, addDoc, query, where, orderBy, getDocs, doc, getDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ------------- নোটিশ ম্যানেজমেন্ট ভিউ -------------
Teacher.noticeManagementView = async () => {
    if (!AppState.selectedGroup) {
        Teacher.selectGroupView('management');
        return;
    }
    const c = document.getElementById('app-container');
    c.innerHTML = `
    <div class="pb-6">
        <div class="flex items-center gap-3 mb-6">
            <button onclick="Router.teacher(AppState.currentPage)" class="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-dark-secondary border dark:border-dark-tertiary px-3 py-2 rounded-lg transition bengali-text">
                <i class="fas fa-arrow-left"></i> ফিরে যান
            </button>
            <h2 class="text-xl font-bold dark:text-white bengali-text">নোটিশ ও পোল</h2>
        </div>
        <div class="flex justify-between items-center mb-5">
            <p class="text-sm text-slate-500 dark:text-slate-400 bengali-text">কোর্সের জন্য নোটিশ বা পোল তৈরি করুন ও পরিচালনা করুন</p>
            <button onclick="Teacher.createNoticeForm()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 bengali-text">
                <i class="fas fa-plus"></i> নতুন তৈরি
            </button>
        </div>
        <div id="notice-list-container" class="space-y-4">
            <div class="text-center p-8 text-slate-400 bengali-text">লোড হচ্ছে...</div>
        </div>
    </div>`;

    await Teacher.loadNotices();
};

Teacher.loadNotices = async () => {
    const q = query(
        collection(db, "notices"),
        where("groupId", "==", AppState.selectedGroup.id),
        orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const notices = [];
    snap.forEach(d => notices.push({ id: d.id, ...d.data() }));

    const container = document.getElementById('notice-list-container');
    if (notices.length === 0) {
        container.innerHTML = `<div class="text-center p-8 text-slate-400 bengali-text">কোনো নোটিশ বা পোল নেই</div>`;
        return;
    }

    let html = '';
    notices.forEach(n => {
        const isPoll = n.type === 'poll';
        const viewCount = Object.keys(n.views || {}).length;
        const voteCount = isPoll ? Object.keys(n.votes || {}).length : 0;
        let pollStatsHtml = '';
        if (isPoll && n.options && n.options.length > 0) {
            const votes = n.votes || {};
            const totalVotes = Object.keys(votes).length;
            const counts = {};
            n.options.forEach((_, i) => { counts[i] = 0; });
            Object.values(votes).forEach(optIdx => {
                if (counts[optIdx] !== undefined) counts[optIdx]++;
            });
            const pollColors = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899'];
            pollStatsHtml = `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">পোল ফলাফল · মোট ${totalVotes} ভোট</div>`;
            n.options.forEach((opt, i) => {
                const count = counts[i] || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const col = pollColors[i % pollColors.length];
                pollStatsHtml += `<div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                        <span style="font-size:12px;font-weight:600;color:#374151;font-family:'Hind Siliguri',sans-serif;">${opt}</span>
                        <span style="font-size:11px;color:#64748b;font-weight:700;">${count} জন (${pct}%)</span>
                    </div>
                    <div style="background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden;">
                        <div style="background:${col};height:100%;width:${pct}%;border-radius:6px;min-width:${pct>0?'3px':'0'};"></div>
                    </div>
                </div>`;
            });
            pollStatsHtml += '</div>';
        }

    html += `
        <div class="bg-white dark:bg-dark-secondary p-4 rounded-xl border dark:border-dark-tertiary" style="transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
            <div class="flex justify-between items-start">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span class="text-xs font-bold px-2 py-1 rounded ${isPoll ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                            ${isPoll ? '📊 পোল' : '📢 নোটিশ'}
                        </span>
                        <span style="font-size:11px;color:#94a3b8;">📅 ${moment(n.createdAt.toDate()).format('DD MMM, YYYY')}</span>
                    </div>
                    <h3 class="font-bold text-base mt-1 dark:text-white bengali-text">${n.title}</h3>
                    ${!isPoll ? `<p class="text-sm text-slate-600 dark:text-slate-300 bengali-text mt-1" style="line-height:1.5;">${(n.content || '').substring(0, 120)}${(n.content||'').length > 120 ? '...' : ''}</p>` : ''}
                    <div class="flex gap-4 mt-2" style="font-size:12px;">
                        <span class="cursor-pointer hover:underline" style="color:#64748b;" onclick="Teacher.showViewers('${n.id}')">
                            👁️ ${viewCount} জন দেখেছেন
                        </span>
                    </div>
                    ${pollStatsHtml}
                </div>
                <div class="flex gap-2" style="margin-left:12px;flex-shrink:0;">
                    <button onclick="Teacher.deleteNotice('${n.id}')" class="text-red-500 hover:text-red-700" style="padding:6px 8px;border-radius:6px;border:1px solid #fecaca;background:#fff5f5;font-size:12px;" title="মুছুন"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

Teacher.createNoticeForm = () => {
    const c = document.getElementById('app-container');
    c.innerHTML = `
    <div class="p-0 max-w-3xl">
        <button onclick="Teacher.noticeManagementView()" class="mb-4 text-xs font-bold text-slate-500 bengali-text">
            <i class="fas fa-arrow-left"></i> ফিরে যান
        </button>
        <h2 class="text-xl font-bold mb-4 dark:text-white bengali-text">নতুন নোটিশ / পোল</h2>
        <div class="bg-white dark:bg-dark-secondary p-5 rounded-2xl shadow-sm border">
            <div class="mb-4">
                <label class="block text-sm font-bold mb-1 dark:text-white">ধরন</label>
                <select id="notice-type" class="w-full p-3 border rounded-xl dark:bg-black" onchange="Teacher.toggleNoticeType()">
                    <option value="notice">সাধারণ নোটিশ</option>
                    <option value="poll">পোল</option>
                </select>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-bold mb-1 dark:text-white">শিরোনাম</label>
                <input id="notice-title" class="w-full p-3 border rounded-xl dark:bg-black bengali-text" placeholder="শিরোনাম লিখুন">
            </div>
            <div id="notice-content-field" class="mb-4">
                <label class="block text-sm font-bold mb-1 dark:text-white">বিস্তারিত</label>
                <textarea id="notice-content" rows="4" class="w-full p-3 border rounded-xl dark:bg-black bengali-text" placeholder="নোটিশের বিস্তারিত..."></textarea>
            </div>
            <div id="poll-options-container" class="hidden mb-4">
                <label class="block text-sm font-bold mb-2 dark:text-white">পোল অপশন</label>
                <div id="poll-options-list">
                    <div class="flex gap-2 mb-2">
                        <input type="text" class="poll-option-input flex-1 p-2 border rounded dark:bg-black" placeholder="অপশন ১">
                        <button onclick="Teacher.addPollOption()" class="px-3 bg-slate-200 rounded">+</button>
                    </div>
                </div>
            </div>
            <button onclick="Teacher.saveNotice()" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">প্রকাশ করুন</button>
        </div>
    </div>`;

    window.pollOptionCount = 1;
};

Teacher.toggleNoticeType = () => {
    const type = document.getElementById('notice-type').value;
    if (type === 'poll') {
        document.getElementById('notice-content-field').classList.add('hidden');
        document.getElementById('poll-options-container').classList.remove('hidden');
    } else {
        document.getElementById('notice-content-field').classList.remove('hidden');
        document.getElementById('poll-options-container').classList.add('hidden');
    }
};

Teacher.addPollOption = () => {
    window.pollOptionCount++;
    const container = document.getElementById('poll-options-list');
    const div = document.createElement('div');
    div.className = 'flex gap-2 mb-2';
    div.innerHTML = `
        <input type="text" class="poll-option-input flex-1 p-2 border rounded dark:bg-black" placeholder="অপশন ${window.pollOptionCount}">
        <button onclick="this.parentElement.remove()" class="px-3 bg-red-100 text-red-600 rounded">×</button>
    `;
    container.appendChild(div);
};

Teacher.saveNotice = async () => {
    const type = document.getElementById('notice-type').value;
    const title = document.getElementById('notice-title').value.trim();
    if (!title) return Swal.fire('ত্রুটি', 'শিরোনাম আবশ্যক', 'error');

    let content = '';
    let options = [];
    if (type === 'notice') {
        content = document.getElementById('notice-content').value.trim();
        if (!content) return Swal.fire('ত্রুটি', 'বিস্তারিত লিখুন', 'error');
    } else {
        const inputs = document.querySelectorAll('.poll-option-input');
        inputs.forEach(inp => {
            const val = inp.value.trim();
            if (val) options.push(val);
        });
        if (options.length < 2) return Swal.fire('ত্রুটি', 'কমপক্ষে দুটি অপশন দিন', 'error');
    }

    const data = {
        groupId: AppState.selectedGroup.id,
        teacherId: AppState.currentUser.id,
        teacherName: AppState.currentUser.fullName,
        title,
        content,
        type,
        options: type === 'poll' ? options : [],
        createdAt: new Date(),
        updatedAt: new Date(),
        views: {},
        votes: {}
    };

    await addDoc(collection(db, "notices"), data);
    Swal.fire('সফল', 'প্রকাশিত হয়েছে', 'success');
    Teacher.noticeManagementView();
};

Teacher.showViewers = async (noticeId) => {
    const docSnap = await getDoc(doc(db, "notices", noticeId));
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    const views = data.views || {};
    const studentIds = Object.keys(views);
    if (studentIds.length === 0) {
        Swal.fire('কেউ দেখেনি', 'এখনো কেউ এই নোটিশটি দেখেনি', 'info');
        return;
    }

    const names = [];
    for (const sid of studentIds) {
        const sDoc = await getDoc(doc(db, "students", sid));
        if (sDoc.exists()) {
            const s = sDoc.data();
            names.push(`${s.name || s.fullName || 'নাম নেই'} (${moment(views[sid].toDate()).format('DD MMM, h:mm A')})`);
        }
    }

    Swal.fire({
        title: 'যারা দেখেছেন',
        html: names.join('<br>'),
        icon: 'info'
    });
};

Teacher.deleteNotice = async (id) => {
    const confirm = await Swal.fire({ title: 'মুছে ফেলবেন?', icon: 'warning', showCancelButton: true });
    if (confirm.isConfirmed) {
        await deleteDoc(doc(db, "notices", id));
        Teacher.noticeManagementView();
    }
};
