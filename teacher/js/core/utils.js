// js/core/utils.js
// ইউটিলিটি ফাংশন (থিম টগল ফিক্স সহ)

import { AppState } from './state.js';

export function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

export function toggleDarkMode() {
    AppState.darkMode = !AppState.darkMode;
    if (AppState.darkMode) {
        document.documentElement.classList.add('theme-dark');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.documentElement.classList.remove('theme-dark');
        localStorage.setItem('darkMode', 'false');
    }
    // রি-রেন্ডার ওভারলে (যদি থাকে)
    if (window.MathEditor && typeof window.MathEditor.updateAllOverlays === 'function') {
        window.MathEditor.updateAllOverlays();
    }
}

// ডায়নামিক MathJax লোডার (স্টুডেন্ট প্যানেল থেকে গৃহীত)
export function loadMathJax(callback, targetElement) {
    setTimeout(() => {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            if (window.MathJax.typesetClear) {
                window.MathJax.typesetClear();
            }
            MathJax.typesetPromise(targetElement ? [targetElement] : undefined)
                .then(() => { if (callback) callback(); })
                .catch(err => console.warn('MathJax error', err));
            return;
        }
        if (!document.getElementById('mathjax-script')) {
            const script = document.createElement('script');
            script.id = 'mathjax-script';
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
            script.async = true;
            script.onload = () => {
                MathJax.typesetPromise(targetElement ? [targetElement] : undefined)
                    .then(() => { if (callback) callback(); })
                    .catch(err => console.warn('MathJax error', err));
            };
            document.head.appendChild(script);
        }
    }, 50);
}

// Make functions globally available
window.toggleDarkMode = toggleDarkMode;
window.loadMathJax = loadMathJax;
