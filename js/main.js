document.addEventListener('DOMContentLoaded', () => {
    // --- Circular Reveal Theme Animation ---
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

    // Check saved theme
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        disableTransitions();
        htmlElement.classList.add('dark');
        updateIconState(true);
        requestAnimationFrame(() => requestAnimationFrame(() => enableTransitions()));
    }

    if (themeToggleBtn) {
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
                // Light → Dark
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
                // Dark → Light
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

    // --- Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(reg => {
                console.log('✅ Service Worker registered');
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🔄 New update available.');
                        }
                    };
                };
            }).catch(err => console.error('SW Error:', err));
        });
    }

    // --- Install Prompt ---
    let deferredPrompt;
    const installContainer = document.getElementById('install-container');
    const installBtn = document.getElementById('install-prompt-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!window.matchMedia('(display-mode: standalone)').matches) {
            if (installContainer) installContainer.classList.remove('hidden');
        }
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (installContainer) installContainer.classList.add('hidden');
        });
    }

    window.addEventListener('appinstalled', () => {
        if (installContainer) installContainer.classList.add('hidden');
    });
});
