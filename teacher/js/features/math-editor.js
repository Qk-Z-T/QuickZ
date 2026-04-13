// js/features/math-editor.js
// গণিতের সিম্বল প্যানেল, লাইভ প্রিভিউ এবং MathHelper

import { autoResizeTextarea } from '../core/utils.js';

// MathHelper - টেক্সট প্রি-প্রসেসিং ও রেন্ডারিং (স্টুডেন্ট প্যানেল থেকে গৃহীত)
window.MathHelper = {
    renderExamContent: (text) => {
        if (!text) return '';
        text = String(text)
            .replace(/\\propotional/g, '\\propto')
            .replace(/\\degree/g, '^{\\circ}');
        const hasMathDelimiters = text.includes('$') || text.includes('\\(') || text.includes('\\[');
        const hasMathSymbols = /[_^\\]/.test(text);
        if (hasMathDelimiters) {
            return `<span class="bengali-text">${text}</span>`;
        }
        if (hasMathSymbols) {
            return `<span class="bengali-text">\\(${text}\\)</span>`;
        }
        return `<span class="bengali-text">${text}</span>`;
    },
    processOptions: (options) => {
        return options.map((opt, index) => {
            return `<div class="option-math flex items-start gap-2">
                <span class="font-bold">${String.fromCharCode(65 + index)}.</span>
                <div class="flex-1">${window.MathHelper.renderExamContent(opt)}</div>
            </div>`;
        });
    }
};

export const MathEditor = {
    currentField: null,
    
    init: function() {
        // MathJax কনফিগারেশন ইতিমধ্যে index.html-এ আছে
        
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'TEXTAREA' && 
                (e.target.id.includes('question') || e.target.id.includes('option') || e.target.id.includes('explanation'))) {
                window.currentFocusedTextarea = e.target;
            }
        });
        
        const floatingMathBtn = document.getElementById('floating-math-btn');
        if (floatingMathBtn) {
            floatingMathBtn.addEventListener('click', () => {
                const panel = document.getElementById('math-symbols-panel');
                panel.classList.toggle('show');
                if (panel.classList.contains('show')) {
                    panel.classList.add('fixed-position');
                } else {
                    panel.classList.remove('fixed-position');
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('math-preview-btn') || e.target.closest('.math-preview-btn')) {
                const btn = e.target.classList.contains('math-preview-btn') ? e.target : e.target.closest('.math-preview-btn');
                const textareaId = btn.dataset.target;
                const textarea = document.getElementById(textareaId);
                
                if (!textarea) return;
                
                let overlay = document.getElementById('overlay-' + textareaId);
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'overlay-' + textareaId;
                    overlay.className = 'math-render-overlay';
                    overlay.style.display = 'none';
                    textarea.parentNode.style.position = 'relative';
                    textarea.parentNode.insertBefore(overlay, textarea.nextSibling);
                }
                
                if (overlay.style.display === 'none') {
                    overlay.style.display = 'block';
                    textarea.classList.add('math-mode');
                    btn.innerHTML = '<i class="fas fa-code"></i>';
                    this.updateMathOverlay(textareaId);
                } else {
                    overlay.style.display = 'none';
                    textarea.classList.remove('math-mode');
                    btn.innerHTML = '<i class="fas fa-eye"></i>';
                }
            }
        });
        
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'TEXTAREA' && 
                (e.target.id.includes('question') || e.target.id.includes('option') || e.target.id.includes('explanation'))) {
                const overlayId = 'overlay-' + e.target.id;
                const overlay = document.getElementById(overlayId);
                if (overlay && overlay.style.display !== 'none') {
                    MathEditor.updateMathOverlay(e.target.id);
                }
            }
        });
    },
    
    closePanel: function() {
        const panel = document.getElementById('math-symbols-panel');
        panel.classList.remove('show');
        panel.classList.remove('fixed-position');
    },
    
    insertAtCursor: function(symbol) {
        if (!window.currentFocusedTextarea) return;
        const textarea = window.currentFocusedTextarea;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        
        let cursorPos = before.length + symbol.length;
        if (symbol.includes('{}')) {
            cursorPos = before.length + symbol.indexOf('{}') + 1;
        }
        
        textarea.value = before + symbol + after;
        textarea.selectionStart = cursorPos;
        textarea.selectionEnd = cursorPos;
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
        this.closePanel();
        
        const overlayId = 'overlay-' + textarea.id;
        const overlay = document.getElementById(overlayId);
        if (overlay && overlay.style.display !== 'none') {
            this.updateMathOverlay(textarea.id);
        }
    },
    
    updateMathOverlay: function(textareaId) {
        const textarea = document.getElementById(textareaId);
        const overlay = document.getElementById('overlay-' + textareaId);
        if (!textarea || !overlay) return;
        const content = textarea.value;
        overlay.innerHTML = '';
        if (!content.trim()) {
            overlay.innerHTML = '<div class="text-center text-slate-400 p-4 bengali-text">কোনো কন্টেন্ট নেই</div>';
            return;
        }
        
        const previewContent = document.createElement('div');
        previewContent.className = 'math-render bengali-text';
        let processedContent = content;
        const hasLatex = /\\[a-zA-Z]|\\[\[\]\(\)]|\^|_|\\frac|\\sqrt|\\sum|\\int|\\lim/.test(content);
        const isWrapped = /\\\(.*\\\)|\\\[.*\\\]/.test(content);
        if (hasLatex && !isWrapped) { processedContent = `\\(${content}\\)`; }
        
        previewContent.innerHTML = processedContent;
        overlay.appendChild(previewContent);
        try {
            if (window.MathJax) {
                MathJax.typeset([previewContent]);
            }
        } catch (error) {
            console.error('MathJax error:', error);
            overlay.innerHTML = `<div class="text-red-500 p-2 bengali-text">রেন্ডারিং ত্রুটি</div>`;
        }
    }
};

// Initialize MathEditor when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    MathEditor.init();
});

// Expose globally
window.MathEditor = MathEditor;
