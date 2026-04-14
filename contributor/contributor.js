// contributor/contributor.js

// গ্লোবাল অ্যারে থেকে কন্ট্রিবিউটর ডাটা পড়া
function getContributors() {
    return window.__CONTRIBUTORS__ || [];
}

// কার্ড জেনারেটর
function generateContributorCards() {
    const grid = document.getElementById('contributor-grid');
    if (!grid) return;
    
    const contributors = getContributors();
    grid.innerHTML = '';
    
    if (contributors.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                <i class="fas fa-users-slash text-4xl mb-4 opacity-50"></i>
                <p class="bengali text-lg">এখনো কোনো কন্ট্রিবিউটর যুক্ত করা হয়নি।</p>
            </div>
        `;
        return;
    }
    
    contributors.forEach(contributor => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'card-container';
        
        // ছবি থাকলে দেখানো
        const imgHtml = contributor.image 
            ? `<img src="${contributor.image}" alt="${contributor.name}" onerror="this.style.display='none'">`
            : '';
        
        // বিস্তারিত তথ্য (details array)
        const detailsHtml = (contributor.details || []).map(d => `
            <p class="text-left text-sm">
                <strong class="text-slate-800 dark:text-slate-200">
                    <i class="fas ${d.icon} text-indigo-500 dark:text-indigo-400 w-5"></i> ${d.label}:
                </strong> ${d.value}
            </p>
        `).join('');
        
        // সোশ্যাল লিংক
        const socialHtml = `
            <div class="flex gap-3 mt-4">
                ${contributor.social?.github ? `<a href="${contributor.social.github}" target="_blank" class="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><i class="fab fa-github text-xl"></i></a>` : ''}
                ${contributor.social?.linkedin ? `<a href="${contributor.social.linkedin}" target="_blank" class="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><i class="fab fa-linkedin text-xl"></i></a>` : ''}
                ${contributor.social?.twitter ? `<a href="${contributor.social.twitter}" target="_blank" class="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><i class="fab fa-twitter text-xl"></i></a>` : ''}
                ${contributor.social?.website ? `<a href="${contributor.social.website}" target="_blank" class="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><i class="fas fa-globe text-xl"></i></a>` : ''}
            </div>
        `;
        
        cardWrapper.innerHTML = `
            <div class="card-flip" onclick="this.classList.toggle('is-flipped')">
                <div class="card-face card-front">
                    <div class="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <i class="fas ${contributor.fallbackIcon || 'fa-user-circle'} text-7xl opacity-50"></i>
                    </div>
                    ${imgHtml}
                    <div class="overlay-text en">Tap to Reveal</div>
                </div>
                <div class="card-face card-back">
                    <div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                        <i class="fas fa-laptop-code text-2xl"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-800 dark:text-white en mb-1">${contributor.name}</h2>
                    <p class="text-sm font-medium text-indigo-500 dark:text-indigo-400 mb-5 en">${contributor.title}</p>
                    <div class="w-full space-y-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-4 en border border-slate-100 dark:border-slate-700">
                        ${detailsHtml}
                    </div>
                    ${socialHtml}
                    <div class="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1 cursor-pointer en font-medium" onclick="event.stopPropagation(); this.closest('.card-flip').classList.toggle('is-flipped')">
                        <i class="fas fa-undo"></i> Click to Flip Back
                    </div>
                </div>
            </div>
        `;
        
        grid.appendChild(cardWrapper);
    });
}

// থিম টগল (আগের মতোই)
function initThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const htmlElement = document.documentElement;
    const themeOverlay = document.getElementById('theme-overlay');
    let isAnimating = false;
    const animDuration = 450;

    const disableTransitions = () => {
        let style = document.getElementById('temp-disable-transitions');
        if (!style) {
            style = document.createElement('style');
            style.id = 'temp-disable-transitions';
            style.innerHTML = '* { transition: none !important; }';
            document.head.appendChild(style);
        }
    };

    const enableTransitions = () => {
        const style = document.getElementById('temp-disable-transitions');
        if (style) style.remove();
    };

    function updateIconState(isDark) {
        if (isDark) {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            themeIcon.classList.add('text-amber-400');
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            themeIcon.classList.remove('text-amber-400');
        }
    }

    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        disableTransitions();
        htmlElement.classList.add('dark');
        updateIconState(true);
        requestAnimationFrame(() => requestAnimationFrame(() => enableTransitions()));
    }

    themeToggleBtn.addEventListener('click', (e) => {
        if (isAnimating) return;
        isAnimating = true;

        const isDark = htmlElement.classList.contains('dark');
        const rect = themeToggleBtn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const maxRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        if (!isDark) {
            themeOverlay.classList.remove('hidden');
            themeOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    themeOverlay.style.transition = `clip-path ${animDuration}ms ease-out`;
                    themeOverlay.style.clipPath = `circle(${maxRadius}px at ${x}px ${y}px)`;
                });
            });

            setTimeout(() => {
                disableTransitions();
                htmlElement.classList.add('dark');
                localStorage.theme = 'dark';
                updateIconState(true);
                themeOverlay.classList.add('hidden');
                themeOverlay.style.transition = '';
                requestAnimationFrame(() => {
                    enableTransitions();
                    isAnimating = false;
                });
            }, animDuration);
        } else {
            disableTransitions();
            htmlElement.classList.remove('dark');
            localStorage.theme = 'light';
            updateIconState(false);
            themeOverlay.classList.remove('hidden');
            themeOverlay.style.clipPath = `circle(${maxRadius}px at ${x}px ${y}px)`;
            requestAnimationFrame(() => {
                enableTransitions();
                requestAnimationFrame(() => {
                    themeOverlay.style.transition = `clip-path ${animDuration}ms ease-in`;
                    themeOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
                });
            });

            setTimeout(() => {
                themeOverlay.classList.add('hidden');
                themeOverlay.style.transition = '';
                isAnimating = false;
            }, animDuration);
        }
    });
}

// সব কিছু শুরু
document.addEventListener('DOMContentLoaded', () => {
    generateContributorCards();
    initThemeToggle();
});
            
