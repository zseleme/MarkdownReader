'use strict';

import { state } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { updateStatusBar } from '../ui/statusBar.js';

/**
 * Toggles between light and dark themes.
 */
export function toggleTheme() {
    state.isDarkTheme = !state.isDarkTheme;

    document.body.classList.toggle('dark-theme', state.isDarkTheme);
    document.documentElement.classList.remove('dark-theme-preload');

    if (state.editor) {
        monaco.editor.setTheme(state.isDarkTheme ? 'vs-dark' : 'vs');
    }

    const themeIcon = document.getElementById('theme-icon');
    themeIcon.className = state.isDarkTheme ? 'fas fa-sun' : 'fas fa-moon';

    localStorage.setItem('mdreader-theme', state.isDarkTheme ? 'dark' : 'light');
    updateStatusBar();

    showToast(state.isDarkTheme ? 'Dark theme enabled' : 'Light theme enabled');
}

/**
 * Cycles through view modes: split -> editor -> preview -> split.
 */
export function toggleViewMode() {
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const resizer = document.getElementById('resizer');
    const viewModeIcon = document.getElementById('view-mode-icon');
    const viewModeText = document.getElementById('view-mode-text');

    const viewModes = {
        split: {
            next: 'editor',
            editor: { display: 'block', width: '50%' },
            preview: { display: 'block', width: '50%' },
            resizer: 'block',
            icon: 'fas fa-columns',
            text: 'Split'
        },
        editor: {
            next: 'preview',
            editor: { display: 'block', width: '100%' },
            preview: { display: 'none', width: '50%' },
            resizer: 'none',
            icon: 'fas fa-edit',
            text: 'Editor'
        },
        preview: {
            next: 'split',
            editor: { display: 'none', width: '50%' },
            preview: { display: 'block', width: '100%' },
            resizer: 'none',
            icon: 'fas fa-eye',
            text: 'Preview'
        }
    };

    state.viewMode = viewModes[state.viewMode].next;
    const config = viewModes[state.viewMode];

    editorPanel.style.display = config.editor.display;
    editorPanel.style.width = config.editor.width;
    previewPanel.style.display = config.preview.display;
    previewPanel.style.width = config.preview.width;
    resizer.style.display = config.resizer;
    viewModeIcon.className = config.icon;
    viewModeText.textContent = config.text;
}

/**
 * Loads the theme preference from localStorage and applies it.
 */
export function loadThemePreference() {
    try {
        const savedTheme = localStorage.getItem('mdreader-theme') || 'dark';
        state.isDarkTheme = savedTheme === 'dark';

        if (state.isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.getElementById('theme-icon').className = 'fas fa-sun';
        }
    } catch (e) {
        console.error('Error loading theme:', e);
    }
}
