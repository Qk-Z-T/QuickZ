import { AppState } from './core/state.js';
import { Auth } from './features/auth.js';
import './features/math-editor.js'; // ensures MathEditor is initialized

// Temporary placeholder for Router and Teacher (will be defined in part 2)
window.Router = window.Router || {};
window.Teacher = window.Teacher || {};

// Splash screen and auth screen logic
window.addEventListener('load', () => {
    const hasTeacherSession = localStorage.getItem('teacher_sess');
    
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.add('light-mode');
    }
    
    if (hasTeacherSession) {
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('splash-hidden');
            setTimeout(() => {
                document.getElementById('splash-screen').style.display = 'none';
                Auth.reloadTeacherSession();
            }, 500);
        }, 1000);
    } else {
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('splash-hidden');
            setTimeout(() => {
                document.getElementById('splash-screen').style.display = 'none';
                document.getElementById('auth-screen').classList.add('show');
            }, 500);
        }, 1500);
    }
});

// Global click handler for closing dropdowns (will be extended)
document.addEventListener('click', function(e) {
    if (!e.target.closest('.three-dot-menu') && !e.target.closest('.dot-menu-dropdown')) {
        document.querySelectorAll('.dot-menu-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
    
    if (!e.target.closest('#math-symbols-panel') && !e.target.closest('#floating-math-btn')) {
        document.getElementById('math-symbols-panel').classList.remove('show');
    }
    
    if (!e.target.closest('.hamburger-menu')) {
        const hamburgerMenu = document.getElementById('hamburger-menu');
        if (hamburgerMenu) hamburgerMenu.classList.remove('show');
    }
    
    if (!e.target.closest('.group-switcher')) {
        document.getElementById('group-switcher-dropdown').classList.remove('show');
    }
    
    if (!e.target.closest('.student-three-dot-menu')) {
        document.querySelectorAll('.student-dot-menu-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
});

// Make autoResizeTextarea globally available (used in inline oninput)
import { autoResizeTextarea } from './core/utils.js';
window.autoResizeTextarea = autoResizeTextarea;
