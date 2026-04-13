// js/ui.js
// UI utilities and skeleton loaders

export function renderRankSkeleton() {
    return `
    <div class="p-5 pb-20">
        ${Array(5).fill().map(() => `
            <div class="skeleton-card p-4 mb-3">
                <div class="skeleton-line short mb-2"></div>
                <div class="skeleton-line medium"></div>
            </div>
        `).join('')}
    </div>`;
}

export function renderAnalysisSkeleton() {
    return `
    <div class="p-5 pb-20">
        ${Array(3).fill().map(() => `
            <div class="analysis-stat-card">
                <div class="skeleton-line short mb-3"></div>
                <div class="skeleton-line medium"></div>
            </div>
        `).join('')}
    </div>`;
}

export function renderProfileSkeleton() {
    return `
    <div class="p-5 max-w-md mx-auto">
        <div class="profile-form-container">
            <div class="skeleton-line short mb-4" style="height: 80px; width: 80px; border-radius: 50%; margin: 0 auto;"></div>
            <div class="skeleton-line short mb-2"></div>
            <div class="skeleton-line medium mb-4"></div>
            ${Array(4).fill().map(() => `
                <div class="skeleton-line mb-3"></div>
            `).join('')}
        </div>
    </div>`;
}

export function renderManagementSkeleton() {
    return `
    <div class="p-5 pb-20 max-w-md mx-auto">
        <h2 class="text-2xl font-bold mb-4 text-center">ম্যানেজমেন্ট</h2>
        <div class="skeleton-line short mb-4"></div>
        <div class="skeleton-line medium mb-4"></div>
        <div class="skeleton-line mb-4"></div>
        <div class="skeleton-line short"></div>
    </div>`;
}

export function renderResultsSkeleton() {
    return `
    <div class="p-5 pb-20">
        <div class="result-tabs justify-center">
            <div class="skeleton w-16 h-8 mx-2"></div>
            <div class="skeleton w-16 h-8 mx-2"></div>
        </div>
        <div class="mt-6 space-y-4">
            ${Array(4).fill().map(() => `
                <div class="skeleton-card p-4">
                    <div class="skeleton-line short mb-2"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            `).join('')}
        </div>
    </div>`;
}
