import { AppState } from './state.js';

export function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

export function toggleDarkMode() {
    AppState.darkMode = !AppState.darkMode;
    if (AppState.darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'false');
    }
    // Re-render math overlays if needed (will be handled by MathEditor)
    if (window.MathEditor && typeof window.MathEditor.updateAllOverlays === 'function') {
        window.MathEditor.updateAllOverlays();
    }
}

// Make toggleDarkMode globally available for inline onclick
window.toggleDarkMode = toggleDarkMode;
